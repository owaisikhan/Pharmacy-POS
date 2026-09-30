# UI conventions

## Reader

Young staff on a desktop at the counter, often with a scanner, sometimes the
owner checking figures at night. Dense but never cramped: 14px body, figures
larger than their labels, keyboard first on the sale screen.

## Tokens

All colours are role tokens in `app/_styles/globals.css`. One accent: deep
pharmacy green `--color-primary` (#17624f, 7.1:1 on white). Warm neutral
background. Danger red, warning amber and info blue each have a soft fill
for badges. No gradients, glass or glow. Type: IBM Plex Sans and Mono.

## Figures

- Money is `formatRs()`: "Rs 1,234.00", magnitude only. Direction is a word
  and an icon (`Balance`: "Owes", "Paid ahead", "We owe"), never a minus.
- Quantities are `formatUnits()`: "3 packs + 4 loose".
- Figures use `.num` (right aligned, tabular, never wrap).
- Dates: "30 Sep 2026", expiry "Nov 2027", all in Pakistan time.

## Components

- `PageHeader` for every page; `PageHeaderSkeleton` mirrors its line heights.
- Tables: `.table-wrap` + `.table` with a real `min-w-[..]` and an sr-only
  caption. Filters and pages in the URL (`FilterTabs`, `UrlSearch`,
  `Pager`, `DayPicker`), each carrying the other params.
- Forms in dialogs (`Dialog`, native `<dialog>`), no click-outside close.
  Success leaves as a toast (`useActionForm`), failure stays inline
  (`FormMessage`).
- Badges always carry a word; colour is never the only cue.
- Loading: PMC system. Global top bar + dimmed region for same-route
  navigation, `loading.js` skeletons with real headings for slow routes.
