# Pharmacy POS: build plan

## Who it is for

- **Users:** young counter staff and the owner, on a desktop PC or laptop at
  the counter, with a USB barcode scanner (it types the code and presses Enter).
- **Density:** denser tables, 14px body, keyboard shortcuts on the sale screen.
  Money never wraps or clips, and colour is never the only cue.
- **Receipts:** 80mm thermal printer through the browser print dialog.
- **Money:** Pakistani rupees (Rs). Tax is a per-medicine percentage, 0 by
  default. No FBR integration in v1.
- **Offline:** online now (Vercel + Supabase). Every money and stock rule lives
  in Postgres, so the app can later be packaged as an offline desktop app
  (Electron + bundled Postgres) without rewriting the rules.

## Stack (Kodexa house defaults)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router, React 19, plain JavaScript |
| Styling | Tailwind v4, tokens in `app/_styles/globals.css` |
| Data | Supabase Postgres, RLS, Auth (email + password only) |
| Writes | Server Actions returning `{ ok, message }`, calling Postgres RPCs |
| Reads | `app/_lib/data-service.js`, server-only |
| Icons | lucide-react |
| Deploy | Vercel, region `bom1`, Supabase `ap-south-1` |

## Modules

1. **Sign-in and roles.** `admin` (owner) and `staff` (cashier). The first
   account becomes admin; later sign-ups wait until the admin activates them.
2. **Medicines.** Name, generic, company, category, form, strength, units per
   pack (strip of 10), barcode, rack, reorder level, Rx-required flag, tax %.
3. **Suppliers** with a payable balance.
4. **Purchases (stock in).** A supplier invoice with lines: medicine, batch
   number, expiry, packs and loose units, cost and sale price. Each line
   creates or tops up a batch.
5. **Stock by batch.** Quantities kept in base units (tablets). Sales take the
   earliest expiry first (FEFO). Expired batches can never be sold.
6. **Sale screen (POS).** Scan or search, sell by pack or by loose unit, line
   and bill discount, pay by cash, card or customer credit, change shown,
   receipt printed. Prices come from the database, never from the browser.
7. **Returns** against a sale; cannot return more than was sold; stock goes
   back to the same batch.
8. **Customers** with a credit ledger (khata): credit sales and payments.
9. **Stock adjustments.** Damaged, expired write-off, count correction, each
   with a reason. Append-only movements; nothing is edited in place.
10. **Cash shifts.** Open with a float, close with counted cash; the app shows
    expected cash and the difference.
11. **Reports.** Today's sales and profit, sales by day, top medicines, low
    stock, expiring in 30/60/90 days, customer and supplier balances.
12. **Settings.** Pharmacy name, address, phone, licence number, receipt footer.
    Staff management (activate, deactivate, role).
13. **Audit log** of every money and stock action.

## Where the rules live (Postgres)

- `create_sale`, `create_return`, `create_purchase`, `adjust_stock`,
  `receive_customer_payment`, `pay_supplier`, `open_shift`, `close_shift`:
  each is one transaction, locks the batches it touches, and refuses with a
  sentence the cashier can act on.
- `batches.qty_on_hand >= 0` is a check constraint. Every change also writes a
  `stock_movements` row, so stock can be rebuilt from history.
- Money columns are `numeric(12,2)`. Totals are computed in the RPC.
- Reports are SQL functions, never sums of a capped list in the browser.
- RLS on every table: staff read and sell; only admin edits prices, adjusts
  stock, manages staff and sees profit.

## Build order

1. Scaffold, tokens, layout, loading system, docs.
2. Schema + RPCs as numbered migrations, tested against a local Postgres
   with a stub `auth` schema (no live database touched).
3. Auth, app shell, sidebar.
4. Medicines, suppliers, purchases.
5. POS sale screen and receipt.
6. Returns, customers and credit, stock adjustments, shifts.
7. Dashboard and reports, settings, staff.
8. Render checks at 1440 / 1280 / 1024, lint, build.
9. **Database:** connect Supabase, apply migrations, set env, deploy to Vercel.
