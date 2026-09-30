"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionSession } from "@/app/_lib/helpers";
import { createClient } from "@/app/_lib/supabase-server";
import { isSupabaseConfigured } from "@/app/_lib/supabase-env";
import { describeError } from "@/app/_lib/errors";
import { formatRs } from "@/app/_lib/format-helpers";
import { isIsoDate } from "@/app/_lib/date-helpers";

// Every Server Action returns { ok, message, ...extras }, so one FormMessage
// and one toast feed render them all. Money and stock changes call the
// Postgres functions, which check the role again and compute every figure.

const text = (fd, key, max = 200) => String(fd.get(key) ?? "").trim().slice(0, max);
const num = (fd, key) => {
  const raw = String(fd.get(key) ?? "").trim().replace(/,/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
};
const int = (fd, key) => {
  const n = num(fd, key);
  return n === null || Number.isNaN(n) ? n : Math.trunc(n);
};
const bool = (fd, key) => fd.get(key) === "on" || fd.get(key) === "true";

function refresh() {
  revalidatePath("/", "layout");
}

function fail(message, extras = {}) {
  return { ok: false, message, ...extras };
}

// Auth -----------------------------------------------------------------------

export async function signIn(_prev, fd) {
  if (!isSupabaseConfigured()) return fail("The database is not connected yet.");
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return fail("Enter your email and password.", { email });
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const message = /confirm/i.test(error.message)
      ? "This email has not been confirmed yet. Open the link in the confirmation email, then sign in."
      : "The email or password is wrong.";
    return fail(message, { email });
  }
  redirect("/");
}

export async function signUp(_prev, fd) {
  if (!isSupabaseConfigured()) return fail("The database is not connected yet.");
  const fullName = text(fd, "full_name", 80);
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const values = { full_name: fullName, email };
  if (!fullName) return fail("Enter your name.", values);
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email address.", values);
  if (password.length < 8) return fail("Use a password of at least 8 characters.", values);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error) {
    const message = /registered|exists/i.test(error.message)
      ? "An account with this email already exists. Sign in instead."
      : describeError(error, error.message);
    return fail(message, values);
  }
  if (!data.session) {
    return { ok: true, message: "Account created. Open the confirmation link sent to your email, then sign in." };
  }
  redirect("/");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

// Settings and staff ---------------------------------------------------------

export async function updateSettings(_prev, fd) {
  const s = await actionSession({ admin: true });
  if (s.error) return fail(s.error);
  const values = {
    pharmacy_name: text(fd, "pharmacy_name", 80),
    address: text(fd, "address", 200),
    phone: text(fd, "phone", 60),
    licence_no: text(fd, "licence_no", 60),
    receipt_footer: text(fd, "receipt_footer", 300),
    updated_at: new Date().toISOString(),
  };
  if (!values.pharmacy_name) return fail("Enter the pharmacy name.");
  const { error } = await s.supabase.from("settings").update(values).eq("id", 1);
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: "Pharmacy details saved." };
}

export async function setStaff(userId, role, active) {
  const s = await actionSession({ admin: true });
  if (s.error) return fail(s.error);
  const { error } = await s.supabase.rpc("set_staff", { p_user_id: userId, p_role: role, p_active: active });
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: "Staff access updated." };
}

// Medicines ------------------------------------------------------------------

