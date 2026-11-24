import { describe, expect, it } from 'vitest'
import { aqiCategory, computeAqi, subIndex, whoMultiple, CATEGORY_LABEL } from '../src/core/aqi'

/**
 * Golden values from the CPCB National AQI breakpoint table. Each band edge is checked from both
 * sides, because an off-by-one at a band boundary is the classic way an AQI implementation lies.
 */
describe('CPCB sub-indices', () => {
  it('interpolates linearly inside the PM2.5 bands', () => {
    expect(subIndex('pm2_5', 0)).toBe(0)
    expect(subIndex('pm2_5', 30)).toBe(50)
    expect(subIndex('pm2_5', 45)).toBe(76) // 51 + 0.5 * 49 = 75.5 -> 76
    expect(subIndex('pm2_5', 60)).toBe(100)
    expect(subIndex('pm2_5', 90)).toBe(200)
    expect(subIndex('pm2_5', 120)).toBe(300)
    expect(subIndex('pm2_5', 250)).toBe(400)
  })

  it('caps at 500 above the top of the table', () => {
    expect(subIndex('pm2_5', 900)).toBe(500)
    expect(subIndex('pm10', 5000)).toBe(500)
  })

  it('treats negative and non-finite readings as zero', () => {
    expect(subIndex('pm2_5', -12)).toBe(0)
    expect(subIndex('pm2_5', Number.NaN)).toBe(0)
    expect(subIndex('pm2_5', Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('uses mg/m³ for CO, not µg/m³', () => {
    expect(subIndex('co', 1)).toBe(50)
    expect(subIndex('co', 2)).toBe(100)
    expect(subIndex('co', 10)).toBe(200)
  })

  it('matches the published NO2 and O3 edges', () => {
    expect(subIndex('no2', 40)).toBe(50)
    expect(subIndex('no2', 80)).toBe(100)
    expect(subIndex('o3', 100)).toBe(100)
    expect(subIndex('o3', 168)).toBe(200)
  })
})

describe('the reported AQI', () => {
  it('is the worst sub-index, never the mean', () => {
    const result = computeAqi({ pm2_5: 120, pm10: 100, no2: 20, o3: 30 })
    expect(result.aqi).toBe(300)
    expect(result.dominant).toBe('pm2_5')
    expect(result.category).toBe('poor')
  })

  it('resolves a tie towards PM2.5', () => {
    const result = computeAqi({ pm10: 50, pm2_5: 30 })
    expect(result.dominant).toBe('pm2_5')
    expect(result.aqi).toBe(50)
  })

  it('ignores missing pollutants', () => {
    const result = computeAqi({ pm2_5: null, pm10: undefined, no2: 40 })
    expect(result.aqi).toBe(50)
    expect(result.dominant).toBe('no2')
  })

  it('returns zero with no readings at all', () => {
    expect(computeAqi({}).aqi).toBe(0)
    expect(computeAqi({}).dominant).toBeNull()
  })
})

describe('categories', () => {
  it('places every band edge on the correct side', () => {
    expect(aqiCategory(50)).toBe('good')
    expect(aqiCategory(51)).toBe('satisfactory')
    expect(aqiCategory(100)).toBe('satisfactory')
    expect(aqiCategory(101)).toBe('moderate')
    expect(aqiCategory(200)).toBe('moderate')
    expect(aqiCategory(201)).toBe('poor')
    expect(aqiCategory(300)).toBe('poor')
    expect(aqiCategory(301)).toBe('very-poor')
    expect(aqiCategory(400)).toBe('very-poor')
    expect(aqiCategory(401)).toBe('severe')
  })

  it('has a word for every band, so colour is never the only signal', () => {
    for (const value of [10, 80, 150, 250, 350, 480]) {
      expect(CATEGORY_LABEL[aqiCategory(value)]).toBeTruthy()
    }
  })
})

describe('the WHO comparison', () => {
  it('uses the 2021 24-hour guideline of 15 µg/m³', () => {
    expect(whoMultiple(15)).toBe(1)
    expect(whoMultiple(150)).toBe(10)
    expect(whoMultiple(0)).toBe(0)
    expect(whoMultiple(-5)).toBe(0)
  })
})
