// Money, quantities and dates. Safe on the server and in the browser, so
// every screen formats a figure the same way.

const money = new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TZ = "Asia/Karachi";

export function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function round2(n) {
  return Math.round((toNumber(n) + Number.EPSILON) * 100) / 100;
}

// "Rs 4,386,211.50". Pass the magnitude; direction is shown by the caller
// with a word or icon, never a bare minus sign in front of "Rs".
export function formatRs(value) {
  return `Rs ${money.format(Math.abs(toNumber(value)))}`;
}

export function formatCount(value) {
  return whole.format(toNumber(value));
}

// Same wording as the database's fmt_units(): "3 packs + 4 loose".
export function formatUnits(units, perPack = 1) {
  const n = Math.trunc(toNumber(units));
  const p = Math.max(1, Math.trunc(toNumber(perPack)));
  if (n === 0) return "none";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (p <= 1) return `${sign}${a}`;
  const packs = Math.floor(a / p);
  const loose = a % p;
  const packWord = packs === 1 ? "pack" : "packs";
  if (loose === 0) return `${sign}${packs} ${packWord}`;
  if (packs === 0) return `${sign}${loose} loose`;
  return `${sign}${packs} ${packWord} + ${loose} loose`;
}

export function unitPrice(packPrice, perPack) {
  return round2(toNumber(packPrice) / Math.max(1, toNumber(perPack)));
}

function parts(value) {
  const d = value instanceof Date ? value : new Date(value);
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(d);
  const get = (t) => f.find((p) => p.type === t)?.value ?? "";
  return { y: get("year"), m: Number(get("month")), d: get("day").padStart(2, "0"), h: get("hour"), min: get("minute"), ap: get("dayPeriod").toUpperCase() };
}

// A timestamp shown as a Pakistan date: "30 Sep 2026".
export function formatDate(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDay(value);
  const p = parts(value);
  return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}

export function formatTime(value) {
  if (!value) return "";
  const p = parts(value);
  return `${p.h}:${p.min} ${p.ap}`;
}

export function formatDateTime(value) {
  if (!value) return "";
  return `${formatDate(value)}, ${formatTime(value)}`;
}

// A plain calendar date from the database ("2026-09-30").
export function formatDay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

// Expiry is printed on packs as month and year: "Nov 2027".
export function formatExpiry(iso) {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}
