// Starter runner for a repo's regression checks (copy into scripts/checks/ and
// add "check": "node scripts/checks/run.mjs" to package.json, with playwright
// as a dev dependency). One check per bug that looked fine by eye and passed
// the build.
// Run against a production build:
//
//   npm run build && npm start          (in one terminal)
//   npm run check                        (in another)
//   npm run check -- --base http://localhost:3123 --only overflow --pages /,/about
//
// A form check must never let a request reach the server unless --allow-submit
// is passed, and that only against a build made WITHOUT the database env:
// abort POSTs with page.route (see SKILL.md section 5). Exit code 1 on failure.

import { chromium } from "playwright";

// Add one module per bug that shipped or nearly did, and register it below.
import overflow from "./overflow.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
    return acc;
  }, [])
);

const BASE = args.base || "http://localhost:3000";
const ALL = { overflow };
const only = typeof args.only === "string" ? args.only.split(",") : Object.keys(ALL);

// In Claude Code on the web, Chromium is preinstalled at /opt/pw-browsers and
// must not be downloaded. Elsewhere, run `npx playwright install chromium` once.
const launch = { headless: true };
if (process.env.PLAYWRIGHT_BROWSERS_PATH === "/opt/pw-browsers") launch.executablePath = "/opt/pw-browsers/chromium";

try {
  await fetch(BASE);
} catch {
  console.error(`Nothing is answering at ${BASE}. Start the site first (npm run build && npm start).`);
  process.exit(1);
}

const browser = await chromium.launch(launch);
let failures = 0;

// Each check gets these and reports with ok(label, passed, detail).
const ctx = {
  base: BASE,
  browser,
  allowSubmit: Boolean(args["allow-submit"]),
  pages: typeof args.pages === "string" ? args.pages.split(",") : null,
  ok(label, passed, detail = "") {
    if (!passed) failures++;
    console.log(`  ${passed ? "ok  " : "FAIL"} ${label}${detail ? `  (${detail})` : ""}`);
  },
};

for (const name of only) {
  if (!ALL[name]) {
    console.error(`Unknown check "${name}". Choose from: ${Object.keys(ALL).join(", ")}`);
    process.exit(1);
  }
  console.log(`\n${name}`);
  try {
    await ALL[name](ctx);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${name} stopped: ${e.message.split("\n")[0]}`);
  }
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
