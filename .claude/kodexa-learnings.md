# kodexa-builder learnings

This file is how this repo teaches the kodexa-builder skill. Every session
that loads the skill reads it first and appends to it as the user corrects,
reverses or chooses things. Entries promoted into the skill are marked with
the version they landed in. See the skill's `references/self-improvement.md`
for the rules.

- **Project:** Pharmacy POS
- **Type:** dashboard (point of sale, stock, ledger)
- **Who reads it daily:** young counter staff and the owner, desktop PC with a barcode scanner
- **Palette exceptions:** none
- **Skill version when started:** 1.4.0

## Summary

| ID | Date | Kind | Lesson (short) | Scope | Status |
|---|---|---|---|---|---|
| L-001 | 2026-09-30 | gotcha | Gated pages were prerendered as a redirect when built without DB env | type: dashboard | logged |
| L-002 | 2026-09-30 | gap | No point-of-sale playbook: counter screen, receipts, shifts | type: dashboard | logged |
| L-003 | 2026-10-01 | gotcha | Success toast in an effect never fires when the action unmounts its own form | all | logged |
| L-004 | 2026-10-01 | gotcha | Barcode Enter races the debounced search; stale-guard dropped the right answer | type: dashboard | logged |
| L-005 | 2026-10-01 | gotcha | Security advisor: security-definer helpers callable via API (write_audit) | type: dashboard | logged |

## Entries

### L-001 · 2026-09-30 · medium · gotcha
- **Said / saw:** `next build` without Supabase env listed every signed-in route as static (○); `requireUser()` redirected to `/setup` at build time, which would have been baked in.
- **Context:** first build of Pharmacy POS before the database was connected.
- **Lesson:** Call `await connection()` (from `next/server`) at the top of the session helper and the gate, so auth-gated pages are always per request regardless of build-time env. Check the route table for ○ on gated pages after every build.
- **Scope:** type: dashboard
- **Target in skill:** references/types/dashboard.md, section 3
- **Status:** logged

### L-002 · 2026-09-30 · medium · gap
- **Said / saw:** "i need a POS system for a pharmacy which should work end to end"
- **Context:** no playbook covers a counter sale screen.
- **Lesson:** A POS adds to the dashboard playbook: keyboard-first sale screen (scanner Enter adds, F-keys), `client_ref` uuid on every sale so a double click cannot sell twice, prices computed in the database with a client preview that mirrors it, receipt printed through a hidden iframe (no pop-up blocker), shift open/close with expected vs counted cash, and invoice numbers taken after all checks so refusals leave no gaps.
- **Scope:** type: dashboard
- **Target in skill:** references/types/dashboard.md, new section
- **Status:** logged

### L-003 · 2026-10-01 · medium · gotcha
- **Said / saw:** e2e run: closing a shift never showed "drawer matches"; the close-shift form is removed when no shift is open.
- **Context:** Pharmacy POS, `useActionForm` toast in a `useEffect`.
- **Lesson:** Raise the success toast (and onSuccess) inside a wrapper around the Server Action passed to `useActionState`, not in an effect watching state. An action that changes what the page renders can unmount the form before its effect runs.
- **Scope:** all
- **Target in skill:** references/types/dashboard.md, section 7 (toast-context)
- **Status:** logged

### L-004 · 2026-10-01 · medium · gotcha
- **Said / saw:** e2e: scanning a barcode + Enter said "Nothing matches" while the API returned the medicine; a second fast scan was wiped by the first add.
- **Context:** POS search with a 200ms debounce and a sequence guard, database far away (Sydney).
- **Lesson:** A search should always return its result to its own caller; the sequence guard only decides who may repaint. An async add must clear the search box only if the box still holds the text that add came from. Test scanner flows with back-to-back scans and no waits.
- **Scope:** type: dashboard
- **Target in skill:** references/types/dashboard.md, new POS section (with L-002)
- **Status:** logged

### L-005 · 2026-10-01 · medium · gotcha
- **Said / saw:** Supabase security advisor lint 0029 listed `write_audit` and balance helpers as callable via /rest/v1/rpc.
- **Context:** `revoke ... from public, anon; grant ... to authenticated` on all functions granted internal helpers too.
- **Lesson:** After granting execute on all functions, revoke it again from authenticated for helpers only other functions call (audit writers, trigger functions, balance lookups). Run `get_advisors` after every migration.
- **Scope:** type: dashboard
- **Target in skill:** references/types/dashboard.md, section 3
- **Status:** logged
