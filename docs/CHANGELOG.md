# Changelog

## 2026-09-30: first build

- Database: schema, RLS and Postgres functions for sales, returns,
  purchases, stock adjustments, shifts, customer and supplier accounts,
  reports. 40+ scenario checks in `supabase/tests/`.
- App: sale screen, bills and returns, medicines and batches, expiry,
  customers, cash shifts, purchases, suppliers, reports, settings and staff.
- Decisions:
  - Sale price lives on the medicine (updated by purchases), cost on the
    batch. One price at the counter, true profit per batch.
  - Invoice and return numbers are taken only after every check passes, so
    a refused bill never leaves a gap in the numbering (first version took
    the number up front; the tests showed gaps).
  - A sale needs an open shift, so every rupee of cash belongs to one
    drawer count.
  - Colleagues' names are readable by active staff (bills show who sold).
