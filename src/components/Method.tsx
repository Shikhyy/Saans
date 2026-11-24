import { aqiCategory, CATEGORY_LABEL, PM25_BREAKPOINTS } from '../core/aqi'
import { MODES } from '../core/modes'

const BREAKPOINT_ROWS = PM25_BREAKPOINTS.map((bp) => [
  `${bp.cLow === 0 ? 0 : bp.cLow + 1}–${bp.cHigh}`,
  `${bp.iLow}–${bp.iHigh}`,
  CATEGORY_LABEL[aqiCategory(bp.iHigh)],
])

const MODE_ROWS = Object.values(MODES).map((mode) => [
  mode.label,
  String(mode.co2GPerKm),
  `₹${mode.costInrPerKm}`,
  mode.exposureFactor.toFixed(2),
])

export function Method() {
  return (
    <main className="method" id="main">
      <div className="shell">
        <header className="method__head">
          <h1 className="method__title">How SAANS knows what it knows</h1>
          <p>
            Every number in the app is computed here, from public data, with the formula written
            down. Nothing is a vibe. Where the app estimates, it says so; where it cannot know, it
            says that too.
          </p>
        </header>

        <div className="method__body">
          <nav className="method__nav" aria-label="On this page">
            <a href="#aqi">The AQI</a>
            <a href="#exposure">Exposure</a>
            <a href="#indoor">The indoor model</a>
            <a href="#impact">Switches</a>
            <a href="#ward">The ward scenario</a>
            <a href="#data">Data and licences</a>
            <a href="#security">Security</a>
            <a href="#access">Accessibility</a>
            <a href="#tests">Tests</a>
            <a href="#limits">Limits</a>
          </nav>

          <div>
            <section className="method__section" id="aqi">
              <h2>The AQI is the worst pollutant, not the average</h2>
              <p>
                India’s National AQI, published by the Central Pollution Control Board, computes a
                sub-index for each pollutant and reports the highest one. Averaging them is a common
                mistake that makes severe air look moderate. SAANS implements the CPCB breakpoints
                and linear interpolation within each band.
              </p>
              <pre className="formula">
                I = I_low + (I_high − I_low) × (C − C_low) / (C_high − C_low)
                <br />
                AQI = max(sub-index of PM2.5, PM10, NO₂, SO₂, O₃, CO)
              </pre>
              <p>
                PM2.5, PM10, NO₂ and SO₂ use 24-hour averages; O₃ and CO use 8-hour averages. The
                hourly forecast is used as the concentration for the current band, which is why the
                app calls the result an hourly AQI and not a 24-hour compliance value.
              </p>
              <table className="data-table">
                <caption>CPCB PM2.5 breakpoints, 24-hour mean (µg/m³)</caption>
                <thead>
                  <tr>
                    <th scope="col">PM2.5</th>
                    <th scope="col">Sub-index</th>
                    <th scope="col">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {BREAKPOINT_ROWS.map(([concentration, index, category]) => (
                    <tr key={category}>
                      <td className="num">{concentration}</td>
                      <td className="num">{index}</td>
                      <td>{category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="method__section" id="exposure">
              <h2>Exposure is mass, not a score</h2>
              <p>
                The app counts the mass of PM2.5 a person actually draws in. Minute ventilation by
                activity comes from the US EPA Exposure Factors Handbook: about 6 L/min at rest, 12
                L/min light, 25 moderate, 50 vigorous.
              </p>
              <pre className="formula">
                inhaled (µg) = concentration (µg/m³) × ventilation (m³/min) × minutes
                <br />
                budget (µg/day) = 15 × 1440 × 0.012 ≈ 259 µg
              </pre>
              <p>
                The budget is what a healthy adult would inhale in a day if the air sat exactly at
                the WHO 2021 24-hour guideline of 15 µg/m³. A child, an older adult, a person with
                asthma or a pregnant person is given a smaller budget — a sensitivity factor between
                0.7 and 0.9 — because the same physics carries different risk.
              </p>
              <p>
                Example: 187 µg/m³ for a 45-minute moderate walk is 187 × 45 × 0.025 ≈ 210 µg, about
                81% of an adult’s daily budget in one outing. That is the number the planner moves.
              </p>
            </section>

            <section className="method__section" id="indoor">
              <h2>The indoor model is a single-zone mass balance</h2>
              <pre className="formula">
                C_in = (P × C_out × ACH_inf + G / V) / (ACH_inf + CADR / V)
              </pre>
              <p>
                P is the penetration factor for PM2.5 (0.8), ACH_inf is infiltration air changes per
                hour (0.9 for a one-room home, 0.5 for an apartment, 0.35 for a sealed house), G is
                indoor generation in µg/h and V is the room volume at a 2.7 m ceiling. A purifier is
                just another air-change term: CADR divided by volume.
              </p>
              <p>
                Cooking generation is 3,500 µg/h for LPG, 22,000 for biomass and 12,000 for a mixed
                stove, applied for three hours a day. These are order-of-magnitude figures from
                indoor air literature, not measurements of your kitchen. The model is there to rank
                interventions correctly, which it does: the fuel switch dominates, filtration
                second, sealing third.
              </p>
            </section>

            <section className="method__section" id="impact">
              <h2>What a switch buys</h2>
              <p>
                A commute comparison holds distance constant and changes the concentration the
                traveller sits in, the breathing rate, and the time exposed. The exposure factor is
                the share of roadside PM2.5 that reaches the person.
              </p>
              <table className="data-table">
                <caption>Per passenger-kilometre factors</caption>
                <thead>
                  <tr>
                    <th scope="col">Mode</th>
                    <th scope="col">CO₂ (g/km)</th>
                    <th scope="col">Cost (₹/km)</th>
                    <th scope="col">Exposure factor</th>
                  </tr>
                </thead>
                <tbody>
                  {MODE_ROWS.map(([mode, co2, cost, factor]) => (
                    <tr key={mode}>
                      <td>{mode}</td>
                      <td className="num">{co2}</td>
                      <td className="num">{cost}</td>
                      <td className="num">{factor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Fuel switching is accounted per household per year: biomass 4.5 kg of PM2.5 and
                2,250 kg CO₂e; LPG 0.02 kg and 492 kg; induction 0.005 kg and 390 kg. Wood smoke
                carries a high CO₂-equivalent because of methane and black carbon, which is why the
                biomass figure is not zero even though the carbon is recent.
              </p>
            </section>

            <section className="method__section" id="ward">
              <h2>The ward is a scenario, and it is labelled as one</h2>
              <p>
                Ward mode multiplies households by per-household emission factors to answer “what
                changes if this street stops burning wood”. It does not claim to predict the ambient
                concentration on that street, which would need a dispersion model and a lot of
                meteorology. The exposure-saved figure is the same mass-balance model as the
                kitchen, applied to the people who switch.
              </p>
              <p>
                The street heatmap is an exposure surface: a kernel regression over the night’s
                readings, smoothed and given a spread. It is a model of the air, not a measurement
                of it, and the figures beneath it are still the mass-balance numbers.
              </p>
            </section>

            <section className="method__section" id="data">
              <h2>Data and licences</h2>
              <ul>
                <li>
                  Air quality and weather: Open-Meteo (CC BY 4.0), free and keyless. Hourly PM2.5,
                  PM10, NO₂, SO₂, O₃, CO, boundary-layer height, wind, temperature and humidity,
                  five days ahead.
                </li>
                <li>Geocoding: Open-Meteo Geocoding.</li>
                <li>AQI: CPCB National Air Quality Index, 2014.</li>
                <li>Guideline: WHO global air quality guidelines, 2021.</li>
              </ul>
              <p>
                Forecasts are cached server-side for ten minutes and on the device for offline use.
                If both fail, the app says so and falls back to a clearly labelled sample so the
                interface still works.
              </p>
              <p>
                Photographs are real pictures of this subject's world, used under their own licences
                and shown with a display filter only. The files are stored unaltered.
              </p>
              <ul>
                <li>
                  “Delhi Smog” by AnkClix, CC BY-SA 4.0, via Wikimedia Commons. The street lamp in
                  the fixed panel and the closing photograph.
                </li>
                <li>
                  “Low visibility due to Smog at New Delhi Railway station, 31 Dec 2017” by Sumita
                  Roy Dutta, CC BY-SA 4.0, via Wikimedia Commons.
                </li>
                <li>
                  “Smog as visible in the Gurgaon area near Delhi on Nov 2016”, CC BY-SA 4.0, via
                  Wikimedia Commons. The ward plate.
                </li>
                <li>
                  “A cooking pot placed on a earthen stove called Chulha, North India” by
                  Hk31122002, CC BY-SA 4.0, via Wikimedia Commons. The kitchen row.
                </li>
                <li>
                  “Humayun's Tomb in foggy winter morning” by Rohit Agarwal, CC BY-SA 4.0, via
                  Wikimedia Commons. The footer plate.
                </li>
              </ul>
            </section>

            <section className="method__section" id="security">
              <h2>Security</h2>
              <ul>
                <li>
                  The Gemini key lives only in the server environment. The browser never receives it
                  and no request from the client carries it.
                </li>
                <li>
                  Every request body is validated with a strict schema; the plan endpoint rejects
                  bodies over 8 KB and any unknown field.
                </li>
                <li>
                  Upstream requests are built from validated coordinates against a three-host
                  allowlist, which closes the usual server-side request forgery hole in a proxy.
                </li>
                <li>
                  Model output is parsed as JSON, validated against the same schema the local engine
                  uses, and rendered as text nodes. No HTML from the model is ever injected.
                </li>
                <li>
                  Production responses carry a nonce-free strict CSP, nosniff, frame denial, a
                  referrer policy, a permissions policy and HSTS.
                </li>
                <li>
                  Rate limits: 60 reads and 10 plan generations per minute per address, with
                  in-memory counters. No accounts, no cookies, no personal data stored.
                </li>
              </ul>
            </section>

            <section className="method__section" id="access">
              <h2>Accessibility</h2>
              <ul>
                <li>WCAG 2.2 AA targets, checked with axe in the test suite and by keyboard.</li>
                <li>
                  The 3D scene is decorative: the same hour-by-hour data is exposed as text for
                  screen readers, and every number appears in the document, not only in canvas.
                </li>
                <li>
                  The routine timeline is a set of sliders. Tab to a block, use arrow keys to move
                  it by 15 minutes, shift for an hour, Home and End for the day.
                </li>
                <li>
                  Reduced motion stops the camera and the particles and reveals all content without
                  travel. Without WebGL the page falls back to a still, lit backdrop.
                </li>
                <li>
                  AQI is never colour alone: every reading carries a number, a category word and a
                  coloured mark. Text reflows at 200% zoom and targets are at least 44 px.
                </li>
                <li>English and Hindi, with Devanagari loaded only when Hindi is chosen.</li>
              </ul>
            </section>

            <section className="method__section" id="tests">
              <h2>Tests</h2>
              <p>
                The domain layer imports nothing from React, the DOM or the network, so it is tested
                directly. Unit tests cover CPCB sub-indices and category edges, the inhaled-mass
                arithmetic, the indoor mass balance, clean-window search, routine shifting, commute
                and fuel comparisons, the ward scenario, and the deterministic plan engine.
                Component tests cover the timeline keyboard contract and the plan rendering. Network
                calls are mocked with MSW. axe runs against the rendered page.
              </p>
              <pre className="formula">
                npm test &nbsp;·&nbsp; npm run test:coverage &nbsp;·&nbsp; npm run test:e2e
              </pre>
              <p>
                Automated suites verify CPCB sub-indices and every band edge, the inhaled-mass
                arithmetic, the indoor mass balance and intervention ranking, clean-window search
                and routine shifting, commute and fuel comparisons, the ward scenario, the plan
                engine in both languages, the Zod contracts, the server's SSRF allowlist and request
                guards, origin checks, the timeline's keyboard contract, error recovery, and axe
                accessibility passes. The domain layer sits well above 90% statement coverage.
              </p>
            </section>

            <section className="method__section" id="limits">
              <h2>What this cannot do</h2>
              <ul>
                <li>
                  It does not measure your air. It reads a forecast grid cell that may be kilometres
                  from your street.
                </li>
                <li>
                  The exposure index is not a dose to your lungs and not a health prediction. It is
                  a relative planning number.
                </li>
                <li>
                  It does not replace medical advice. People with asthma, heart disease or who are
                  pregnant should follow their clinician.
                </li>
                <li>
                  Ward figures are scenarios built from emission factors, not a dispersion model.
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
