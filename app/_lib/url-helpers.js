// Build a link that changes some query params and keeps every other one, so a
// filter, a sort header and the pager never silently reset each other.
export function hrefWith(pathname, current, changes) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current || {})) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  for (const [k, v] of Object.entries(changes || {})) {
    if (v === undefined || v === null || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function pageNumber(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
