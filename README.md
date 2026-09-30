# Pharmacy POS

Sales counter, batch stock with expiry, customer credit (khata), supplier
accounts, cash shifts and reports for a retail pharmacy. Built with Next.js
and Supabase, deployed on Vercel.

## What it does

- **Sale screen.** Scan a barcode or type a name, generic or company. Sell
  by the pack or loose. Line and bill discounts. Pay by cash (change worked
  out), card, customer account, or split. Prints an 80mm receipt.
  Keys: `F2` search, `F4` cash received, `F9` complete, `Enter` new sale.
- **Stock by batch.** Every purchase line has a batch number and expiry.
  Sales always take the earliest expiry first. Expired stock can never be
  sold. Low stock and 30/60/90 day expiry lists.
- **Returns** against a bill, part or all. Stock goes back to its batch; the
  refund is the item's share of what was actually paid.
- **Customers** with credit limits and an account ledger.
- **Purchases** from suppliers, with bonus packs and invoice discount spread
  into the unit cost. Supplier balances and payments.
- **Cash shifts.** Count the drawer at open and close; the app shows what
  should be there and the difference.
- **Reports** (owner): net sales, gross profit on the exact batches sold,
  discounts, sales by day, top medicines, stock value.
- **Roles.** The first account is the owner. Later sign-ups wait until the
  owner switches them on. Staff sell; only the owner sees costs and profit,
  records purchases, changes prices and adjusts stock. Enforced by Postgres
  row level security, not just hidden buttons.

## Setting up

1. **Create a Supabase project** in the Mumbai region (`ap-south-1`).
2. **Apply the database.** In the Supabase SQL editor, run the files in
   `supabase/migrations/` in order: `0001` to `0004`.
3. **Auth settings.** Authentication > Providers > Email: keep email and
   password on. Turning "Confirm email" off lets staff sign in straight
   after signing up (the owner still has to switch them on).
4. **Environment.** Copy `.env.example` to `.env.local` and fill in the
   project URL and publishable key from Project Settings > API.
5. **Run it.** `npm install`, then `npm run dev`, and open
   http://localhost:3000.
6. **First account.** Sign up at `/signup`. The first account becomes the
   owner. Then in Settings enter the pharmacy's name, address, phone and
   licence number (printed on receipts).
7. **Deploy.** Import the repo on Vercel, add the two environment variables,
   deploy. `vercel.json` pins functions to Mumbai (`bom1`) beside the
   database.

## First day at the pharmacy

1. Owner: add suppliers (Suppliers), then medicines (Medicines > Add), or
   add medicines and then record the first purchase for each supplier
   invoice, with batch numbers and expiry. Stock appears as you save.
2. Staff: sign up, and the owner switches each account on in Settings.
3. At opening: Cash shifts > Open shift, enter the cash in the drawer.
4. Sell from New sale (`F2` from anywhere).
5. At closing: Cash shifts > Close shift, enter the counted cash.

## Development

- `npm run dev`, `npm run build`, `npm run lint`
- `npm run test:db`: builds a throwaway local Postgres database from the
  migrations and runs the money and stock scenarios (sales, FEFO, returns,
  credit limits, shifts, RLS). Needs Postgres 16 locally:
  `PGHOST=... PGPORT=... PGUSER=postgres npm run test:db`.
- Project rules are in `CLAUDE.md`; design rules in `docs/UI_CONVENTIONS.md`.
