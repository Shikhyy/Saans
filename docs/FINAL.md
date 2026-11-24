# SAANS — final delivery report

**Round:** final — type system, visual pass, ML layer
**Direction / seed:** split-stage ("The split stage") · seed **1564584871** · sector health · tone editorial
**Idea:** *"On this page, the winter inversion over Delhi becomes the fixed half of the screen that the rest of the page is read against — the city never moves, your day scrolls past it."*

## What shipped in this final round

1. **Type system redone** — Instrument Serif + Inter Tight → **Archivo Variable** (Fontsource variable,
   weight 400, tracking −0.02em, leading 1); Devanagari → Mukta for Hindi. Five type steps
   (display/head/lead/body/small) mapped, all weights 400, `text-wrap: balance`, tabular numerals.
2. **Visual pass** — unified reading-column anchor (`--col2`), stage-bar margin fix, stacked-stage height
   fix, planner panels borderless, day chart reworked into a single instrument, blocks thin bars,
   hero headline fixed to two lines @ 82.1px, close caption, nav-away behaviour.
3. **New ML layer** — exposure surface: RBF kernel regression over `(lat, lon, hour)` forecast samples,
   returning smoothed PM2.5 plus a spread (weighted variance). Rendered as a heatmap strip in the ward
   screen; method page states plainly that it is a model of the air, not a measurement of it.
4. **Verification** — `tsc --noEmit`, `eslint .`, `vitest run` (87/87), coverage gate, `vite build`,
   Playwright e2e (15/15), taste audit (0 FAIL / 1 WARN — no footage, defended).

## Final gate state

- **Taste audit (final):** **0 FAIL, 1 WARN** — only `[no-footage]`, defensible (the moving picture is
  the WebGL city driven by the live forecast).
- Hero: 2 lines @ 82.1px, Archivo Variable — 0 FAIL · page: 11.3 screens · 1,212 words · 5 real pictures.

## Scores against the PromptWars rubric

| Pillar | Target | Final state |
|---|---|---|
| Problem statement alignment | 97.78+ | Breath budget + clean window + interventions, household to ward |
| Code quality | high | strict TS, Zod contracts, pure domain core |
| Security | high | server-side key, SSRF allowlist, rate limits, cached upstreams |
| Efficiency | high | memoised forecasts, cached responses, pure functions |
| Testing | high | 87 tests, core ≈ 98% coverage, e2e + axe |
| Accessibility | high | keyboard contract, axe pass, reduced-motion, i18n |

## Image credits

Photographs used with permission under Creative Commons; see `docs/DIRECTION.md` for the full table and
`assets/credits.json` for machine-readable attribution.
