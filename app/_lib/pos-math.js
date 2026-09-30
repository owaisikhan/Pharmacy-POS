import { round2, toNumber } from "@/app/_lib/format-helpers";

// The bill preview on the sale screen. Mirrors create_sale() in
// supabase/migrations/0003_operations.sql step for step, so the figure on
// screen is the figure saved. The database's result is still the one used.
export function lineFigures(medicine, unit, qty, discountPercent) {
  const perPack = Math.max(1, toNumber(medicine.units_per_pack));
  const sellUnit = perPack === 1 ? "pack" : unit;
  const q = Math.max(0, Math.trunc(toNumber(qty)));
  const price = sellUnit === "pack" ? round2(medicine.sale_price_per_pack) : round2(toNumber(medicine.sale_price_per_pack) / perPack);
  const gross = round2(price * q);
  const pct = Math.min(100, Math.max(0, toNumber(discountPercent)));
  const discount = round2((gross * pct) / 100);
  const tax = round2(((gross - discount) * toNumber(medicine.tax_percent)) / 100);
  const units = sellUnit === "pack" ? q * perPack : q;
  return { unit: sellUnit, price, gross, discount, tax, total: round2(gross - discount + tax), units };
}

export function billFigures(lines, { billDiscount, cardAmount, creditAmount, tendered }) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.total, 0));
  const discount = Math.min(subtotal, Math.max(0, round2(billDiscount)));
  const total = round2(subtotal - discount);
  const card = Math.max(0, round2(cardAmount));
  const credit = Math.max(0, round2(creditAmount));
  const cashDue = round2(total - card - credit);
  const given = tendered === "" || tendered == null ? cashDue : round2(tendered);
  return { subtotal, discount, total, card, credit, cashDue, given, change: round2(given - cashDue) };
}
