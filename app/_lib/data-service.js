import "server-only";
import { getSession } from "@/app/_lib/helpers";
import { addDays, todayPK } from "@/app/_lib/date-helpers";
import { siteConfig } from "@/app/_lib/siteConfig";

// Every read query lives here, so when a figure looks wrong there is one file
// to search. All queries run as the signed-in person: RLS applies.

const PAGE = siteConfig.pageSize;

async function db() {
  const { supabase } = await getSession();
  return supabase;
}

function fail(what, error) {
  console.error(`[data-service] ${what}:`, error?.message || error);
  throw new Error(`Could not load ${what}. Check the connection and refresh the page.`);
}

function range(page, size = PAGE) {
  const from = (Math.max(1, page) - 1) * size;
  return [from, from + size - 1];
}

// PostgREST .or() filters use commas and brackets as syntax; strip them from
// what people type.
function searchTerm(q) {
  return String(q || "").replace(/[,()*%\\]/g, " ").trim().slice(0, 60);
}

// Settings --------------------------------------------------------------------

export async function getSettings() {
  const supabase = await db();
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) fail("settings", error);
  return data;
}

export async function listStaff() {
  const supabase = await db();
  const { data, error } = await supabase.from("profiles").select("*").order("created_at");
  if (error) fail("staff", error);
  return data;
}

// Shifts ----------------------------------------------------------------------

export async function getOpenShift() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("shifts")
    .select("*, opener:profiles!shifts_opened_by_fkey(full_name)")
    .is("closed_at", null)
    .maybeSingle();
  if (error) fail("the open shift", error);
  if (!data) return null;
  const { data: summary, error: e2 } = await supabase.rpc("shift_summary", { p_shift_id: data.id });
  if (e2) fail("the shift summary", e2);
  return { ...data, summary };
}

export async function listShifts(page = 1) {
  const supabase = await db();
  const [from, to] = range(page);
  const { data, error, count } = await supabase
    .from("shifts")
    .select(
      "*, opener:profiles!shifts_opened_by_fkey(full_name), closer:profiles!shifts_closed_by_fkey(full_name)",
      { count: "exact" }
    )
    .not("closed_at", "is", null)
    .order("opened_at", { ascending: false })
    .range(from, to);
  if (error) fail("shifts", error);
  return { rows: data, count: count ?? 0 };
}

// Dashboard -------------------------------------------------------------------

