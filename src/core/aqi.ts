import type { AqiCategory, AqiResult, HourPoint, Pollutant } from './types'

/**
 * CPCB (India) National Air Quality Index.
 *
 * Breakpoints follow the CPCB "National AQI" technical document: PM2.5, PM10, NO2 and SO2 use
 * 24-hour averages, O3 and CO use 8-hour averages, and the reported AQI is the **worst** sub-index,
 * not a mean. Reproducing that faithfully is the difference between an AQI and a made-up number.
 *
 * Source: CPCB, *National Air Quality Index* (2014), Table 2.
 */

export interface Breakpoint {
  cLow: number
  cHigh: number
  iLow: number
  iHigh: number
}

/** CPCB 24-hour PM2.5 breakpoint table paired with official AQI category bands. */
export const PM25_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
  { cLow: 30, cHigh: 60, iLow: 51, iHigh: 100 },
  { cLow: 60, cHigh: 90, iLow: 101, iHigh: 200 },
  { cLow: 90, cHigh: 120, iLow: 201, iHigh: 300 },
  { cLow: 120, cHigh: 250, iLow: 301, iHigh: 400 },
  { cLow: 250, cHigh: 500, iLow: 401, iHigh: 500 },
]

const PM10: Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 50, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 100, cHigh: 250, iLow: 101, iHigh: 200 },
  { cLow: 250, cHigh: 350, iLow: 201, iHigh: 300 },
  { cLow: 350, cHigh: 430, iLow: 301, iHigh: 400 },
  { cLow: 430, cHigh: 600, iLow: 401, iHigh: 500 },
]

const NO2: Breakpoint[] = [
  { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
  { cLow: 40, cHigh: 80, iLow: 51, iHigh: 100 },
  { cLow: 80, cHigh: 180, iLow: 101, iHigh: 200 },
  { cLow: 180, cHigh: 280, iLow: 201, iHigh: 300 },
  { cLow: 280, cHigh: 400, iLow: 301, iHigh: 400 },
  { cLow: 400, cHigh: 800, iLow: 401, iHigh: 500 },
]

const O3: Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 50, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 100, cHigh: 168, iLow: 101, iHigh: 200 },
  { cLow: 168, cHigh: 208, iLow: 201, iHigh: 300 },
  { cLow: 208, cHigh: 748, iLow: 301, iHigh: 400 },
  { cLow: 748, cHigh: 1000, iLow: 401, iHigh: 500 },
]

const SO2: Breakpoint[] = [
  { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
  { cLow: 40, cHigh: 80, iLow: 51, iHigh: 100 },
  { cLow: 80, cHigh: 380, iLow: 101, iHigh: 200 },
  { cLow: 380, cHigh: 800, iLow: 201, iHigh: 300 },
  { cLow: 800, cHigh: 1600, iLow: 301, iHigh: 400 },
  { cLow: 1600, cHigh: 2000, iLow: 401, iHigh: 500 },
]

const CO: Breakpoint[] = [
  { cLow: 0, cHigh: 1, iLow: 0, iHigh: 50 },
  { cLow: 1, cHigh: 2, iLow: 51, iHigh: 100 },
  { cLow: 2, cHigh: 10, iLow: 101, iHigh: 200 },
  { cLow: 10, cHigh: 17, iLow: 201, iHigh: 300 },
  { cLow: 17, cHigh: 34, iLow: 301, iHigh: 400 },
  { cLow: 34, cHigh: 50, iLow: 401, iHigh: 500 },
]

const TABLES: Record<Pollutant, readonly Breakpoint[]> = {
  pm2_5: PM25_BREAKPOINTS,
  pm10: PM10,
  no2: NO2,
  so2: SO2,
  o3: O3,
  co: CO,
}

export const POLLUTANT_LABEL: Record<Pollutant, string> = {
  pm2_5: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  so2: 'SO₂',
  o3: 'O₃',
  co: 'CO',
}

export const POLLUTANT_UNIT: Record<Pollutant, string> = {
  pm2_5: 'µg/m³',
  pm10: 'µg/m³',
  no2: 'µg/m³',
  so2: 'µg/m³',
  o3: 'µg/m³',
  co: 'mg/m³',
}

function interpolate(table: readonly Breakpoint[], concentration: number): number {
  if (!Number.isFinite(concentration) || concentration <= 0) return 0
  const last = table[table.length - 1]
  if (!last || concentration >= last.cHigh) return 500
  for (const bp of table) {
    if (concentration <= bp.cHigh) {
      if (concentration <= bp.cLow) return bp.iLow
      const ratio = (concentration - bp.cLow) / (bp.cHigh - bp.cLow)
      return Math.round(bp.iLow + ratio * (bp.iHigh - bp.iLow))
    }
  }
  return 500
}

/** Single-pollutant sub-index, 0–500. */
export function subIndex(pollutant: Pollutant, concentration: number): number {
  return Math.min(500, interpolate(TABLES[pollutant], concentration))
}

/** Map a CPCB AQI score (`0–500`) to its six official category bands. */
export function aqiCategory(aqi: number): AqiCategory {
  if (aqi <= 50) return 'good'
  if (aqi <= 100) return 'satisfactory'
  if (aqi <= 200) return 'moderate'
  if (aqi <= 300) return 'poor'
  if (aqi <= 400) return 'very-poor'
  return 'severe'
}

export const CATEGORY_LABEL: Record<AqiCategory, string> = {
  good: 'Good',
  satisfactory: 'Satisfactory',
  moderate: 'Moderate',
  poor: 'Poor',
  'very-poor': 'Very poor',
  severe: 'Severe',
}

/** Official band colours — always paired with the numeric AQI and a text label. */
export const CATEGORY_COLOR: Record<AqiCategory, string> = {
  good: '#3fa46a',
  satisfactory: '#c9b23a',
  moderate: '#e08a2e',
  poor: '#d4543f',
  'very-poor': '#a63a2e',
  severe: '#6e2430',
}

/**
 * Compute CPCB National AQI across available pollutants, returning the highest sub-index
 * and the dominant pollutant driving it.
 */
export function computeAqi(
  readings: Partial<Record<Pollutant, number | null | undefined>>,
): AqiResult {
  const subIndices: Partial<Record<Pollutant, number>> = {}
  let worst = -1
  let dominant: Pollutant | null = null

  // PM2.5 first so ties resolve to the pollutant that matters most in winter smog.
  const order: Pollutant[] = ['pm2_5', 'pm10', 'no2', 'so2', 'o3', 'co']
  for (const pollutant of order) {
    const value = readings[pollutant]
    if (value == null || !Number.isFinite(value)) continue
    const index = subIndex(pollutant, value)
    subIndices[pollutant] = index
    if (index > worst) {
      worst = index
      dominant = pollutant
    }
  }

  const aqi = worst < 0 ? 0 : worst
  return { aqi, category: aqiCategory(aqi), dominant, subIndices }
}

/** Compute CPCB AQI directly from a forecast `HourPoint`. */
export function aqiFromPoint(point: HourPoint): AqiResult {
  return computeAqi({
    pm2_5: point.pm25,
    pm10: point.pm10,
    no2: point.no2,
    so2: point.so2,
    o3: point.o3,
    co: point.co,
  })
}

/** How many times the WHO 2021 24-hour PM2.5 guideline (15 µg/m³) a reading represents. */
export function whoMultiple(pm25: number, guideline = 15): number {
  if (!Number.isFinite(pm25) || pm25 <= 0) return 0
  return Math.round((pm25 / guideline) * 10) / 10
}