export async function saveMedicine(_prev, fd) {
  const s = await actionSession({ admin: true });
  if (s.error) return fail(s.error);
  const id = int(fd, "id");
  const values = {
    name: text(fd, "name", 120),
    generic_name: text(fd, "generic_name", 120),
    company: text(fd, "company", 120),
    category: text(fd, "category", 80),
    form: text(fd, "form", 40) || "Tablet",
    strength: text(fd, "strength", 60),
    units_per_pack: int(fd, "units_per_pack"),
    allow_loose: bool(fd, "allow_loose"),
    sale_price_per_pack: num(fd, "sale_price_per_pack") ?? 0,
    barcode: text(fd, "barcode", 64) || null,
    rack: text(fd, "rack", 40),
    reorder_level_packs: num(fd, "reorder_level_packs") ?? 0,
    rx_required: bool(fd, "rx_required"),
    tax_percent: num(fd, "tax_percent") ?? 0,
  };
  if (!values.name) return fail("Enter the medicine name.");
  if (!Number.isInteger(values.units_per_pack) || values.units_per_pack < 1 || values.units_per_pack > 1000)
    return fail("Units per pack must be a whole number from 1 to 1000 (1 for a bottle or tube).");
  if (Number.isNaN(values.sale_price_per_pack) || values.sale_price_per_pack < 0) return fail("Enter a valid sale price.");
  if (Number.isNaN(values.tax_percent) || values.tax_percent < 0 || values.tax_percent > 100)
    return fail("Tax must be between 0 and 100 percent.");
  if (Number.isNaN(values.reorder_level_packs) || values.reorder_level_packs < 0) return fail("Enter a valid reorder level.");

  const { reorder_level_packs, ...row } = values;
  row.reorder_level = Math.round(reorder_level_packs * values.units_per_pack);
  if (row.units_per_pack === 1) row.allow_loose = true;

  if (id) {
    const { error } = await s.supabase.from("medicines").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return fail(describeError(error));
    refresh();
    return { ok: true, message: `${row.name} saved.`, id };
  }
  const { data, error } = await s.supabase.from("medicines").insert(row).select("id").single();
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: `${row.name} added.`, id: data.id };
}

export async function setMedicineActive(id, active) {
  const s = await actionSession({ admin: true });
  if (s.error) return fail(s.error);
  const { error } = await s.supabase.from("medicines").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: active ? "Medicine is back on sale." : "Medicine retired. Its history is kept." };
}

export async function adjustStock(_prev, fd) {
  const s = await actionSession({ admin: true });
  if (s.error) return fail(s.error);
  const direction = text(fd, "direction");
  const qty = int(fd, "qty");
  const perPack = int(fd, "per_pack") || 1;
  const unit = text(fd, "unit");
  if (!qty || qty <= 0 || Number.isNaN(qty)) return fail("Enter a quantity of 1 or more.");
  const units = unit === "pack" ? qty * perPack : qty;
  const change = direction === "add" ? units : -units;
  const { data, error } = await s.supabase.rpc("adjust_stock", {
    p_batch_id: int(fd, "batch_id"),
    p_change: change,
    p_reason: text(fd, "reason"),
    p_note: text(fd, "note", 200),
  });
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: "Stock updated.", qtyOnHand: data.qty_on_hand };
}

// Customers ------------------------------------------------------------------

export async function saveCustomer(_prev, fd) {
  const s = await actionSession();
  if (s.error) return fail(s.error);
  const id = int(fd, "id");
  const row = {
    name: text(fd, "name", 100),
    phone: text(fd, "phone", 40),
    address: text(fd, "address", 200),
    notes: text(fd, "notes", 300),
  };
  if (!row.name) return fail("Enter the customer's name.");
  // Only the owner decides how much credit someone gets.
  if (s.isAdmin && fd.has("credit_limit")) {
    const limit = num(fd, "credit_limit") ?? 0;
    if (Number.isNaN(limit) || limit < 0) return fail("Enter a valid credit limit (0 means no limit).");
    row.credit_limit = limit;
  }
  if (id) {
    if (s.isAdmin && fd.has("active_present")) row.active = bool(fd, "active");
    const { error } = await s.supabase.from("customers").update(row).eq("id", id);
    if (error) return fail(describeError(error));
    refresh();
    return { ok: true, message: `${row.name} saved.`, id };
  }
  const { data, error } = await s.supabase.from("customers").insert(row).select("id, name, phone").single();
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: `${row.name} added.`, id: data.id, customer: { ...data, balance: 0, credit_limit: row.credit_limit ?? 0 } };
}

export async function receiveCustomerPayment(_prev, fd) {
  const s = await actionSession();
  if (s.error) return fail(s.error);
  const amount = num(fd, "amount");
  if (!amount || Number.isNaN(amount) || amount <= 0) return fail("Enter the amount received.");
  const { data, error } = await s.supabase.rpc("receive_customer_payment", {
    p_customer_id: int(fd, "customer_id"),
    p_amount: amount,
    p_method: text(fd, "method") || "cash",
    p_note: text(fd, "note", 200),
  });
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: `${formatRs(amount)} received.`, balance: data.balance };
}

