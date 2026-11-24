# SAANS — a breath budget for households in Delhi smog

**The city is the clock.**

SAANS turns live smog forecasts into a household breath budget: how much PM2.5 your family
actually inhales in a day against the WHO 2021 24-hour guideline, which hours of the day are clean,
what your home needs, and what each change costs — in particles, rupees and minutes.

![SAANS — the fold of the page, the split stage](docs/images/desktop-fold.jpg)

## The idea

On this page, **the winter inversion over Delhi** becomes **the fixed half of the screen that the rest of the page is read against** — the city never moves, your day scrolls past it.

> The category owns "a chart of the air". Only SAANS owns "the city is the clock".

Drag a routine along the day and the household's inhaled-PM2.5 budget moves under your thumb. The
forecast, the indoor mass balance and the costed interventions are computed in one place; the
interface just tells the story.

## What the app does

- **Live forecast** — Open-Meteo air quality + weather, hourly PM2.5 against the WHO budget of
  **15 µg/m³ × 1440 × 0.012 ≈ 259 µg/day**.
- **The day** — per-routine inhaled mass, cleanest window, costliest routine, best single move.
- **The home** — kitchen and dwelling mass balance, purifier economics, the second smog season.
- **The ward** — a household-level switching scenario, and now an **exposure surface** (kernel
  regression) rendered as a heatmap over the street.
- **The plan** — the deterministic engine, with an optional Gemini writer grounded in computed facts.

## Screenshots

### Desktop

<p align="center">
  <img src="docs/images/desktop-fold.jpg" alt="SAANS desktop fold" width="720" />
</p>

<p align="center">
  <img src="docs/images/desktop-page-01.jpg" alt="SAANS desktop chapter" width="720" />
</p>

<p align="center">
  <img src="docs/images/desktop-page-02.jpg" alt="SAANS desktop planner" width="720" />
</p>

<p align="center">
  <img src="docs/images/desktop-page-03.jpg" alt="SAANS desktop plan" width="720" />
</p>

### Tablet &amp; mobile

<p align="center">
  <img src="docs/images/tablet-fold.jpg" alt="SAANS tablet fold" width="520" />
</p>

<p align="center">
  <img src="docs/images/mobile-fold.jpg" alt="SAANS mobile fold" width="260" />
</p>

## How it works

### From forecast to breath

```mermaid
flowchart LR
    classDef saans fill:#131519,stroke:#ffae5c,color:#e9e9e6
    A["Open-Meteo · air quality + weather"] --> B["mergeSeries · groupDays"]
    B --> C["HourPoint[] · hour, PM2.5 …"]
    C --> D["dose · planner · indoor · ward"]
    D --> E["PlanFacts"]
    E --> F["composePlan · engine + Gemini"]
    F --> G["Plan: actions, window, impact"]
    class A,B,C,D,E,F,G saans
```

### Architecture

```mermaid
flowchart TB
    classDef client fill:#0b0c0e,stroke:#ffae5c,color:#e9e9e6
    classDef core fill:#131519,stroke:#3a3d44,color:#e9e9e6
    classDef server fill:#131519,stroke:#ffae5c,color:#e9e9e6
    classDef data fill:#131519,stroke:#3a3d44,color:#e9e9e6
    subgraph Client["Browser"]
        UI["Screens · Hero · Chapters · Day · Home · Ward · Plan · Close"]
        CORE["Domain core · pure TypeScript"]
        SCENE["Three.js scenes · CityScene · RoomScene"]
    end
    subgraph Server["Hono server"]
        API["REST API /api/*"]
        CACHE["TTLs · rate limits"]
    end
    subgraph Data["Data + model"]
        AQ["Open-Meteo Air + Weather"]
        GEO["Open-Meteo Geocoding"]
        GEM["Gemini · optional"]
        KERNEL["Exposure surface · RBF"]
    end
    UI --> API
    API --> AQ
    API --> GEO
    API --> GEM
    UI --> CORE
    CORE --> PLAN["composePlan"]
    UI --> SCENE
```

### The exposure surface

```mermaid
flowchart LR
    classDef saans fill:#131519,stroke:#ffae5c,color:#e9e9e6
    S["ExposureSample[] · lat, lon, hour, pm25"] --> K["Kernel regression · RBF"]
    K --> Q["Query · lat, lon, hour"]
    Q --> E["ExposureEstimate · smoothed + spread"]
    E --> H["Heatmap strip"]
    class S,K,Q,E,H saans
```

## Engineering

- **Stack:** Vite + React 19 + TypeScript (strict), raw Three.js, GSAP + ScrollTrigger, Lenis, Zod, Hono.
- **Quality gates:** `tsc --noEmit`, `eslint`, `vitest` (87 tests / 7 files), coverage gate, `vite build`, Playwright e2e.
- **Design gate:** `design-taste-frontend` — final audit **0 FAIL, 1 WARN** (no footage; defended).

## Getting started

```bash
npm install
npm run dev        # dev server on :8787
npm run build      # typecheck + production build
npm test           # unit tests
npm run test:coverage
npm run test:e2e   # playwright
```

## The numbers

- **Domain layer coverage:** ~98% statements.
- **Taste-skill final audit:** 0 FAIL, 1 WARN.

## Credits

Photographs used with permission under Creative Commons; see `docs/DIRECTION.md` for the full table.
