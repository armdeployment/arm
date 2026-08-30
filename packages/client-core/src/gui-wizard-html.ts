/**
 * The installation wizard's single-page UI, served by gui-server.ts. Inline
 * HTML/CSS/JS on purpose — no build step, no bundler, nothing beyond what
 * ships in the signed generic client already (roadmap §5: one engine, every
 * shape; a GUI wizard is exactly the "any future platform installer" this
 * module's doc comment already anticipated).
 */
export const WIZARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ARM Setup</title>
<style>
  :root { --navy: #1E3A8A; --navy-dark: #0F172A; --gold: #B45309; --bg: #F8FAFC; --border: #E2E8F0;
          --text: #0F172A; --text-muted: #64748B; --green: #16A34A; --red: #DC2626; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Inter, sans-serif; background: var(--bg); color: var(--text); }
  .shell { max-width: 640px; margin: 0 auto; padding: 48px 24px; }
  .brand { font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--gold); margin-bottom: 8px; }
  h1 { font-size: 26px; margin: 0 0 8px; }
  p.help { color: var(--text-muted); font-size: 14px; margin: 0 0 28px; line-height: 1.5; }
  .card { background: white; border: 1px solid var(--border); border-radius: 12px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; margin-top: 18px; }
  label:first-child { margin-top: 0; }
  input[type=text], textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px;
    font-size: 14px; font-family: inherit; }
  textarea { min-height: 80px; resize: vertical; }
  .row { display: flex; gap: 10px; align-items: center; }
  .row input { flex: 1; }
  button { cursor: pointer; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; padding: 11px 18px; }
  button.primary { background: var(--navy); color: white; width: 100%; margin-top: 22px; }
  button.primary:disabled { opacity: 0.5; cursor: default; }
  button.secondary { background: white; border: 1px solid var(--border); color: var(--text); }
  button.link { background: none; color: var(--navy); padding: 4px 0; font-weight: 500; text-decoration: underline; }
  .drop { border: 2px dashed var(--border); border-radius: 10px; padding: 22px; text-align: center; color: var(--text-muted);
    font-size: 13px; margin-top: 18px; }
  .drop.over { border-color: var(--navy); background: #EFF6FF; }
  .error { background: #FEF2F2; border: 1px solid #FECACA; color: var(--red); border-radius: 8px; padding: 12px 14px;
    font-size: 13px; margin-top: 16px; display: none; }
  .spinner-wrap { display: none; text-align: center; padding: 40px 0; }
  .spinner { width: 36px; height: 36px; border: 3px solid var(--border); border-top-color: var(--navy);
    border-radius: 50%; margin: 0 auto 16px; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .step { color: var(--text-muted); font-size: 13px; }
  .kv { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
  .kv:last-child { border-bottom: none; }
  .kv .k { color: var(--text-muted); }
  .kv .v { font-weight: 600; font-family: ui-monospace, monospace; }
  .badge { display: inline-block; background: #ECFDF5; color: var(--green); font-size: 11px; font-weight: 700;
    padding: 3px 8px; border-radius: 999px; margin-left: 8px; }
  .conn { border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-top: 12px; }
  .conn .name { font-weight: 700; font-size: 14px; }
  .conn ol { margin: 10px 0 0; padding-left: 18px; font-size: 12.5px; color: var(--text-muted); line-height: 1.7; }
  .tag { display: inline-block; background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
    padding: 4px 9px; font-size: 12px; font-family: ui-monospace, monospace; margin: 3px 4px 0 0; }
  .screen { display: none; }
  .screen.active { display: block; }
  .footer-note { text-align: center; font-size: 12px; color: var(--text-muted); margin-top: 20px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted);
    margin: 26px 0 10px; }
  .section-title:first-child { margin-top: 0; }
</style>
</head>
<body>
<div class="shell">
  <div class="brand">ARM &middot; Agent Resource Management</div>

  <div id="screen-activate" class="screen active">
    <h1>Set up your agent</h1>
    <p class="help">No terminal, no config files — enter the activation code from your setup email, or drop the <code>.armsetup</code> file you downloaded.</p>
    <div class="card">
      <label for="tenantUrl">Company ARM URL</label>
      <input type="text" id="tenantUrl" placeholder="https://arm.acme.com" />
      <label for="code">Activation code</label>
      <input type="text" id="code" placeholder="G7NHCF" maxlength="6" style="text-transform:uppercase;letter-spacing:2px;font-family:ui-monospace,monospace;" />
      <div id="drop" class="drop">or drop your <strong>.armsetup</strong> file here</div>
      <input type="file" id="fileInput" accept=".armsetup" style="display:none">
      <div id="activateError" class="error"></div>
      <button class="primary" id="installBtn">Install</button>
    </div>
    <div class="footer-note">Everything below happens on this machine — nothing you type here is stored except the activation code itself.</div>
  </div>

  <div id="screen-installing" class="screen">
    <h1>Installing&hellip;</h1>
    <div class="card spinner-wrap" style="display:block;">
      <div class="spinner"></div>
      <div class="step" id="installStep">Verifying your package&hellip;</div>
    </div>
  </div>

  <div id="screen-complete" class="screen">
    <h1>You're set up<span id="onlineBadge" class="badge">online</span></h1>
    <p class="help" id="completeHelp"></p>
    <div class="card">
      <div class="kv"><span class="k">Role</span><span class="v" id="sumRole"></span></div>
      <div class="kv"><span class="k">Package</span><span class="v" id="sumPackage"></span></div>
      <div class="kv"><span class="k">Budget</span><span class="v" id="sumBudget"></span></div>
      <div class="kv"><span class="k">Components</span><span class="v" id="sumComponents" style="text-align:right;max-width:60%;"></span></div>
      <div class="kv" id="sumRuntimesRow" style="display:none;"><span class="k">Runtimes downloaded</span><span class="v" id="sumRuntimes"></span></div>
    </div>

    <div id="connectionsSection" style="display:none;">
      <div class="section-title">Connect your tools</div>
      <div id="connectionsList"></div>
    </div>

    <div class="section-title">Optional — help us fine-tune your setup</div>
    <div class="card">
      <p class="help" style="margin-bottom:14px;">Nothing below leaves this machine (A5) — only the tags we detect are shown to you.</p>
      <label for="painPoints">Describe a work pain point</label>
      <textarea id="painPoints" placeholder="e.g. I spend too much time chasing budget approvals..."></textarea>
      <label>Work folder</label>
      <div class="row">
        <input type="text" id="folderPath" placeholder="No folder chosen — or type a path">
        <button class="secondary" id="chooseFolderBtn">Choose&hellip;</button>
      </div>
      <button class="primary" id="refineBtn">Analyze</button>
      <div id="refineResults" style="display:none;margin-top:18px;"></div>
    </div>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
let currentToken = null, currentControlPlaneUrl = null;

// Every value below (guide steps, component names, tags) comes from this
// user's own tenant, not from another user's input — but it's still text
// going into innerHTML, so it's still escaped. A literal "<role>" in a
// guide string (connections.ts's own placeholder convention) must render
// as visible text, not get parsed as an unknown HTML tag and silently
// dropped — which is what happened before this existed.
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  $(id).classList.add("active");
}

async function api(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || "something went wrong");
  return json;
}

