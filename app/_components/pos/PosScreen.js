"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import clsx from "clsx";
import { Banknote, CircleAlert, CreditCard, FileText, Minus, Plus, Printer, ScanBarcode, Search, Trash2, UserRound, X } from "lucide-react";
import { completeSale } from "@/app/_lib/actions";
import { billFigures, lineFigures } from "@/app/_lib/pos-math";
import { formatExpiry, formatRs, formatUnits, round2 } from "@/app/_lib/format-helpers";
import { useToast } from "@/app/_components/layout/ToastProvider";
import Spinner from "@/app/_components/ui/Spinner";
import Badge from "@/app/_components/ui/Badge";
import CustomerPicker from "@/app/_components/pos/CustomerPicker";
import { printReceipt } from "@/app/_components/pos/print-receipt";

const METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "account", label: "Account", icon: UserRound },
  { value: "split", label: "Split", icon: FileText },
];

function newRef() {
  return crypto.randomUUID();
}

// "Print receipt after sale" is a per-computer preference, kept in this
// browser only. The server always renders it on.
function readAutoPrint() {
  try {
    return localStorage.getItem("pos.autoPrint") !== "0";
  } catch {
    return true;
  }
}
function writeAutoPrint(on) {
  try {
    localStorage.setItem("pos.autoPrint", on ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event("pos-autoprint"));
}
function subscribeAutoPrint(cb) {
  window.addEventListener("pos-autoprint", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("pos-autoprint", cb);
    window.removeEventListener("storage", cb);
  };
}

export default function PosScreen() {
  const toast = useToast();
  const searchRef = useRef(null);
  const tenderedRef = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const searchSeq = useRef(0);
  // What the results on screen were fetched for, and what is typed now. Refs,
  // because the Enter handler reads them after an await.
  const resultsFor = useRef("");
  const queryNow = useRef("");

  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [method, setMethod] = useState("cash");
  const [billDiscount, setBillDiscount] = useState("");
  const [tendered, setTendered] = useState("");
  const [cardSplit, setCardSplit] = useState("");
  const [creditSplit, setCreditSplit] = useState("");
  const [note, setNote] = useState("");
  const [clientRef, setClientRef] = useState(newRef);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const autoPrint = useSyncExternalStore(subscribeAutoPrint, readAutoPrint, () => true);
  const [isPending, startTransition] = useTransition();

  // Figures ---------------------------------------------------------------
  const lines = useMemo(
    () => cart.map((c) => ({ ...c, ...lineFigures(c.medicine, c.unit, c.qty, c.discountPercent) })),
    [cart]
  );
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const discountValue = Math.min(subtotal, Math.max(0, Number(billDiscount) || 0));
  const totalPreview = round2(subtotal - discountValue);
  const cardAmount = method === "card" ? totalPreview : method === "split" ? Number(cardSplit) || 0 : 0;
  const creditAmount = method === "account" ? totalPreview : method === "split" ? Number(creditSplit) || 0 : 0;
  const bill = billFigures(lines, {
    billDiscount: discountValue,
    cardAmount,
    creditAmount,
    tendered: method === "cash" || method === "split" ? tendered : "",
  });
  const needsCustomer = bill.credit > 0 && !customer;
  const overPaid = bill.card + bill.credit > bill.total;
  const shortCash = bill.given < bill.cashDue;
  const stockProblems = lines.filter((l) => l.units > l.medicine.sellable_units);

  // Search ----------------------------------------------------------------
  // Every search returns its own answer to whoever asked. Only the newest
  // one may repaint the list. A scanner presses Enter within milliseconds of
  // typing, so the Enter search and the typing search overlap; the Enter
  // handler must act on its own result, never on whichever finished last.
  const runSearch = useCallback(async (q) => {
    const seq = ++searchSeq.current;
    if (!q.trim()) {
      setResults([]);
      setSearching(false);
      return [];
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/pos/medicines?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed.");
      if (seq === searchSeq.current) {
        resultsFor.current = q.trim();
        setResults(json.results);
        setSearchError("");
        setHighlight(0);
      }
      return json.results;
    } catch (e) {
      if (seq === searchSeq.current) setSearchError(e.message);
      return [];
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  // typed: the search text this add came from. A slow add must not wipe a
  // second scan that has already been typed into the box.
  const addToCart = useCallback((m, unit = "pack", typed) => {
    const sellUnit = m.units_per_pack === 1 ? "pack" : unit;
    setCart((list) => {
      const i = list.findIndex((c) => c.medicine.id === m.id && c.unit === sellUnit);
      if (i >= 0) {
        const next = [...list];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...list, { key: `${m.id}-${sellUnit}-${Date.now()}`, medicine: m, unit: sellUnit, qty: 1, discountPercent: "" }];
    });
    if (typed === undefined || queryNow.current === typed) {
      queryNow.current = "";
      setQuery("");
      setResults([]);
      setShowResults(false);
    }
    setError("");
    searchRef.current?.focus();
  }, []);

  async function onSearchKey(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setShowResults(true);
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Escape") {
      setShowResults(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Use the list on screen when it is for exactly what is typed; a scanner
      // is faster than the debounce, so otherwise search now, then add.
      const typed = query;
      const unit = e.shiftKey ? "unit" : "pack";
      const onScreen = resultsFor.current === typed.trim() && results.length > 0;
      const list = onScreen ? results : await runSearch(typed);
      const exact = list.find((r) => r.barcodeHit);
      const pick = exact || list[onScreen ? highlight : 0];
      if (pick) addToCart(pick, unit, typed);
      else if (typed.trim() && queryNow.current === typed) setSearchError(`Nothing matches "${typed.trim()}".`);
    }
  }

  // Cart ------------------------------------------------------------------
  function updateLine(key, changes) {
    setCart((list) => list.map((c) => (c.key === key ? { ...c, ...changes } : c)));
  }
  function removeLine(key) {
    setCart((list) => list.filter((c) => c.key !== key));
  }

  const resetBill = useCallback(() => {
    setCart([]);
    setCustomer(null);
    setMethod("cash");
    setBillDiscount("");
    setTendered("");
    setCardSplit("");
    setCreditSplit("");
    setNote("");
    setError("");
    setClientRef(newRef());
    setDone(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  }, []);

  // Complete --------------------------------------------------------------
  const canComplete = lines.length > 0 && !needsCustomer && !overPaid && !shortCash && !isPending && lines.every((l) => l.qty > 0);

  const submit = useCallback(() => {
    if (!canComplete) return;
    setError("");
    startTransition(async () => {
      const result = await completeSale({
        clientRef,
        customerId: customer?.id ?? null,
        note,
        billDiscount: discountValue,
        cardAmount: bill.card,
        creditAmount: bill.credit,
        tendered: method === "cash" || method === "split" ? (tendered === "" ? "" : Number(tendered)) : "",
        items: cart.map((c) => ({ medicineId: c.medicine.id, unit: c.unit, qty: c.qty, discountPercent: c.discountPercent })),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast(result);
      setDone(result);
      if (autoPrint) printReceipt(result.saleId);
    });
  }, [canComplete, clientRef, customer, note, discountValue, bill.card, bill.credit, method, tendered, cart, toast, autoPrint]);

  // Keys: F2 search, F4 cash received, F9 complete, Esc after a sale = new bill.
  useEffect(() => {
    const onKey = (e) => {
      if (done) {
        if (e.key === "Enter" || e.key === "Escape" || e.key === "F2") {
          e.preventDefault();
          resetBill();
        } else if (e.key.toLowerCase() === "p" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          printReceipt(done.saleId);
        }
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "F4") {
        e.preventDefault();
        setMethod((m) => (m === "cash" || m === "split" ? m : "cash"));
        setTimeout(() => tenderedRef.current?.focus(), 0);
      } else if (e.key === "F9" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, submit, resetBill]);

  const quickNotes = useMemo(() => {
    const due = bill.cashDue;
    if (due <= 0) return [];
    const set = new Set([due]);
    for (const step of [100, 500, 1000, 5000]) {
      const v = Math.ceil(due / step) * step;
      if (v >= due) set.add(v);
    }
    return [...set].sort((a, b) => a - b).slice(0, 4);
  }, [bill.cashDue]);

  // Render ----------------------------------------------------------------
  return (
    <div className="grid min-h-[calc(100dvh-7rem)] grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_21rem] sm:p-6">
      {/* Left: search and cart */}
      <section aria-label="Bill" className="flex min-w-0 flex-col gap-3">
        <div className="relative">
          <label htmlFor="pos-search" className="sr-only">Search medicine or scan barcode</label>
          <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-[var(--color-muted)]" aria-hidden />
          <input
            id="pos-search"
            ref={searchRef}
            autoFocus
            autoComplete="off"
            className="field h-12 pr-24 pl-11 text-base"
            placeholder="Scan a barcode or type a medicine, generic or company"
            value={query}
            onChange={(e) => {
              queryNow.current = e.target.value;
              setQuery(e.target.value);
              setShowResults(true);
              setSearchError("");
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            onKeyDown={onSearchKey}
            role="combobox"
            aria-expanded={showResults && results.length > 0}
            aria-controls="pos-results"
            aria-activedescendant={results[highlight] ? `pos-r-${results[highlight].id}` : undefined}
          />
          <span className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2 text-[var(--color-muted)]">
            {searching ? <Spinner /> : null}
            <span className="kbd">F2</span>
          </span>

          {showResults && query.trim() && (results.length > 0 || searchError) ? (
            <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
              {searchError ? (
                <p className="px-4 py-3 text-sm text-[var(--color-danger)]">{searchError}</p>
              ) : (
                <ul id="pos-results" role="listbox" className="max-h-[26rem] overflow-y-auto py-1">
                  {results.map((m, i) => {
                    const out = m.sellable_units <= 0;
                    return (
                      <li
                        key={m.id}
                        id={`pos-r-${m.id}`}
                        role="option"
                        aria-selected={i === highlight}
                        onMouseEnter={() => setHighlight(i)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addToCart(m, "pack");
                        }}
                        className={clsx(
                          "grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2",
                          i === highlight && "bg-[var(--color-primary-soft)]"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {m.name} {m.strength} <span className="font-normal text-[var(--color-muted)]">{m.form}</span>
                            {m.rx_required ? <Badge tone="info" className="ml-2">Rx</Badge> : null}
                          </p>
                          <p className="truncate text-xs text-[var(--color-muted)]">
                            {[m.generic_name, m.company, m.rack ? `Rack ${m.rack}` : null, m.units_per_pack > 1 ? `${m.units_per_pack} per pack` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="num text-sm font-semibold">{formatRs(m.sale_price_per_pack)}</p>
                          <p className={clsx("num text-xs", out ? "font-semibold text-[var(--color-danger)]" : "text-[var(--color-muted)]")}>
                            {out ? "Out of stock" : `${formatUnits(m.sellable_units, m.units_per_pack)}${m.next_expiry ? `, exp ${formatExpiry(m.next_expiry)}` : ""}`}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="border-t border-[var(--color-border-soft)] px-4 py-1.5 text-xs text-[var(--color-muted)]">
                <span className="kbd">Enter</span> add a pack · <span className="kbd">Shift</span>+<span className="kbd">Enter</span> add one loose ·{" "}
                <span className="kbd">↑</span> <span className="kbd">↓</span> choose
              </p>
            </div>
          ) : null}
        </div>

        <div className="table-wrap flex-1">
          <table className="table min-w-[42rem]">
            <caption className="sr-only">Medicines on this bill</caption>
            <thead>
              <tr>
                <th scope="col">Medicine</th>
                <th scope="col">Sell by</th>
                <th scope="col" className="text-center">Qty</th>
                <th scope="col" className="text-right">Price</th>
                <th scope="col" className="text-right">Disc %</th>
                <th scope="col" className="text-right">Amount</th>
                <th scope="col"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-[var(--color-muted)]">
                    <Search className="mx-auto mb-2 h-6 w-6" aria-hidden />
                    Scan a barcode or search above to start the bill.
                  </td>
                </tr>
              ) : (
                lines.map((l) => {
                  const m = l.medicine;
                  const short = l.units > m.sellable_units;
                  return (
                    <tr key={l.key}>
                      <td className="min-w-0">
                        <p className="font-semibold">
                          {m.name} {m.strength}
                          {m.rx_required ? <Badge tone="info" className="ml-2">Rx</Badge> : null}
                        </p>
                        <p className={clsx("text-xs", short ? "font-semibold text-[var(--color-danger)]" : "text-[var(--color-muted)]")}>
                          {short ? (
                            <span className="inline-flex items-center gap-1">
                              <CircleAlert className="h-3 w-3" aria-hidden />
                              Only {formatUnits(m.sellable_units, m.units_per_pack)} in stock
                            </span>
                          ) : (
                            `${m.form}${m.units_per_pack > 1 ? `, ${m.units_per_pack} per pack` : ""}${m.rack ? `, rack ${m.rack}` : ""}`
                          )}
                        </p>
                      </td>
                      <td>
                        {m.units_per_pack > 1 && m.allow_loose ? (
                          <div className="inline-flex rounded-lg border border-[var(--color-border)] p-0.5" role="group" aria-label="Sell by">
                            {["pack", "unit"].map((u) => (
                              <button
                                key={u}
                                type="button"
                                aria-pressed={l.unit === u}
                                onClick={() => updateLine(l.key, { unit: u })}
                                className={clsx(
                                  "rounded-md px-2 py-1 text-xs font-semibold",
                                  l.unit === u ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
                                )}
                              >
                                {u === "pack" ? "Pack" : "Loose"}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--color-muted)]">{m.units_per_pack > 1 ? "Pack only" : "Each"}</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" className="btn btn-ghost btn-sm px-1.5" aria-label={`One less ${m.name}`} onClick={() => updateLine(l.key, { qty: Math.max(1, l.qty - 1) })}>
                            <Minus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <input
                            aria-label={`Quantity of ${m.name}`}
                            inputMode="numeric"
                            className="field w-16 px-2 text-center tabular-nums"
                            value={l.qty}
                            onChange={(e) => updateLine(l.key, { qty: Math.max(0, Math.trunc(Number(e.target.value.replace(/\D/g, "")) || 0)) })}
                            onBlur={() => l.qty === 0 && updateLine(l.key, { qty: 1 })}
                          />
                          <button type="button" className="btn btn-ghost btn-sm px-1.5" aria-label={`One more ${m.name}`} onClick={() => updateLine(l.key, { qty: l.qty + 1 })}>
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                      <td className="num">{formatRs(l.price)}</td>
                      <td className="text-right">
                        <input
                          aria-label={`Discount percent on ${m.name}`}
                          inputMode="decimal"
                          className="field ml-auto w-16 px-2 text-right tabular-nums"
                          placeholder="0"
                          value={l.discountPercent}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d.]/g, "");
                            if (v === "" || Number(v) <= 100) updateLine(l.key, { discountPercent: v });
                          }}
                        />
                      </td>
                      <td className="num font-semibold">
                        {formatRs(l.total)}
                        {l.tax > 0 ? <p className="text-xs font-normal text-[var(--color-muted)]">incl. tax {formatRs(l.tax)}</p> : null}
                      </td>
                      <td className="text-right">
                        <button type="button" className="btn btn-ghost btn-sm px-1.5 text-[var(--color-danger)]" aria-label={`Remove ${m.name}`} onClick={() => removeLine(l.key)}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {lines.some((l) => l.medicine.rx_required) ? (
          <p className="flex items-center gap-2 rounded-lg bg-[var(--color-info-soft)] px-3 py-2 text-sm font-medium text-[var(--color-info)]">
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            This bill has a prescription (Rx) medicine. Check the prescription and note the doctor in the bill note.
          </p>
        ) : null}
      </section>

      {/* Right: customer, totals, payment */}
      <aside aria-label="Payment" className="flex flex-col gap-3">
        <div className="card p-4">
          <CustomerPicker value={customer} onChange={setCustomer} />
        </div>

        <div className="card flex flex-col gap-3 p-4">
          <dl className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Items</dt>
              <dd className="num">{lines.length}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Subtotal</dt>
              <dd className="num">{formatRs(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>
                <label htmlFor="bill-discount" className="text-[var(--color-muted)]">Bill discount (Rs)</label>
              </dt>
              <dd>
                <input
                  id="bill-discount"
                  inputMode="decimal"
                  className="field w-28 text-right tabular-nums"
                  placeholder="0"
                  value={billDiscount}
                  onChange={(e) => setBillDiscount(e.target.value.replace(/[^\d.]/g, ""))}
                  aria-invalid={Number(billDiscount) > subtotal || undefined}
                />
              </dd>
            </div>
          </dl>
          <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-border)] pt-3">
            <span className="text-sm font-semibold">Total</span>
            <span className="num text-3xl font-bold tracking-tight">{formatRs(bill.total)}</span>
          </div>
        </div>

        <div className="card flex flex-col gap-3 p-4">
          <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-4 gap-1">
            {METHODS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={method === value}
                onClick={() => setMethod(value)}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs font-semibold",
                  method === value
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          {method === "split" ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="split-card" className="label">Card (Rs)</label>
                <input id="split-card" inputMode="decimal" className="field text-right tabular-nums" placeholder="0" value={cardSplit} onChange={(e) => setCardSplit(e.target.value.replace(/[^\d.]/g, ""))} />
              </div>
              <div>
                <label htmlFor="split-credit" className="label">On account (Rs)</label>
                <input id="split-credit" inputMode="decimal" className="field text-right tabular-nums" placeholder="0" value={creditSplit} onChange={(e) => setCreditSplit(e.target.value.replace(/[^\d.]/g, ""))} />
              </div>
            </div>
          ) : null}

          {method === "cash" || method === "split" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="tendered" className="text-sm font-semibold">
                  Cash received <span className="kbd">F4</span>
                </label>
                <input
                  id="tendered"
                  ref={tenderedRef}
                  inputMode="decimal"
                  className="field w-36 text-right text-base tabular-nums"
                  placeholder={bill.cashDue.toFixed(2)}
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ""))}
                  aria-invalid={shortCash || undefined}
                />
              </div>
              {quickNotes.length > 0 ? (
                <div className="flex flex-wrap justify-end gap-1">
                  {quickNotes.map((v) => (
                    <button key={v} type="button" className="btn btn-secondary btn-sm tabular-nums" onClick={() => setTendered(String(v))}>
                      {v === bill.cashDue ? "Exact" : formatRs(v).replace(".00", "")}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
                <span className="text-sm font-semibold">{shortCash ? "Still to collect" : "Change to give"}</span>
                <span className={clsx("num text-2xl font-bold", shortCash && "text-[var(--color-danger)]")}>
                  {formatRs(shortCash ? bill.cashDue - bill.given : bill.change)}
                </span>
              </div>
            </>
          ) : null}

          {method === "card" ? <p className="text-sm text-[var(--color-muted)]">Charge {formatRs(bill.total)} on the card machine, then complete the sale.</p> : null}
          {method === "account" ? (
            <p className="text-sm text-[var(--color-muted)]">
              {customer ? `${formatRs(bill.total)} will be added to ${customer.name}'s account.` : "Choose a customer above to sell on account."}
            </p>
          ) : null}

          <div>
            <label htmlFor="bill-note" className="label">Note (optional)</label>
            <input id="bill-note" className="field" maxLength={300} placeholder="e.g. Dr. Saima, prescription seen" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {needsCustomer ? <Problem>Choose a customer to put {formatRs(bill.credit)} on their account.</Problem> : null}
          {overPaid ? <Problem>Card and account together are more than the total.</Problem> : null}
          {stockProblems.length > 0 ? (
            <Problem>
              Not enough stock for {stockProblems.map((l) => l.medicine.name).join(", ")}. Lower the quantity or the sale will be refused.
            </Problem>
          ) : null}
          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm font-medium text-[var(--color-danger)]">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          <button type="button" className="btn btn-primary h-12 text-base" disabled={!canComplete} onClick={submit}>
            {isPending ? (
              <>
                <Spinner /> Saving bill...
              </>
            ) : (
              <>
                Complete sale <span className="kbd border-white/40 bg-transparent text-white">F9</span>
              </>
            )}
          </button>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => writeAutoPrint(e.target.checked)}
              />
              Print receipt after sale
            </label>
            {cart.length > 0 ? (
              <button type="button" className="btn btn-ghost btn-sm text-[var(--color-danger)]" onClick={resetBill}>
                <X className="h-4 w-4" aria-hidden /> Clear bill
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      {done ? <SaleDone result={done} onNew={resetBill} /> : null}
    </div>
  );
}

function Problem({ children }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2 text-sm font-medium text-[var(--color-warning)]">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function SaleDone({ result, onNew }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="sale-done-title">
      <div className="card w-full max-w-sm p-6 text-center shadow-2xl">
        <p id="sale-done-title" className="text-sm font-semibold text-[var(--color-primary)]">Bill {result.invoiceNo} saved</p>
        <p className="mt-4 text-sm text-[var(--color-muted)]">Change to give</p>
        <p className="num text-center text-4xl font-bold tracking-tight">{formatRs(result.changeDue)}</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Bill total {formatRs(result.total)}</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => printReceipt(result.saleId)}>
            <Printer className="h-4 w-4" aria-hidden /> Print
          </button>
          <button type="button" className="btn btn-primary" onClick={onNew} autoFocus>
            New sale <span className="kbd border-white/40 bg-transparent text-white">Enter</span>
          </button>
        </div>
        <a href={`/sales/${result.saleId}`} className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline">
          Open this bill
        </a>
      </div>
    </div>
  );
}