export async function adjustCustomerBalance(_prev, fd) {
  const s = await actionSession({ admin: true });
  if (s.error) return fail(s.error);
  const amount = num(fd, "amount");
  if (!amount || Number.isNaN(amount) || amount <= 0) return fail("Enter an amount more than Rs 0.");
  const { error } = await s.supabase.rpc("adjust_customer_balance", {
    p_customer_id: int(fd, "customer_id"),
    p_kind: text(fd, "kind"),
    p_direction: text(fd, "direction"),
    p_amount: amount,
    p_note: text(fd, "note", 200),
  });
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: "Balance entry saved." };
}

// Suppliers ------------------------------------------------------------------

export async function saveSupplier(_prev, fd) {
  const s = await actionSession({ admin: true });
  if (s.error) return fail(s.error);
  const id = int(fd, "id");
  const row = {
    name: text(fd, "name", 120),
    phone: text(fd, "phone", 60),
    address: text(fd, "address", 200),
    notes: text(fd, "notes", 300),
  };
  if (!row.name) return fail("Enter the supplier's name.");
  if (id) {
    if (fd.has("active_present")) row.active = bool(fd, "active");
    const { error } = await s.supabase.from("suppliers").update(row).eq("id", id);
    if (error) return fail(describeError(error));
    refresh();
    return { ok: true, message: `${row.name} saved.`, id };
  }
  const { data, error } = await s.supabase.from("suppliers").insert(row).select("id").single();
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: `${row.name} added.`, id: data.id };
}

export async function paySupplier(_prev, fd) {
  const s = await actionSession({ admin: true });
  if (s.error) return fail(s.error);
  const amount = num(fd, "amount");
  if (!amount || Number.isNaN(amount) || amount <= 0) return fail("Enter the amount paid.");
  const { error } = await s.supabase.rpc("pay_supplier", {
    p_supplier_id: int(fd, "supplier_id"),
    p_amount: amount,
    p_method: text(fd, "method") || "cash",
    p_note: text(fd, "note", 200),
  });
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: `${formatRs(amount)} payment saved.` };
}

export async function adjustSupplierBalance(_prev, fd) {
  const s = await actionSession({ admin: true });
  if (s.error) return fail(s.error);
  const amount = num(fd, "amount");
  if (!amount || Number.isNaN(amount) || amount <= 0) return fail("Enter an amount more than Rs 0.");
  const { error } = await s.supabase.rpc("adjust_supplier_balance", {
    p_supplier_id: int(fd, "supplier_id"),
    p_kind: text(fd, "kind"),
    p_direction: text(fd, "direction"),
    p_amount: amount,
    p_note: text(fd, "note", 200),
  });
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: "Balance entry saved." };
}

// Selling --------------------------------------------------------------------

// Called from the sale screen with a plain object. Prices, totals and change
// are computed by create_sale in the database; the browser's figures are only
// a preview.
export async function completeSale(payload) {
  const s = await actionSession();
  if (s.error) return fail(s.error);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length === 0) return fail("The bill is empty. Add at least one medicine.");
  if (items.length > 200) return fail("A bill can hold up to 200 lines.");
  const body = {
    client_ref: payload.clientRef,
    customer_id: payload.customerId || null,
    note: String(payload.note || "").slice(0, 300),
    bill_discount: Number(payload.billDiscount) || 0,
    card_amount: Number(payload.cardAmount) || 0,
    credit_amount: Number(payload.creditAmount) || 0,
    tendered: payload.tendered === "" || payload.tendered == null ? null : Number(payload.tendered),
    items: items.map((i) => ({
      medicine_id: i.medicineId,
      unit: i.unit === "unit" ? "unit" : "pack",
      qty: Math.trunc(Number(i.qty) || 0),
      discount_percent: Number(i.discountPercent) || 0,
    })),
  };
  const { data, error } = await s.supabase.rpc("create_sale", { p: body });
  if (error) return fail(describeError(error));
  refresh();
  return {
    ok: true,
    message: `Bill ${data.invoice_no} saved.`,
    saleId: data.sale_id,
    invoiceNo: data.invoice_no,
    total: data.total,
    changeDue: data.change_due,
  };
}

