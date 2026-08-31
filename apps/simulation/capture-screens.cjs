const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "..", "public", "real-data");
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { id: "overview", url: "http://localhost:3100/", name: "Overview" },
  { id: "spend", url: "http://localhost:3100/spend", name: "Spend" },
  { id: "agents", url: "http://localhost:3100/agents", name: "Agents" },
  { id: "access", url: "http://localhost:3100/access", name: "Access" },
  { id: "audit", url: "http://localhost:3100/audit", name: "Audit" },
  { id: "resources", url: "http://localhost:3100/resources", name: "Resources" },
  { id: "idp", url: "http://localhost:3100/idp", name: "IdP" },
];

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  for (const p of PAGES) {
    console.log(`  Capturing ${p.name}...`);
    await page.goto(p.url, { waitUntil: "networkidle0", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUT, `dashboard-${p.id}.png`), fullPage: false });
    console.log(`  ✓ dashboard-${p.id}.png`);
  }

  await browser.close();
  console.log("Done.");
})();