export async function getDashboard() {
  const supabase = await db();
  const today = todayPK();
  const soon = addDays(today, 30);
  const [summary, low, lowCount, expiring, expiringCount, expired, recent] = await Promise.all([
    supabase.rpc("report_summary", { p_from: today, p_to: today }),
    supabase
      .from("medicine_stock")
      .select("id, name, strength, form, units_per_pack, sellable_units, reorder_level")
      .eq("active", true)
      .eq("is_low", true)
      .order("sellable_units")
      .limit(6),
    supabase.from("medicine_stock").select("id", { count: "exact", head: true }).eq("active", true).eq("is_low", true),
    supabase
      .from("batches")
      .select("id, batch_no, expiry_date, qty_on_hand, medicine:medicines(id, name, strength, units_per_pack)")
      .gt("qty_on_hand", 0)
      .gte("expiry_date", today)
      .lte("expiry_date", soon)
      .order("expiry_date")
      .limit(6),
    supabase
      .from("batches")
      .select("id", { count: "exact", head: true })
      .gt("qty_on_hand", 0)
      .gte("expiry_date", today)
      .lte("expiry_date", soon),
    supabase.from("batches").select("id", { count: "exact", head: true }).gt("qty_on_hand", 0).lt("expiry_date", today),
    supabase
      .from("sales")
      .select("id, invoice_no, created_at, total, customer:customers(name)")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  for (const [what, r] of Object.entries({ summary, low, lowCount, expiring, expiringCount, expired, recent })) {
    if (r.error) fail(`the dashboard (${what})`, r.error);
  }
  return {
    today,
    summary: summary.data,
    low: low.data,
    lowCount: lowCount.count ?? 0,
    expiring: expiring.data,
    expiringCount: expiringCount.count ?? 0,
    expiredCount: expired.count ?? 0,
    recent: recent.data,
  };
}

// Medicines -------------------------------------------------------------------

const MEDICINE_LIST_FIELDS =
  "id, name, generic_name, company, category, form, strength, units_per_pack, allow_loose, sale_price_per_pack, barcode, rack, reorder_level, rx_required, tax_percent, active, sellable_units, expired_units, next_expiry, is_low";

// For the sale screen: an exact barcode hit, else name or generic matches.
export async function searchSellable(q, limit = 12) {
  const supabase = await db();
  const term = searchTerm(q);
  if (!term) return [];
  const { data: exact, error: e1 } = await supabase
    .from("medicine_stock")
    .select(MEDICINE_LIST_FIELDS)
    .eq("active", true)
    .eq("barcode", term)
    .limit(1);
  if (e1) fail("medicines", e1);
  if (exact.length) return exact.map((m) => ({ ...m, barcodeHit: true }));

  const { data, error } = await supabase
    .from("medicine_stock")
    .select(MEDICINE_LIST_FIELDS)
    .eq("active", true)
    .or(`name.ilike.%${term}%,generic_name.ilike.%${term}%,company.ilike.%${term}%`)
    .order("name")
    .limit(limit);
  if (error) fail("medicines", error);
  // Names that start with the term first, then medicines with stock.
  const t = term.toLowerCase();
  return data.sort(
    (a, b) =>
      Number(b.name.toLowerCase().startsWith(t)) - Number(a.name.toLowerCase().startsWith(t)) ||
      Number(b.sellable_units > 0) - Number(a.sellable_units > 0) ||
      a.name.localeCompare(b.name)
  );
}

export async function listMedicines({ q = "", filter = "all", page = 1 } = {}) {
  const supabase = await db();
  const [from, to] = range(page);
  let query = supabase.from("medicine_stock").select(MEDICINE_LIST_FIELDS, { count: "exact" });
  const term = searchTerm(q);
  if (term) query = query.or(`name.ilike.%${term}%,generic_name.ilike.%${term}%,company.ilike.%${term}%,barcode.eq.${term}`);
  if (filter === "retired") query = query.eq("active", false);
  else query = query.eq("active", true);
  if (filter === "low") query = query.eq("is_low", true);
  if (filter === "out") query = query.eq("sellable_units", 0);
  if (filter === "expired") query = query.gt("expired_units", 0);
  const { data, error, count } = await query.order("name").range(from, to);
  if (error) fail("medicines", error);
  return { rows: data, count: count ?? 0 };
}

export async function getMedicine(id) {
  const supabase = await db();
  const { data, error } = await supabase.from("medicine_stock").select(MEDICINE_LIST_FIELDS + ", created_at").eq("id", id).maybeSingle();
  if (error) fail("the medicine", error);
  return data;
}

export async function getMedicineBatches(medicineId, withCost) {
  const supabase = await db();
  const fields = `id, batch_no, expiry_date, qty_on_hand, created_at, supplier:suppliers(name)${withCost ? ", cost_per_unit" : ""}`;
  const { data, error } = await supabase
    .from("batches")
    .select(fields)
    .eq("medicine_id", medicineId)
    .order("expiry_date");
  if (error) fail("batches", error);
  return data;
}

export async function getMedicineMovements(medicineId, limit = 30) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("stock_movements")
    .select("id, change_units, reason, ref_table, ref_id, note, created_at, batch:batches(batch_no), by:profiles(full_name)")
    .eq("medicine_id", medicineId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("stock history", error);
  return data;
}

export async function listCategories() {
  const supabase = await db();
  const { data, error } = await supabase.from("medicines").select("category, company").limit(5000);
  if (error) fail("categories", error);
  const uniq = (key) => [...new Set(data.map((r) => r[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return { categories: uniq("category"), companies: uniq("company") };
}

// Expiry ----------------------------------------------------------------------

export async function listExpiring({ window = "90", page = 1, withCost = false } = {}) {
  const supabase = await db();
  const today = todayPK();
  const [from, to] = range(page);
  let query = supabase
    .from("batches")
    .select(
      `id, batch_no, expiry_date, qty_on_hand${withCost ? ", cost_per_unit" : ""}, medicine:medicines(id, name, strength, form, units_per_pack, rack), supplier:suppliers(name)`,
      { count: "exact" }
    )
    .gt("qty_on_hand", 0);
  if (window === "expired") query = query.lt("expiry_date", today);
  else query = query.gte("expiry_date", today).lte("expiry_date", addDays(today, Number(window) || 90));
  const { data, error, count } = await query.order("expiry_date").order("id").range(from, to);
  if (error) fail("expiring stock", error);
  return { rows: data, count: count ?? 0, today };
}

// Sales -----------------------------------------------------------------------

export async function listSales({ date, q = "", page = 1 } = {}) {
  const supabase = await db();
  const [from, to] = range(page);
  let query = supabase
    .from("sales")
    .select(
      "id, invoice_no, created_at, total, cash_amount, card_amount, credit_amount, customer:customers(id, name), cashier:profiles!sales_cashier_id_fkey(full_name), sale_lines(count), returns(refund_amount)",
      { count: "exact" }
    );
  const term = searchTerm(q).toUpperCase();
  if (term) {
    query = query.ilike("invoice_no", `%${term}%`);
  } else if (date) {
    const start = new Date(`${date}T00:00:00+05:00`).toISOString();
    const end = new Date(`${addDays(date, 1)}T00:00:00+05:00`).toISOString();
    query = query.gte("created_at", start).lt("created_at", end);
  }
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) fail("bills", error);
  return { rows: data, count: count ?? 0 };
}

export async function getSale(id) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("sales")
    .select(
      `*, customer:customers(id, name, phone), cashier:profiles!sales_cashier_id_fkey(full_name),
       sale_lines(id, line_no, sale_unit, qty, qty_units, unit_price, discount_percent, discount_amount, tax_amount, line_total,
         medicine:medicines(id, name, strength, form, units_per_pack, rx_required),
         sale_line_batches(qty_units, qty_returned, batch:batches(batch_no, expiry_date))),
       returns(id, return_no, created_at, refund_method, refund_amount, note, by:profiles(full_name),
         return_lines(qty_units, amount, sale_line_id))`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) fail("the bill", error);
  if (data) {
    data.sale_lines.sort((a, b) => a.line_no - b.line_no);
    data.returns.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return data;
}

// Customers -------------------------------------------------------------------

export async function listCustomers({ q = "", filter = "all", page = 1 } = {}) {
  const supabase = await db();
  const [from, to] = range(page);
  let query = supabase.from("customer_balances").select("*", { count: "exact" }).eq("active", filter !== "retired");
  const term = searchTerm(q);
  if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
  if (filter === "owing") query = query.gt("balance", 0);
  const { data, error, count } = await query.order("name").range(from, to);
  if (error) fail("customers", error);
  return { rows: data, count: count ?? 0 };
}

export async function searchCustomers(q, limit = 8) {
  const supabase = await db();
  const term = searchTerm(q);
  if (!term) return [];
  const { data, error } = await supabase
    .from("customer_balances")
    .select("id, name, phone, balance, credit_limit")
    .eq("active", true)
    .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
    .order("name")
    .limit(limit);
  if (error) fail("customers", error);
  return data;
}

export async function getCustomer(id) {
  const supabase = await db();
  const { data, error } = await supabase.from("customer_balances").select("*").eq("id", id).maybeSingle();
  if (error) fail("the customer", error);
  return data;
}

// The whole ledger, oldest first, with the running balance worked out on the
// server, then shown newest first.
export async function getCustomerLedger(customerId) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("customer_ledger")
    .select("id, created_at, kind, charge, payment, method, note, sale:sales(id, invoice_no), by:profiles(full_name)")
    .eq("customer_id", customerId)
    .order("created_at")
    .order("id");
  if (error) fail("the account", error);
  let balance = 0;
  const rows = data.map((r) => {
    balance = Math.round((balance + Number(r.charge) - Number(r.payment)) * 100) / 100;
    return { ...r, balance };
  });
  return rows.reverse();
}

// Suppliers and purchases -----------------------------------------------------

export async function listSuppliers({ q = "", page = 1, all = false } = {}) {
  const supabase = await db();
  let query = supabase.from("supplier_balances").select("*", { count: "exact" });
  const term = searchTerm(q);
  if (term) query = query.ilike("name", `%${term}%`);
  query = query.order("name");
  if (!all) {
    const [from, to] = range(page);
    query = query.range(from, to);
  }
  const { data, error, count } = await query;
  if (error) fail("suppliers", error);
  return { rows: data, count: count ?? 0 };
}

export async function getSupplier(id) {
  const supabase = await db();
  const { data, error } = await supabase.from("supplier_balances").select("*").eq("id", id).maybeSingle();
  if (error) fail("the supplier", error);
  return data;
}

export async function getSupplierLedger(supplierId) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("supplier_ledger")
    .select("id, created_at, kind, bill, payment, method, note, purchase_id, by:profiles(full_name)")
    .eq("supplier_id", supplierId)
    .order("created_at")
    .order("id");
  if (error) fail("the supplier account", error);
  let balance = 0;
  const rows = data.map((r) => {
    balance = Math.round((balance + Number(r.bill) - Number(r.payment)) * 100) / 100;
    return { ...r, balance };
  });
  return rows.reverse();
}

export async function listPurchases({ page = 1, supplierId } = {}) {
  const supabase = await db();
  const [from, to] = range(page);
  let query = supabase
    .from("purchases")
    .select("id, supplier_invoice_no, purchase_date, total, paid_amount, created_at, supplier:suppliers(id, name), purchase_lines(count)", {
      count: "exact",
    });
  if (supplierId) query = query.eq("supplier_id", supplierId);
  const { data, error, count } = await query
    .order("purchase_date", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) fail("purchases", error);
  return { rows: data, count: count ?? 0 };
}

export async function getPurchase(id) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("purchases")
    .select(
      "*, supplier:suppliers(id, name), by:profiles(full_name), purchase_lines(id, batch_no, expiry_date, packs, bonus_packs, cost_per_pack, sale_price_per_pack, line_total, medicine:medicines(id, name, strength, form, units_per_pack))"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) fail("the purchase", error);
  if (data) data.purchase_lines.sort((a, b) => a.id - b.id);
  return data;
}

// Medicines for the purchase form's picker (every active medicine, small list).
export async function listMedicineOptions() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("medicines")
    .select("id, name, strength, form, units_per_pack, sale_price_per_pack")
    .eq("active", true)
    .order("name")
    .limit(5000);
  if (error) fail("medicines", error);
  return data;
}

// Reports ---------------------------------------------------------------------

export async function getReport(from, to) {
  const supabase = await db();
  const [summary, byDay, top, stock] = await Promise.all([
    supabase.rpc("report_summary", { p_from: from, p_to: to }),
    supabase.rpc("report_sales_by_day", { p_from: from, p_to: to }),
    supabase.rpc("report_top_medicines", { p_from: from, p_to: to, p_limit: 15 }),
    supabase.rpc("report_stock_value"),
  ]);
  for (const [what, r] of Object.entries({ summary, byDay, top, stock })) {
    if (r.error) fail(`the report (${what})`, r.error);
  }
  return { summary: summary.data, byDay: byDay.data, top: top.data, stock: stock.data };
}