$("drop").addEventListener("click", () => $("fileInput").click());
$("drop").addEventListener("dragover", (e) => { e.preventDefault(); $("drop").classList.add("over"); });
$("drop").addEventListener("dragleave", () => $("drop").classList.remove("over"));
$("drop").addEventListener("drop", (e) => {
  e.preventDefault();
  $("drop").classList.remove("over");
  const file = e.dataTransfer.files[0];
  if (file) readSetupFile(file);
});
$("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) readSetupFile(file);
});
function readSetupFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      $("tenantUrl").value = parsed.control_plane_url || "";
      $("code").value = parsed.token || "";
      $("drop").textContent = "Loaded " + file.name;
    } catch {
      showError("activateError", "that doesn't look like a valid .armsetup file");
    }
  };
  reader.readAsText(file);
}

function showError(id, message) {
  const el = $(id);
  el.textContent = message;
  el.style.display = "block";
}

$("installBtn").addEventListener("click", async () => {
  $("activateError").style.display = "none";
  const tenantUrl = $("tenantUrl").value.trim();
  const code = $("code").value.trim();
  if (!tenantUrl || !code) {
    showError("activateError", "enter your company's ARM URL and activation code");
    return;
  }
  showScreen("screen-installing");
  try {
    const result = await api("/api/redeem", { token: code, controlPlaneUrl: tenantUrl });
    renderComplete(result);
    showScreen("screen-complete");
  } catch (err) {
    showScreen("screen-activate");
    showError("activateError", err.message);
  }
});

