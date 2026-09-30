// End-to-end walk through a pharmacy day, driving the real app in Chromium.
// WRITES TO WHATEVER DATABASE THE APP IS CONNECTED TO. Only run it against a
// database you are about to wipe, with test accounts created for it.
//   node scripts/dev/e2e.mjs http://localhost:3123 ./shots
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [BASE = "http://localhost:3123", OUT = "./shots"] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const OWNER = { email: "e2e-owner@pharmacy-test.invalid", password: "TestPass!2026" };
const STAFF = { email: "e2e-staff@pharmacy-test.invalid", password: "TestPass!2026" };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const problems = [];
let n = 0;

async function session(viewport = { width: 1366, height: 768 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) problems.push(`console ${m.type()} on ${page.url()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`page error on ${page.url()}: ${e.message}`));
  return { ctx, page };
}

async function shot(page, name) {
  n += 1;
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${String(n).padStart(2, "0")}-${name}.png`, fullPage: true });
}

async function login(page, who) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

async function expectToast(page, text) {
  await page.getByRole("status").filter({ hasText: text }).first().waitFor({ timeout: 20000 });
}

function step(name) {
  console.log(`- ${name}`);
}

try {
  // 1. Staff waits for approval --------------------------------------------
  step("staff signs in before approval");
  {
    const { ctx, page } = await session();
    await login(page, STAFF);
    await page.getByRole("heading", { name: "Waiting for the owner" }).waitFor();
    await shot(page, "staff-pending");
    await ctx.close();
  }

  // 2. Owner sets up the pharmacy -------------------------------------------
  const { page } = await session();
  step("owner signs in");
  await login(page, OWNER);
  await page.getByRole("heading", { name: /^Today,/ }).waitFor();
  await shot(page, "dashboard-empty");

  step("settings: pharmacy details and switch on staff");
  await page.goto(`${BASE}/settings`);
  await page.getByLabel("Pharmacy name").fill("Shifa Medical Store");
  await page.getByLabel("Address").fill("Shop 7, Main Bazaar, Gulberg, Lahore");
  await page.getByLabel("Phone").fill("042 3571 2345");
  await page.getByLabel("Drug sale licence number").fill("DSL-LHR-04417");
  await page.getByRole("button", { name: "Save details" }).click();
  await expectToast(page, "Pharmacy details saved");
  await page.getByRole("button", { name: "Switch on" }).click();
  await expectToast(page, "Staff access updated");
  await shot(page, "settings");

  step("add supplier");
  await page.goto(`${BASE}/suppliers`);
  await page.getByRole("button", { name: "Add supplier" }).click();
  await page.getByLabel("Name").fill("Muller and Phipps Lahore");
  await page.getByLabel("Phone").fill("042 111 222 333");
  await page.getByRole("dialog").getByRole("button", { name: "Add supplier" }).click();
  await page.waitForURL(/\/suppliers\/\d+/);

  step("add medicines");
  const meds = [
    { name: "Panadol", strength: "500mg", form: "Tablet", generic: "Paracetamol", company: "GSK", per: "10", price: "35", barcode: "8964000123457", rack: "A1", reorder: "5" },
    { name: "Augmentin", strength: "625mg", form: "Tablet", generic: "Amoxicillin + Clavulanic acid", company: "GSK", per: "6", price: "480", barcode: "8964000555501", rack: "C2", reorder: "3", rx: true },
    { name: "Brufen Syrup", strength: "100mg/5ml", form: "Syrup", generic: "Ibuprofen", company: "Abbott", per: "1", price: "185", barcode: "", rack: "D4", reorder: "4" },
  ];
  for (const m of meds) {
    await page.goto(`${BASE}/medicines/new`);
    await page.getByLabel("Brand name").fill(m.name);
    await page.getByLabel("Strength").fill(m.strength);
    await page.getByLabel("Form").selectOption(m.form);
    await page.getByLabel("Generic (salt)").fill(m.generic);
    await page.getByLabel("Company").fill(m.company);
    await page.getByLabel("Units per pack").fill(m.per);
    await page.getByLabel("Sale price per pack (Rs)").fill(m.price);
    await page.getByLabel("Reorder at (packs)").fill(m.reorder);
    if (m.barcode) await page.getByLabel("Barcode").fill(m.barcode);
    await page.getByLabel("Rack / shelf").fill(m.rack);
    if (m.rx) await page.getByLabel("Prescription only (Rx)").check();
    if (m === meds[0]) await shot(page, "medicine-form");
    await page.getByRole("button", { name: "Add medicine" }).click();
    await page.waitForURL(/\/medicines\/\d+$/);
  }

  step("record purchase with bonus and a short-expiry batch");
  await page.goto(`${BASE}/purchases/new`);
  await page.getByLabel("Supplier", { exact: true }).selectOption({ label: "Muller and Phipps Lahore" });
  await page.getByLabel("Supplier's invoice number").fill("MP-20931");
  const now = new Date();
  const month = (add) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + add, 1));
    return d.toISOString().slice(0, 7);
  };
  const lines = [
    ["Panadol 500mg (Tablet)", "p2291", month(14), "20", "2", "280", "350"],
    ["Panadol 500mg (Tablet)", "P1107", month(1), "3", "", "270", "350"],
    ["Augmentin 625mg (Tablet)", "AG5510", month(10), "10", "", "390", "480"],
    ["Brufen Syrup 100mg/5ml (Syrup)", "BR771", month(8), "12", "1", "150", "185"],
  ];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) await page.getByRole("button", { name: "Add line" }).click();
    const [med, batch, exp, packs, bonus, cost, sale] = lines[i];
    const L = `Line ${i + 1}`;
    await page.getByLabel(`${L} medicine`).fill(med);
    await page.getByLabel(`${L} batch number`).fill(batch);
    await page.getByLabel(`${L} expiry month`).fill(exp);
    await page.getByLabel(`${L} packs`, { exact: true }).fill(packs);
    if (bonus) await page.getByLabel(`${L} bonus packs`).fill(bonus);
    await page.getByLabel(`${L} cost per pack`).fill(cost);
    await page.getByLabel(`${L} sale price per pack`).fill(sale);
  }
  await page.getByLabel("Invoice discount (Rs)").fill("200");
  await page.getByLabel("Paid now (Rs)").fill("5000");
  await shot(page, "purchase-form");
  await page.getByRole("button", { name: "Save purchase and add stock" }).click();
  await page.waitForURL(/\/purchases\/\d+$/, { timeout: 20000 });
  await shot(page, "purchase-saved");

  step("add a credit customer");
  await page.goto(`${BASE}/customers`);
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Name").fill("Ahmed Raza");
  await page.getByLabel("Phone").fill("0300 1234567");
  await page.getByLabel("Credit limit (Rs)").fill("3000");
  await page.getByRole("dialog").getByRole("button", { name: "Add customer" }).click();
  await page.waitForURL(/\/customers\/\d+$/);

  // 3. Counter day ---------------------------------------------------------
  step("pos without a shift asks to open one");
  await page.goto(`${BASE}/pos`);
  await page.getByText("Open a shift to start selling").waitFor();
  await page.getByLabel("Cash in the drawer now (Rs)").fill("5000");
  await page.getByRole("button", { name: "Open shift" }).click();
  await page.getByLabel("Search medicine or scan barcode").waitFor({ timeout: 20000 });

  step("sale 1: scan, search, loose units, discount, cash");
  const search = page.getByLabel("Search medicine or scan barcode");
  await search.fill("8964000123457");
  await search.press("Enter");
  await page.getByRole("cell", { name: /Panadol 500mg/ }).first().waitFor();
  await search.fill("augm");
  await page.getByRole("option", { name: /Augmentin/ }).waitFor();
  await search.press("Enter");
  await search.fill("panad");
  await page.getByRole("option", { name: /Panadol/ }).waitFor();
  await search.press("Shift+Enter");
  await search.fill("brufen");
  await page.getByRole("option", { name: /Brufen/ }).waitFor();
  await search.press("Enter");
  await page.getByLabel("Quantity of Panadol").nth(1).fill("4");
  await page.getByLabel("Discount percent on Augmentin").fill("5");
  await page.getByLabel(/Cash received/).fill("1200");
  await shot(page, "pos-bill");
  await page.getByLabel("Print receipt after sale").uncheck();
  await page.keyboard.press("F9");
  await page.getByText(/Bill INV-\d{6} saved/).first().waitFor({ timeout: 20000 });
  await shot(page, "pos-done");
  const inv1 = (await page.locator("#sale-done-title").textContent()).match(/INV-\d{6}/)[0];
  console.log(`  saved ${inv1}`);
  await page.keyboard.press("Enter");

  step("sale 2: on account for Ahmed Raza");
  await search.fill("augm");
  await page.getByRole("option", { name: /Augmentin/ }).waitFor();
  await search.press("Enter");
  await page.getByLabel("Quantity of Augmentin").fill("2");
  await page.getByLabel("Customer", { exact: true }).fill("ahmed");
  await page.getByRole("option", { name: /Ahmed Raza/ }).click();
  await page.getByRole("radio", { name: "Account" }).click();
  await page.getByLabel("Note (optional)").fill("Dr. Saima Khan, prescription seen");
  await page.getByRole("button", { name: /Complete sale/ }).click();
  await page.getByText(/Bill INV-\d{6} saved/).first().waitFor({ timeout: 20000 });
  await page.keyboard.press("Enter");

  step("sale 3: credit limit refusal shows the database's sentence");
  await search.fill("augm");
  await page.getByRole("option", { name: /Augmentin/ }).waitFor();
  await search.press("Enter");
  await page.getByLabel("Quantity of Augmentin").fill("5");
  await page.getByLabel("Customer", { exact: true }).fill("ahmed");
  await page.getByRole("option", { name: /Ahmed Raza/ }).click();
  await page.getByRole("radio", { name: "Account" }).click();
  await page.getByRole("button", { name: /Complete sale/ }).click();
  await page.getByRole("alert").filter({ hasText: "credit limit" }).waitFor({ timeout: 20000 });
  await shot(page, "pos-credit-refused");
  await page.getByRole("button", { name: "Clear bill" }).click();

  step("receipt");
  await page.goto(`${BASE}/sales`);
  await page.getByRole("link", { name: inv1 }).click();
  await page.waitForURL(/\/sales\/\d+$/);
  const saleUrl = page.url();
  await shot(page, "bill-detail");
  const receipt = await browser.newPage({ viewport: { width: 400, height: 900 } });
  await receipt.context().addCookies(await page.context().cookies());
  await receipt.goto(saleUrl.replace("/sales/", "/receipt/"));
  await receipt.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-receipt.png`, fullPage: true });
  await receipt.close();

  step("return 2 loose Panadol in cash");
  await page.goto(saleUrl);
  await page.getByRole("button", { name: "Return items" }).click();
  await page.getByLabel("Loose units of Panadol to return").nth(1).fill("2");
  await shot(page, "return-dialog");
  await page.getByRole("button", { name: /^Refund Rs/ }).click();
  await expectToast(page, "Return RET-");
  await shot(page, "bill-after-return");

  step("customer pays part of the balance");
  await page.goto(`${BASE}/customers`);
  await page.getByRole("link", { name: "Ahmed Raza" }).click();
  await page.getByRole("button", { name: "Receive payment" }).click();
  await page.getByLabel("Amount received (Rs)").fill("500");
  await page.getByRole("button", { name: "Save payment" }).click();
  await expectToast(page, "received");
  await shot(page, "customer-account");

  step("write off the short-expiry batch as damaged");
  await page.goto(`${BASE}/medicines`);
  await shot(page, "medicines-list");
  await page.getByRole("link", { name: "Panadol 500mg" }).click();
  await page.getByRole("row", { name: /P1107/ }).getByRole("button", { name: "Adjust" }).click();
  await page.getByLabel("Reason").selectOption("damaged");
  await page.getByLabel("Quantity").fill("1");
  await page.getByRole("button", { name: "Remove stock" }).click();
  await expectToast(page, "Stock updated");
  await shot(page, "medicine-detail");

  for (const [path, name] of [["/expiry?window=30", "expiry"], ["/", "dashboard"], ["/reports", "reports"], ["/suppliers", "suppliers"], ["/purchases", "purchases"]]) {
    step(`view ${path}`);
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    await shot(page, name);
  }

  step("close the shift");
  await page.goto(`${BASE}/shifts`);
  await shot(page, "shift-open");
  const expected = (await page.locator("text=Cash that should be in the drawer").locator("..").locator(".num").textContent()).replace(/[^\d.]/g, "");
  await page.getByRole("button", { name: "Close shift" }).click();
  await page.getByLabel("Cash you counted (Rs)").fill(expected);
  await page.getByText("The drawer matches exactly.").waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Close shift" }).click();
  await expectToast(page, "Shift closed");
  await shot(page, "shift-closed");

  // 4. Staff view ----------------------------------------------------------
  step("staff: no owner pages, no profit");
  {
    const { ctx, page: sp } = await session();
    await login(sp, STAFF);
    await sp.getByRole("heading", { name: /^Today,/ }).waitFor();
    if (await sp.getByRole("link", { name: "Purchases" }).count()) problems.push("staff sees Purchases in the sidebar");
    if (await sp.getByText("Profit today").count()) problems.push("staff sees profit");
    await shot(sp, "staff-dashboard");
    await sp.goto(`${BASE}/reports`);
    await sp.waitForURL(/denied=1/, { timeout: 10000 }).catch(() => problems.push(`staff reached /reports: ${sp.url()}`));
    await ctx.close();
  }

  step("phone width sale screen");
  {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/pos`);
    await shot(page, "phone-pos");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) problems.push("horizontal scroll at 390px on /pos");
  }
} catch (e) {
  problems.push(`FAILED: ${e.message.split("\n")[0]}`);
  console.error(e);
  for (const c of browser.contexts()) for (const p of c.pages()) await p.screenshot({ path: `${OUT}/zz-failure-${n}.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

console.log(problems.length ? `\nPROBLEMS:\n${problems.join("\n")}` : "\nALL STEPS PASSED, console clean");
process.exit(problems.length ? 1 : 0);