export async function createReturn(payload) {
  const s = await actionSession();
  if (s.error) return fail(s.error);
  const lines = (payload?.lines || [])
    .map((l) => ({ sale_line_id: l.saleLineId, qty_units: Math.trunc(Number(l.qtyUnits) || 0) }))
    .filter((l) => l.qty_units > 0);
  if (lines.length === 0) return fail("Enter a quantity for at least one medicine to return.");
  const { data, error } = await s.supabase.rpc("create_return", {
    p: {
      client_ref: payload.clientRef,
      sale_id: payload.saleId,
      refund_method: payload.refundMethod,
      note: String(payload.note || "").slice(0, 300),
      lines,
    },
  });
  if (error) return fail(describeError(error));
  refresh();
  return {
    ok: true,
    message: `Return ${data.return_no} saved. Refund ${formatRs(data.refund_amount)}${payload.refundMethod === "account" ? " to the customer's account" : " in cash"}.`,
    returnNo: data.return_no,
    refund: data.refund_amount,
  };
}

// Purchases ------------------------------------------------------------------

export async function createPurchase(payload) {
  const s = await actionSession({ admin: true });
  if (s.error) return fail(s.error);
  const lines = Array.isArray(payload?.lines) ? payload.lines : [];
  if (lines.length === 0) return fail("Add at least one medicine to the purchase.");
  if (payload.purchaseDate && !isIsoDate(payload.purchaseDate)) return fail("Enter a valid purchase date.");
  const { data, error } = await s.supabase.rpc("create_purchase", {
    p: {
      supplier_id: payload.supplierId,
      supplier_invoice_no: String(payload.invoiceNo || "").slice(0, 60),
      purchase_date: payload.purchaseDate || null,
      discount: Number(payload.discount) || 0,
      paid_amount: Number(payload.paidAmount) || 0,
      paid_method: payload.paidMethod || "cash",
      note: String(payload.note || "").slice(0, 300),
      lines: lines.map((l) => ({
        medicine_id: l.medicineId,
        batch_no: String(l.batchNo || "").slice(0, 40),
        expiry_date: l.expiryDate,
        packs: Math.trunc(Number(l.packs) || 0),
        bonus_packs: Math.trunc(Number(l.bonusPacks) || 0),
        cost_per_pack: l.costPerPack === "" ? null : Number(l.costPerPack),
        sale_price_per_pack: Number(l.salePricePerPack) || 0,
      })),
    },
  });
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: `Purchase saved: ${formatRs(data.total)}. Stock is updated.`, purchaseId: data.purchase_id };
}

// Shifts ---------------------------------------------------------------------

export async function openShift(_prev, fd) {
  const s = await actionSession();
  if (s.error) return fail(s.error);
  const amount = num(fd, "opening_float");
  if (amount === null || Number.isNaN(amount) || amount < 0) return fail("Enter the cash in the drawer (0 if empty).");
  const { error } = await s.supabase.rpc("open_shift", { p_opening_float: amount, p_note: text(fd, "note", 200) });
  if (error) return fail(describeError(error));
  refresh();
  return { ok: true, message: `Shift opened with ${formatRs(amount)} in the drawer.` };
}

export async function closeShift(_prev, fd) {
  const s = await actionSession();
  if (s.error) return fail(s.error);
  const counted = num(fd, "counted_cash");
  if (counted === null || Number.isNaN(counted) || counted < 0) return fail("Enter the cash you counted in the drawer.");
  const { data, error } = await s.supabase.rpc("close_shift", { p_counted_cash: counted, p_note: text(fd, "note", 200) });
  if (error) return fail(describeError(error));
  refresh();
  const diff = Number(data.difference);
  const message =
    diff === 0
      ? "Shift closed. The drawer matches exactly."
      : `Shift closed. The drawer is ${formatRs(diff)} ${diff > 0 ? "over" : "short"}.`;
  return { ok: true, message, summary: data };
}