function renderComplete(result) {
  $("onlineBadge").textContent = result.online ? "online" : "offline";
  $("onlineBadge").style.background = result.online ? "#ECFDF5" : "#FEF2F2";
  $("onlineBadge").style.color = result.online ? "#16A34A" : "#DC2626";
  $("completeHelp").textContent = result.pendingApproval
    ? "Your agent is installed — tool access is waiting on your manager's approval."
    : "Your agent is installed and ready to use.";
  $("sumRole").textContent = result.roleKey;
  $("sumPackage").textContent = result.roleKey + "@" + result.packageVersion;
  $("sumBudget").textContent = result.budgetHint;
  $("sumComponents").textContent = result.components.join(", ") || "(none)";
  if (result.runtimesProvisioned && result.runtimesProvisioned.length > 0) {
    $("sumRuntimesRow").style.display = "flex";
    $("sumRuntimes").textContent = result.runtimesProvisioned.join(", ");
  }
  const list = $("connectionsList");
  list.innerHTML = "";
  if (result.connectionsNeeded && result.connectionsNeeded.length > 0) {
    $("connectionsSection").style.display = "block";
    for (const c of result.connectionsNeeded) {
      const div = document.createElement("div");
      div.className = "conn";
      div.innerHTML = "<div class=\\"name\\">" + escapeHtml(c.componentName) + " &middot; " + escapeHtml(c.authMethod) + "</div>" +
        "<ol>" + c.guideSteps.map((s) => "<li>" + escapeHtml(s) + "</li>").join("") + "</ol>";
      list.appendChild(div);
    }
  }
}

$("chooseFolderBtn").addEventListener("click", async () => {
  const result = await api("/api/pick-folder", {});
  if (result.path) $("folderPath").value = result.path;
});

$("refineBtn").addEventListener("click", async () => {
  const btn = $("refineBtn");
  btn.disabled = true;
  btn.textContent = "Analyzing\\u2026";
  try {
    const result = await api("/api/refine", { painPoints: $("painPoints").value, folderPath: $("folderPath").value });
    renderRefine(result);
  } finally {
    btn.disabled = false;
    btn.textContent = "Analyze";
  }
});

function renderRefine(result) {
  const el = $("refineResults");
  el.style.display = "block";
  let html = "";
  if (result.painPointTags && result.painPointTags.length > 0) {
    html += "<div class=\\"section-title\\">Pain-point signals</div>";
    for (const t of result.painPointTags) html += "<span class=\\"tag\\">" + escapeHtml(t.tag) + " \\u2192 " + escapeHtml(t.jobFunctionHint) + "</span>";
  }
  if (result.folderScan) {
    html += "<div class=\\"section-title\\">Work-folder tags</div>";
    for (const t of result.folderScan.tags) html += "<span class=\\"tag\\">" + escapeHtml(t) + "</span>";
    if (result.folderScan.tags.length === 0) html += "<span class=\\"step\\">nothing detected</span>";
  }
  if (result.installedTools && result.installedTools.length > 0) {
    html += "<div class=\\"section-title\\">Installed tools</div>";
    for (const t of result.installedTools) html += "<span class=\\"tag\\">" + escapeHtml(t.label) + "</span>";
  }
  html += "<p class=\\"footer-note\\" style=\\"text-align:left;margin-top:16px;\\">Share these with your ARM admin to fine-tune your package — installing again doesn't change anything automatically yet.</p>";
  el.innerHTML = html;
}
</script>
</body>
</html>
`;
