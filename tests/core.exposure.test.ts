import { describe, expect, it } from 'vitest'
import { exposureAt, exposureGrid, type ExposureSample } from '../src/core/exposure'

function sample(lat: number, lon: number, hour: number, pm25: number, weight = 1): ExposureSample {
  return { lat, lon, hour, pm25, weight }
}

describe('the exposure surface', () => {
  it('reads a lone sample back as that reading, with no spread', () => {
    const estimate = exposureAt([sample(28.61, 77.21, 9, 64.5)], {
      lat: 28.61,
      lon: 77.21,
      hour: 9,
    })
    expect(estimate.value).toBeCloseTo(64.5, 5)
    expect(estimate.spread).toBe(0)
    expect(estimate.sampleCount).toBe(1)
  })

  it('blends neighbouring readings into the neighbourhood average', () => {
    const estimate = exposureAt(
      [sample(28.61, 77.21, 9, 64.5), sample(28.62, 77.22, 9, 70.0)],
      { lat: 28.61, lon: 77.21, hour: 9 },
      200,
    )
    expect(estimate.value).toBeCloseTo(67.25, 2)
    expect(estimate.sampleCount).toBe(2)
  })

  it('stays close to a nearby reading and ignores readings beyond the radius', () => {
    const estimate = exposureAt(
      [sample(28.61, 77.21, 9, 64.5), sample(28.9, 77.2, 9, 130.0)],
      { lat: 28.61, lon: 77.21, hour: 9, radiusKm: 15 },
      200,
    )
    expect(estimate.value).toBeCloseTo(64.5, 5)
    expect(estimate.sampleCount).toBe(1)
  })

  it('averages over the hours of the day, smoothing the curve', () => {
    const samples = [
      sample(28.61, 77.21, 6, 40),
      sample(28.61, 77.21, 12, 90),
      sample(28.61, 77.21, 18, 70),
    ]
    const estimate = exposureAt(samples, { lat: 28.61, lon: 77.21, hour: 12 })
    expect(estimate.value).toBeGreaterThan(0)
    expect(estimate.spread).toBeGreaterThan(0)
  })

  it('grids an area and returns one cell per position', () => {
    const cells = exposureGrid(
      [sample(28.61, 77.21, 9, 64.5), sample(28.62, 77.22, 9, 70.0)],
      9,
      { south: 28.58, north: 28.66, west: 77.18, east: 77.24 },
      5,
    )
    expect(cells.length).toBeGreaterThan(1)
    for (const cell of cells) {
      expect(cell.value).toBeGreaterThan(0)
      expect(cell.spread).toBeGreaterThanOrEqual(0)
    }
    expect(cells.every((cell) => cell.lat >= 28.58 && cell.lat <= 28.66)).toBe(true)
    expect(cells.every((cell) => cell.lon >= 77.18 && cell.lon <= 77.24)).toBe(true)
  })

  it('falls back to the sample closest to the query when kernel weights underflow', () => {
    const estimate = exposureAt(
      [sample(28.61, 77.21, 9, 64), sample(35.0, 80.0, 9, 199)],
      { lat: 28.615, lon: 77.215, hour: 9 },
      0.01,
    )
    expect(estimate.value).toBe(64)
    expect(estimate.sampleCount).toBe(0)
  })

  it('handles invalid bandwidths and grid parameters safely', () => {
    const estimate = exposureAt(
      [sample(28.61, 77.21, 9, 80)],
      { lat: 28.61, lon: 77.21, hour: 9 },
      0,
    )
    expect(Number.isFinite(estimate.value)).toBe(true)
    expect(
      exposureGrid([], 9, { south: 28.58, north: 28.66, west: 77.18, east: 77.24 }, 0),
    ).toEqual([])
    expect(exposureGrid([], 9, { south: 29, north: 28, west: 77, east: 78 }, 5)).toEqual([])
  })
})
