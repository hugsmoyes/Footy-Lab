# Footy Lab: brand kit

## Symbol: the flask
A lab flask whose body has a footy (a pointed oval with three laces) cut through it. It reads as a flask at 16px and as a ball up close.
- `fl-mark.svg` ink, `fl-mark-white.svg` for dark backgrounds, `fl-mark-red.svg` accent.
- `fl-tile.svg` app tile: ink square, white flask, red ball. This is the favicon.
- `fl-construction.svg` the mark's construction drawing (guides and bezier handles), used faintly behind page titles.
- `fl-badge.svg`, `fl-badge-white.svg`, `fl-badge-ink.svg` circular sticker: FOOTY LAB • CHECK THE NUMBERS.

## Wordmark
FOOTY LAB in Archivo, width 125, weight 900, all caps.
- `fl-logo.svg` symbol + wordmark (light backgrounds), `fl-logo-on-dark.svg`.
- `fl-logo-stacked.svg` FOOTY / LAB.
- `fl-wordmark.svg`, `fl-wordmark-white.svg` wordmark only.

## Favicons
`/favicon.svg`, `/favicon.ico` (16, 32, 48), `/apple-touch-icon.png` (180), `assets/brand/icon-192.png`, `assets/brand/icon-512.png`, `/site.webmanifest`.

## Colour
| Token | Hex | Use |
|---|---|---|
| Ink | #141414 | text, primary buttons, active controls |
| Background | #f1f0ec | page |
| Sheet | #ffffff | cards and panels |
| Line | #e3e1db | hairlines |
| Red | #f2542d (text #c93a16) | brand accent, highlights |
| Yellow | #f6c453 | badge, forwards in charts |
| Purple | #9b7bf0 | rucks in charts |
| Blue | #6c8cf5 | defenders in charts |
| Green | #1f9d55 | positive values, WAR bars (unchanged from the tools) |

## Type
- Display: Archivo, expanded (118 to 125%), weight 800 to 900, usually caps.
- Body: Inter.
- Labels and figures in small print: JetBrains Mono.
All three are self-hosted in `assets/fonts/`.

## Motion
- Page titles and hero sheets "print" in from the top, like a receipt from a slot.
- Panels slide up when their content changes. Bars grow from the baseline.
- The footer badge turns slowly. Everything is switched off under prefers-reduced-motion.

Independent analytics. Not affiliated with the AFL or VFL. No AFL or club marks are used.

The site lives at hugsmoyes.github.io/footy-lab/ (the GitHub repo is hugsmoyes/footy-lab).
