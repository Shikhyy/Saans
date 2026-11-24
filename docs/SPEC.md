# SAANS — design & engineering brief

**One line:** a breath budget for your household, rendered as the city you live in.

**The idea.** Time is space. You do not read a chart of today's air, you scroll through it: the
camera walks your neighbourhood from 5am to midnight and the haze, the sun and the street lights
move with the real hourly forecast. Your family's exposure counter rises as you go. Drag any routine
on the timeline and the counter and the sky change together. That is the whole product thesis — the
impact of a choice becomes a figure that moves under your thumb instead of a paragraph of advice.

## Who it is for

A household in a smog city: a parent deciding whether the 7am walk is safe, an asthmatic teenager,
an elder with a cough, a family still cooking on biomass. Secondarily a school or ward coordinator
deciding when 400 children take recess.

## Goals

- Turn a forecast into **decisions**, not information: when to go out, how to ventilate, what to
  change at home, what a switch actually buys.
- Make every number **traceable**: formula, source and worked example one click away at `/method`.
- Work for people the average demo forgets: keyboard only, screen reader, 200% zoom, reduced motion,
  no WebGL, 2G, Hindi.

## Non-goals

- Medical advice or diagnosis. The exposure index is a relative planning aid, labelled as an estimate.
- Sensor hardware, account systems, social feeds, or anything that stores personal data.
- Claiming to measure ambient pollution we did not measure. Ward mode is a bottom-up scenario model.

## Anti-goals

A page that looks premium but cannot answer "so what do I do at 7am?"; a chat box that invents
numbers; a 3D scene that is decoration rather than the simulator.

## Data

- **Open-Meteo Air Quality** (free, no key): hourly PM2.5, PM10, NO₂, SO₂, O₃, CO for 5 days.
- **Open-Meteo Forecast** (free, no key): hourly boundary-layer height, wind, temperature, humidity.
- **Open-Meteo Geocoding**: city search.
- All upstream calls happen server-side, cached 10 minutes, rate limited. The browser never holds a key.

## Domain model (pure, framework-free, unit tested)

| Module | Responsibility |
| --- | --- |
| `core/aqi.ts` | CPCB sub-indices and AQI, linear interpolation, dominant pollutant |
| `core/dose.ts` | Inhaled PM2.5 from concentration × minute ventilation × duration; WHO daily reference |
| `core/indoor.ts` | Single-zone mass balance, purifier CADR, Corsi-Rosenthal sizing, 90% clearance time |
| `core/planner.ts` | Clean-window search over the hourly forecast, routine dose, shift deltas |
| `core/impact.ts` | Mode switch: µg avoided, ₹, kg CO₂e, each with its factors |
| `core/ward.ts` | Household fuel-mix scenario: PM2.5 and CO₂e emitted, exposure saved |
| `core/schemas.ts` | Zod contracts for upstream data, API bodies, and model output |

## Screens

1. **Now** — full-bleed 3D city, live PM2.5, CPCB AQI, WHO multiple, one action.
2. **The clock** — sticky scene scrubbed by scroll: 05:00 → 24:00, haze/sun/lights follow the
   forecast, with a sentence explaining each inflection (inversion, boundary-layer break).
3. **Your day** — draggable routine timeline, per-member budgets, cleanest window, keyboard editing.
4. **Your home** — 3D cutaway room; dwelling/fuel/purifier controls; ranked, costed interventions.
5. **Your ward** — 1,000-household dot field; fuel-switch scenario; school recess window.
6. **Ask Saans** — GenAI writes the plan from computed facts only; deterministic fallback; EN/HI.
7. **/method** — formulas, sources, live test count, accessibility and security statements.

## Integrations that make it usable

- Installable PWA with offline last-known forecast.
- `.ics` calendar export of the clean window.
- Share-card PNG of the family plan, sized for a WhatsApp group.
- Deep link that encodes city + household profile so a plan can be sent to a relative.

## Art direction

Sodium-amber on charcoal, the palette of a hazy night street. Display type is **Archivo**, a sober
grotesque kept at regular weight even at display sizes — the register of a public health bulletin, not
a dashboard. Interface type is Archivo with tabular figures; Devanagari loads only when Hindi is
chosen. No gradients as decoration, no glass, no glows as chrome: the only light on the page comes
from the sky.

Motion: one signature move (the scroll-driven day), section entrances staggered 60–90ms, feedback on
every control, and a reduced-motion build that keeps all content and drops all travel.

## Engineering constraints

- `core/` imports nothing from React, the DOM or the network — 100% unit testable.
- Client JS budget 120KB gzip for the initial route; three.js loaded with the hero, not before.
- WebGL quality tiers by device; render pauses when the canvas leaves the viewport.
- CSP with nonces, no `innerHTML` for model output, Zod at every boundary, per-IP rate limits,
  SSRF allowlist on the geocoding proxy.
- WCAG 2.2 AA: keyboard-operable timeline, a data table that replaces the 3D scene for screen
  readers, visible focus, 44px targets, `prefers-reduced-motion`, 200% zoom without loss.

## Testing

Vitest for the domain (golden values from CPCB and WHO tables), React Testing Library for the
timeline and copilot, MSW for network, axe for accessibility assertions, Playwright for three flows.
Coverage gate on `core/` at 90%.
