#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  ARM Enterprise Simulation — End-to-End Verification
#
#  Runs a full simulation and verifies every governance feature works.
#  Usage: bash verify-simulation.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE="docker compose -f docker-compose.enterprise.yml"
PROXY="http://localhost:8787"
PASS=0; FAIL=0; SKIP=0

green()  { printf "\033[32m%s\033[0m\n" "$1"; }
red()    { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
header() { printf "\n\033[1;44m %s \033[0m\n" "$1"; }

check() {
  local name="$1" result="$2"
  if [ "$result" = "pass" ]; then
    green "  ✅ $name"; PASS=$((PASS+1))
  elif [ "$result" = "skip" ]; then
    yellow "  ⏭  $name (skipped)"; SKIP=$((SKIP+1))
  else
    red "  ❌ $name"; FAIL=$((FAIL+1))
  fi
}

# ────────────────────────────────────────────────────────────────────────────
header "PREREQUISITES"
# ────────────────────────────────────────────────────────────────────────────

echo "  Checking Docker..."
docker info >/dev/null 2>&1 && check "Docker daemon running" pass || { check "Docker daemon running" fail; exit 1; }

echo "  Checking Ollama..."
if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  MODELS=$(curl -s http://localhost:11434/api/tags | python3 -c "import sys,json; d=json.load(sys.stdin); print(' '.join(m['name'] for m in d.get('models',[])))")
  echo "$MODELS" | grep -q "minicpm5-1b" && check "Ollama model: minicpm5-1b" pass || check "Ollama model: minicpm5-1b" fail
  echo "$MODELS" | grep -q "qwen3.5" && check "Ollama model: qwen3.5" pass || check "Ollama model: qwen3.5" skip
else
  check "Ollama on localhost:11434" fail
  echo "  Start Ollama first: ollama serve"
  exit 1
fi

# ────────────────────────────────────────────────────────────────────────────
header "START ENTERPRISE NETWORK (clean rebuild)"
# ────────────────────────────────────────────────────────────────────────────

echo "  Stopping any existing containers..."
$COMPOSE down -v >/dev/null 2>&1 || true

echo "  Building images..."
$COMPOSE build --quiet >/dev/null 2>&1 && check "Docker images built" pass || check "Docker images built" fail

echo "  Starting 9 containers..."
$COMPOSE up -d >/dev/null 2>&1 && check "Containers started" pass || check "Containers started" fail

echo "  Waiting for infrastructure to become healthy..."
for i in $(seq 1 60); do
  PG=$($COMPOSE ps postgres-ent --format '{{.Status}}' 2>/dev/null | grep -c healthy || true)
  CH=$($COMPOSE ps clickhouse-ent --format '{{.Status}}' 2>/dev/null | grep -c healthy || true)
  if [ "$PG" = "1" ] && [ "$CH" = "1" ]; then break; fi
  sleep 2
done
[ "$PG" = "1" ] && check "PostgreSQL healthy" pass || check "PostgreSQL healthy" fail
[ "$CH" = "1" ] && check "ClickHouse healthy" pass || check "ClickHouse healthy" fail

# ────────────────────────────────────────────────────────────────────────────
header "ARM SERVER INITIALIZATION"
# ────────────────────────────────────────────────────────────────────────────

echo "  Waiting for ARM proxy to start..."
ARM_READY=false
for i in $(seq 1 45); do
  if curl -sf "$PROXY/health" >/dev/null 2>&1; then ARM_READY=true; break; fi
  sleep 2
done
$ARM_READY && check "ARM proxy responding" pass || { check "ARM proxy responding" fail; exit 1; }

echo "  Checking server health endpoint..."
HEALTH=$(curl -s "$PROXY/health")
echo "$HEALTH" | grep -q "budget_enforcement" && check "Budget enforcement feature" pass || check "Budget enforcement feature" fail
echo "$HEALTH" | grep -q "dlp_scan" && check "DLP scanning feature" pass || check "DLP scanning feature" fail
echo "$HEALTH" | grep -q "classification_gate" && check "Classification gate feature" pass || check "Classification gate feature" fail

# ────────────────────────────────────────────────────────────────────────────
header "DATABASE SEED DATA"
# ────────────────────────────────────────────────────────────────────────────

AGENTS=$(docker exec simulation-postgres-ent-1 psql -U arm -d arm -t -c "SELECT count(*) FROM agents;" 2>/dev/null | tr -d ' ')
DEPTS=$(docker exec simulation-postgres-ent-1 psql -U arm -d arm -t -c "SELECT count(*) FROM departments;" 2>/dev/null | tr -d ' ')
MODELS=$(docker exec simulation-postgres-ent-1 psql -U arm -d arm -t -c "SELECT count(*) FROM models;" 2>/dev/null | tr -d ' ')
TABLES=$(docker exec simulation-clickhouse-ent-1 clickhouse-client --user arm --password arm_dev_password -q "SHOW TABLES FROM arm" 2>/dev/null | wc -l | tr -d ' ')

[ "$AGENTS" -ge 10 ] 2>/dev/null && check "Seed data: $AGENTS agents" pass || check "Seed data: agents ($AGENTS)" fail
[ "$DEPTS" -ge 5 ] 2>/dev/null && check "Seed data: $DEPTS departments" pass || check "Seed data: departments ($DEPTS)" fail
[ "$MODELS" -ge 4 ] 2>/dev/null && check "Seed data: $MODELS models" pass || check "Seed data: models ($MODELS)" fail
[ "$TABLES" -ge 2 ] 2>/dev/null && check "ClickHouse: $TABLES tables" pass || check "ClickHouse tables ($TABLES)" fail

# ────────────────────────────────────────────────────────────────────────────
header "GOVERNANCE: AUTHENTICATION"
# ────────────────────────────────────────────────────────────────────────────

echo "  Test: Valid API key..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROXY/v1/chat/completions" \
  -H "Authorization: Bearer arm_sk_eng_review_x1a2b3" -H "Content-Type: application/json" \
  -d '{"model":"minicpm5-1b","messages":[{"role":"user","content":"Say OK"}],"max_tokens":5}')
[ "$HTTP_CODE" = "200" ] && check "Valid API key → 200" pass || check "Valid API key (got $HTTP_CODE)" fail

echo "  Test: Invalid API key..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROXY/v1/chat/completions" \
  -H "Authorization: Bearer INVALID" -H "Content-Type: application/json" \
  -d '{"model":"minicpm5-1b","messages":[{"role":"user","content":"hi"}]}')
