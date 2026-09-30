// Turns a Supabase/Postgres error into a sentence for the person at the
// counter. Our own functions raise plain sentences (code P0001), which pass
// straight through; everything else is mapped here.

const DASHES = /[\u2012\u2013\u2014\u2015]/g;

export function cleanMessage(text) {
  return String(text ?? "").replace(DASHES, ", ").replace(/\s+,/g, ",").trim();
}

export function describeError(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  const code = error.code;
  const msg = error.message || "";

  if (code === "P0001") return cleanMessage(msg);
  if (code === "23505") {
    if (msg.includes("medicines_identity")) return "A medicine with this name, strength and form already exists.";
    if (msg.includes("barcode")) return "Another medicine already uses this barcode.";
    if (msg.includes("suppliers_name")) return "A supplier with this name already exists.";
    return "This record already exists.";
  }
  if (code === "23514") return "One of the figures is not allowed (for example a negative amount). Check the form and try again.";
  if (code === "42501" || /row-level security/i.test(msg)) return "Your account is not allowed to do this. Ask the owner.";
  if (code === "22P02") return "One of the values is not a valid number or date.";
  if (/fetch failed|network/i.test(msg)) return "Could not reach the database. Check the internet connection and try again.";
  return cleanMessage(fallback);
}
