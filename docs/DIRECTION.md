# SAANS — art direction (round 2)

Dealt with `design-taste-frontend` · direction **split-stage** ("The split stage") · seed **1564584871**
· sector health · tone editorial · `--keep palette` — the brand's sodium-amber on charcoal was kept,
and the type system was dealt with directly because the original faces no longer fit the register.

Compatible skills used: `build-awwwards-quality-sites` (acceptance bar),
`cinematic-gsap-lenis-motion-system` (motion layer). One smooth-scroll engine: **Lenis**. Three.js is
kept and given one job: it is the clock, not a backdrop.

## The idea

> On this page, **the winter inversion over Delhi** becomes **the fixed half of the screen that the
> rest of the page is read against** — the city never moves, your day scrolls past it.

Competitor test: swap in any AQI dashboard and the sentence dies, because the fixed half here is a
simulated Delhi at the actual forecast hour, scrubbed by the scroll, and the reading column is a
household's day. The category owns "a chart of the air"; only this page owns "the city is the clock".

**The one live thing:** drag a routine along the day and the household's inhaled-PM2.5 budget moves
under your thumb (keyboard: arrows, shift-arrows, Home/End).

## The argument (claim → proof, one line per section)

1. Your family has a breath budget — live CPCB AQI, PM2.5 against the WHO 15 µg/m³ limit.
2. The air is not one number, it is a day — the hour-by-hour forecast, scrubbed by the city panel.
3. Most of the day's cost sits in two or three routines — the per-routine inhaled mass.
4. You can move the day, not the forecast — the draggable timeline and the clean window.
5. The kitchen is a second smog season — the single-zone mass balance and the chulha.
6. Fixes rank by rupees per microgram — the costed intervention list.
7. One street can move the number — the household fuel-mix scenario and the school recess window.
8. Here is the plan in words — the model writes only from computed facts; the engine is the floor.
9. Take it with you — calendar file, share card, installable offline app.

## Composition

- One pair of margins, `clamp(16px, 2.2vw, 32px)`. Square corners everywhere. One button shape.
- **Split spread** (hero → the day's chapters → what it costs): left 46% sticky city panel at
  `100svh`, right 54% reading column, measure 46ch, padding 56px. A solid reading bar sits at the
  panel's foot (hour, PM2.5, boundary layer) so no large text ever crosses the picture.
- **The split breaks** for the planner, which needs the full width. Then: pinned heading with passing
  rows (home), square plate with spare text (ward), an itinerary slip with dot leaders and a zigzag
  foot (the plan), a full-bleed last photograph (CTA), photograph-half / menu-half footer.
- Five type steps only: display, head, lead, body, small. Body 17px in full ink.

## Motion

Signature: the pinned city scrubs 05:00 → 24:00 with the scroll; at the last chapter of the split the
panel crossfades over 1.6s to the real sodium-lamp photograph. Around it: word-mask headline reveals,
per-part section entrances (60–90ms), clip-path image reveals, a slow drift on the plates, magnetic
primary action, and feedback on every control. All of it drops to final state under
`prefers-reduced-motion`.

## Imagery (all found, all credited on the page and in the report)

| Slot | File | Credit |
| --- | --- | --- |
| Panel crossfade + CTA | `lamp` | "Delhi Smog" — AnkClix, CC BY-SA 4.0, Wikimedia Commons |
| Morning chapter | `station` | "Low visibility due to Smog at New Delhi Railway station…" — Sumita Roy Dutta, CC BY-SA 4.0 |
| Ward plate | `ward` | "Smog as visible in the Gurgaon area near Delhi on Nov 2016" — CC BY-SA 4.0 |
| Kitchen row | `chulha` | "A cooking pot placed on a earthen stove called Chulha, North India" — Hk31122002, CC BY-SA 4.0 |
| Footer plate | `tomb` | "Humayun's Tomb in foggy winter morning" — Rohit Agarwal, CC BY-SA 4.0 |
| Clean-window row | `place` | "Connaught Place sunset" — Ville Miettinen, CC BY 2.0 |

One treatment for all: `saturate(.62) contrast(1.04)`, square corners, cover crops. Files are stored
unmodified; the grade is a display filter, not a derivative. No honest CC clip of this subject exists
in the searched collections, so the moving picture is a slow drift on a plate.

## Before → after

`inspect.mjs` before: **6 FAIL, 7 WARN** — 0 pictures, 13px body, 9 of 10 screens near-empty,
eyebrows, index numbers, pinned text over the picture, 21 font sizes, grey body, little motion.
Every one of those is a target of this round.
