@AGENTS.md

# Pharmacy POS

Point of sale, batch stock, expiry, customer credit, supplier accounts and
cash shifts for one retail pharmacy in Pakistan.

Built with the kodexa-builder skill (v1.4.0). Load it for any new feature or
design work, and log preferences, corrections and reversals to
`.claude/kodexa-learnings.md` as they happen. Money and stock work also
follows the small-business-ledger-app skill.

## Who uses it

- Young counter staff and the owner, on a desktop PC or laptop at the
  counter, with a USB barcode scanner. Denser tables (14px body), keyboard
  shortcuts on the sale screen (F2 search, F4 cash, F9 complete).
- Receipts: 80mm thermal printer through the browser print dialog.
- Money: PKR, shown as "Rs 1,234.00". Tax per medicine, 0 by default. No FBR.
- Offline: online now. All money and stock rules are in Postgres so the app
  can be packaged offline later (nextjs-to-electron skill) without rewrites.

Palette exceptions: none

## Stack and layout

Next.js 16 App Router, React 19, plain JavaScript, Tailwind v4 (tokens in
`app/_styles/globals.css`), Supabase (Postgres, RLS, password auth), Server
Actions returning `{ ok, message, ...extras }`, lucide-react, Vercel `bom1`.
House folder layout: `app/_components/<domain>/`, `app/_lib/`,
`app/(app)/` for signed-in pages, `supabase/migrations/`.

## Rules

- Every read in `app/_lib/data-service.js`, every write in `app/_lib/actions.js`.
- Money and stock change only through the Postgres functions in
  `supabase/migrations/0003_operations.sql`. They check the role, lock rows,
  compute every figure, and raise plain sentences (code P0001) that the
  app shows as-is via `describeError()`.
- Prices on the sale screen are a preview (`app/_lib/pos-math.js` mirrors
  `create_sale`). The database's figures are the ones saved.
- Quantities are base units (tablets). `formatUnits()` and SQL `fmt_units()`
  must say the same thing ("3 packs + 4 loose").
- Ledgers are append-only. Corrections are new rows.
- Migrations are numbered and never edited once applied to the live
  database. Until the first apply, 0001 to 0004 may still change.
- Run `npm run test:db` (needs a local Postgres 16, see
  `supabase/tests/run.sh`) after any SQL change. It never touches Supabase.
- No em or en dashes anywhere, including SQL messages and seed data.
- Business day is Asia/Karachi (`today_pk()`, `todayPK()`).
- Staff can read batch costs through the API (RLS is row-level); the UI
  hides cost and profit, and report functions return null to staff.