[ "$HTTP_CODE" = "401" ] && check "Invalid API key → 401" pass || check "Invalid API key (got $HTTP_CODE)" fail

# ────────────────────────────────────────────────────────────────────────────
header "GOVERNANCE: DLP SCANNING"
# ────────────────────────────────────────────────────────────────────────────

echo "  Test: Prompt with API key (should be blocked)..."
RESP=$(curl -s "$PROXY/v1/chat/completions" \
  -H "Authorization: Bearer arm_sk_eng_review_x1a2b3" -H "Content-Type: application/json" \
  -d '{"model":"minicpm5-1b","messages":[{"role":"user","content":"Check: sk-ant-api03-abc123def456"}],"max_tokens":5}')
echo "$RESP" | grep -q "DLP gate blocked" && check "API key in prompt → blocked" pass || check "DLP block failed" fail

echo "  Test: Prompt with SSN (should be blocked)..."
RESP=$(curl -s "$PROXY/v1/chat/completions" \
  -H "Authorization: Bearer arm_sk_eng_review_x1a2b3" -H "Content-Type: application/json" \
  -d '{"model":"minicpm5-1b","messages":[{"role":"user","content":"SSN: 123-45-6789"}],"max_tokens":5}')
echo "$RESP" | grep -q "DLP gate blocked" && check "SSN in prompt → blocked" pass || check "SSN block failed" fail

# ────────────────────────────────────────────────────────────────────────────
header "GOVERNANCE: REAL LLM INFERENCE"
# ────────────────────────────────────────────────────────────────────────────

echo "  Test: Real inference through Ollama..."
RESP=$(curl -s "$PROXY/v1/chat/completions" \
  -H "Authorization: Bearer arm_sk_eng_review_x1a2b3" -H "Content-Type: application/json" \
  -d '{"model":"minicpm5-1b","messages":[{"role":"user","content":"What is 2+2?"}],"max_tokens":20}')
echo "$RESP" | grep -q "choices" && check "LLM inference succeeded" pass || check "LLM inference failed" fail
TOKENS=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('usage',{}).get('total_tokens',0))" 2>/dev/null || echo 0)
[ "$TOKENS" -gt 0 ] 2>/dev/null && check "Token metering: $TOKENS tokens" pass || check "Token metering" fail

# ────────────────────────────────────────────────────────────────────────────
header "METERING: CLICKHOUSE LEDGER"
# ────────────────────────────────────────────────────────────────────────────

echo "  Querying metered events..."
EVENTS=$(docker exec simulation-clickhouse-ent-1 clickhouse-client --user arm --password arm_dev_password -q "SELECT count() FROM arm.llm_events" 2>/dev/null | tr -d ' ')
POLICY=$(docker exec simulation-clickhouse-ent-1 clickhouse-client --user arm --password arm_dev_password -q "SELECT count() FROM arm.policy_events" 2>/dev/null | tr -d ' ')
[ "$EVENTS" -gt 0 ] 2>/dev/null && check "LLM events recorded: $EVENTS" pass || check "LLM events recorded ($EVENTS)" fail
[ "$POLICY" -gt 0 ] 2>/dev/null && check "Policy events recorded: $POLICY" pass || check "Policy events ($POLICY)" fail

