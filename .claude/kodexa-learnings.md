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
