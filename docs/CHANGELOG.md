# Changelog

## 2026-10-01: live database and end-to-end test

- Migrations 0001 to 0005 applied to Supabase project `yerobtkhzlhsxdvwvkce`.
- 0005 revokes API access to internal helpers (`write_audit` could have been
  called by any signed-in account to write fake audit rows).
- A full pharmacy day was driven in Chromium against the live project
  (`scripts/dev/e2e.mjs`), then every test row and account was removed and
  the bill counters reset. Bugs it found, all fixed:
  - **Scanner Enter was ignored.** The Enter search and the typing search
    overlapped; the Enter handler threw away its own (correct) result as
    stale and said "Nothing matches". Now each search returns its answer
    to its caller; only the screen update is limited to the newest.
  - **Fast second scan was wiped.** With a far database, the first scan's
    add finished after the second barcode was typed and cleared it. Enter
    now uses the list on screen when it matches, and an add only clears the
    box if it still holds what that add was for.
  - **No confirmation after opening or closing a shift.** The success toast
    lived in an effect inside the form, and the form unmounts on success.
    `useActionForm` now raises the toast from the action call.
  - Purchase form medicine column too narrow; sale screen's remove column
    cut off at 1366px.

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