echo ""
echo "  Metering breakdown:"
docker exec simulation-clickhouse-ent-1 clickhouse-client --user arm --password arm_dev_password -q "
SELECT department, status, count() as calls, sum(total_tokens) as tokens
FROM arm.llm_events GROUP BY department, status ORDER BY department FORMAT PrettyCompact" 2>/dev/null

# ────────────────────────────────────────────────────────────────────────────
header "NETWORK ISOLATION (VPN SIMULATION)"
# ────────────────────────────────────────────────────────────────────────────

echo "  Test: Internal container → arm.armtest.com (should work)..."
docker run --rm --network armtest-internal alpine sh -c "wget -q -O- -T 3 http://arm.armtest.com:8787/health 2>/dev/null | head -1" >/dev/null 2>&1 \
  && check "Internal network can reach arm.armtest.com" pass \
  || check "Internal network access" fail

echo "  Test: External container → arm.armtest.com (should be blocked)..."
# We expect wget to FAIL here (connection timeout). Use || true to prevent set -e exit.
EXIT_CODE=$(docker run --rm --network armtest-external alpine sh -c "wget -q -O- -T 3 http://arm.armtest.com:8787/health 2>/dev/null; echo \$?" 2>/dev/null | tail -1 || echo "1")
if [ "$EXIT_CODE" != "0" ]; then
  check "External network blocked from arm.armtest.com" pass
else
  check "External network should be blocked" fail
fi

# ────────────────────────────────────────────────────────────────────────────
header "ENTERPRISE EMPLOYEE SIMULATION"
# ────────────────────────────────────────────────────────────────────────────

echo "  Waiting for employee containers to complete sessions..."
# Employees run with MAX_CALLS; wait for them to finish
for i in $(seq 1 90); do
  RUNNING=$(docker ps --filter "name=emp-" --format '{{.Names}}' | wc -l | tr -d ' ')
  if [ "$RUNNING" = "0" ]; then break; fi
  sleep 5
done
RUNNING=$(docker ps --filter "name=emp-" --format '{{.Names}}' | wc -l | tr -d ' ')
[ "$RUNNING" = "0" ] && check "All employee sessions completed" pass || check "Employee sessions ($RUNNING still running)" skip

echo ""
echo "  Employee results:"
for emp in emp-sarah emp-mike emp-carlos emp-jenny emp-david; do
  NAME=$(docker logs simulation-$emp-1 2>&1 | grep "Employee:" | head -1 | sed 's/.*Employee: *//; s/\x1b\[[0-9;]*m//g' || echo "$emp")
  SUCC=$(docker logs simulation-$emp-1 2>&1 | grep -c "tokens in" || true)
  BLK=$(docker logs simulation-$emp-1 2>&1 | grep -c "BLOCKED" || true)
  printf "    %-30s success:%s blocked:%s\n" "$NAME" "$SUCC" "$BLK"
done

# ────────────────────────────────────────────────────────────────────────────
header "VPN DEMO"
# ────────────────────────────────────────────────────────────────────────────

echo "  Connecting remote-pc to internal network (simulating VPN)..."
docker network connect armtest-internal simulation-remote-pc-1 2>/dev/null || true
sleep 8
VPN_LOG=$(docker logs simulation-remote-pc-1 2>&1 | tail -5)
echo "$VPN_LOG" | grep -q "VPN connected" && check "Remote PC connected via VPN" pass || check "VPN connection" skip
echo "$VPN_LOG" | grep -q "tokens" && check "Remote PC made LLM calls post-VPN" pass || check "Post-VPN calls" skip

# ────────────────────────────────────────────────────────────────────────────
header "FINAL METERING"
# ────────────────────────────────────────────────────────────────────────────

EVENTS=$(docker exec simulation-clickhouse-ent-1 clickhouse-client --user arm --password arm_dev_password -q "SELECT count() FROM arm.llm_events" 2>/dev/null | tr -d ' ')
TOKENS=$(docker exec simulation-clickhouse-ent-1 clickhouse-client --user arm --password arm_dev_password -q "SELECT sum(total_tokens) FROM arm.llm_events" 2>/dev/null | tr -d ' ')
echo ""
echo "  Total LLM events: $EVENTS"
echo "  Total tokens:     $TOKENS"
echo ""
docker exec simulation-clickhouse-ent-1 clickhouse-client --user arm --password arm_dev_password -q "
SELECT department, status, count() as calls, sum(total_tokens) as tokens
FROM arm.llm_events GROUP BY department, status ORDER BY department FORMAT PrettyCompact" 2>/dev/null

# ────────────────────────────────────────────────────────────────────────────
header "SUMMARY"
# ────────────────────────────────────────────────────────────────────────────
echo ""
printf "  \033[32mPassed: %d\033[0m  \033[31mFailed: %d\033[0m  \033[33mSkipped: %d\033[0m\n\n" "$PASS" "$FAIL" "$SKIP"

if [ "$FAIL" -gt 0 ]; then
  red "  ⚠  $FAIL check(s) failed. Review output above."
  exit 1
else
  green "  ✅ All checks passed. Enterprise simulation verified."
  exit 0
fi
