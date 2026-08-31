# ARM Enterprise Simulation Results

**Date:** 2026-07-26
**Duration:** ~6 minutes
**Infrastructure:** 9 Docker containers on 2 isolated networks

## Network Topology

```
armtest-internal (armtest.com)                    armtest-external
┌────────────────────────────────────┐           ┌──────────────┐
│ arm-server (arm.armtest.com:8787)  │           │ remote-pc    │
│   ↓                                │    VPN    │ (Alex)       │
│ postgres-ent ←→ clickhouse-ent     │◄─────────►│              │
│   ↑                                │           └──────────────┘
│ emp-sarah  emp-mike  emp-carlos    │
│ emp-jenny  emp-david               │
└────────────────────────────────────┘
         ↓
host.docker.internal:11434 (Ollama)
```

## Employee Workstations

| #   | Employee       | Department    | Agent       | Task            | Model       | Network        |
| --- | -------------- | ------------- | ----------- | --------------- | ----------- | -------------- |
| 1   | Sarah Chen     | Engineering   | Claude Code | Code Review     | minicpm5-1b | Internal       |
| 2   | Mike Rodriguez | Engineering   | OpenCode    | Documentation   | minicpm5-1b | Internal       |
| 3   | Carlos Mendes  | Manufacturing | OpenCode    | CNC Toolpath    | qwen3.5     | Internal       |
| 4   | Jenny Park     | QA            | Claude Code | Security Scan   | qwen3.5     | Internal       |
| 5   | David Kim      | Supply Chain  | Copilot     | Demand Forecast | minicpm5-1b | Internal       |
| 6   | Alex Thompson  | R&D           | Pi          | Research        | minicpm5-1b | External → VPN |

## Results

### LLM Call Metering (from ClickHouse)

| Department        | Status  | Calls  | Tokens    | Cloud Cost | Savings   |
| ----------------- | ------- | ------ | --------- | ---------- | --------- |
| Engineering       | success | 10     | 963       | $0.10      | $0.15     |
| Engineering       | error   | 1      | -         | -          | -         |
| Manufacturing     | success | 4      | 378       | $0.04      | $0.06     |
| Quality Assurance | denied  | 2      | -         | -          | -         |
| Quality Assurance | error   | 1      | -         | -          | -         |
| R&D               | success | 3      | 245       | $0.03      | $0.04     |
| Supply Chain      | success | 5      | 466       | $0.05      | $0.08     |
| **TOTAL**         |         | **25** | **2,027** | **$0.22**  | **$0.33** |

### Policy Enforcement

| Decision | Reason                                    | Count |
| -------- | ----------------------------------------- | ----- |
| deny     | DLP: API Key (sk-ant-) detected in prompt | 2     |

## VPN Demo

1. Remote PC starts on `armtest-external` network
2. DNS resolution for `arm.armtest.com` fails — not on internal network
3. Shows: "VPN connection required to access armtest.com domain resources"
4. Waits for VPN connection (polls every 2s)
5. Admin runs: `docker network connect armtest-internal simulation-remote-pc-1`
6. Remote PC detects VPN — "VPN connected! arm.armtest.com is now reachable"
7. Authenticates with ARM, makes 3 successful LLM calls through governance

## Key Features Demonstrated

- ✅ Multi-container enterprise deployment (9 containers)
- ✅ Internal domain simulation (armtest.com DNS aliases)
- ✅ Network isolation (armtest-internal vs armtest-external)
- ✅ VPN access simulation (network connect = VPN connect)
- ✅ Real LLM inference (Ollama: minicpm5-1b + qwen3.5)
- ✅ API key authentication (Postgres-backed)
- ✅ Budget enforcement
- ✅ Token quota tracking
- ✅ DLP scanning (API key detection → 2 blocks)
- ✅ Classification gate
- ✅ Real-time metering to ClickHouse (partitioned by tenant_id, toYYYYMM)
- ✅ Cloud-equivalent cost tracking + savings
- ✅ Multiple agent types (Claude Code, OpenCode, Copilot, Pi)

## How to Run

```bash
cd apps/simulation

# Start the enterprise network
docker compose -f docker-compose.enterprise.yml up -d

# Watch employee agents
docker compose -f docker-compose.enterprise.yml logs -f emp-sarah

# VPN demo: connect external PC to internal network
docker network connect armtest-internal simulation-remote-pc-1

# Check metering data
docker exec simulation-clickhouse-ent-1 clickhouse-client --user arm --password arm_dev_password \
  -q "SELECT * FROM arm.llm_events ORDER BY ts DESC LIMIT 20 FORMAT PrettyCompact"

# Tear down
docker compose -f docker-compose.enterprise.yml down -v
```
