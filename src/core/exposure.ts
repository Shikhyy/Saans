/**
 * The exposure surface — a kernel regression over a household's forecast samples.
 *
 * Every forecast reading is a point in a three-dimensional feature space: latitude, longitude
 * and hour. The model smooths that space with a radial basis function and reads the air back at
 * any (lat, lon, hour) as a weighted neighbourhood average, returning the smoothed value plus a
 * spread. The spread is the weighted variance of the contributing readings, so the interface can
 * draw an uncertainty band and only trust the surface where it has support.
 *
 * Nothing here imports React, the DOM or the network: the same function serves the heatmap, the
 * planner and the tests.
 */

export interface ExposureSample {
  /** latitude of the reading, degrees */
  lat: number
  /** longitude of the reading, degrees */
  lon: number
  /** local hour the reading belongs to, 0–23 */
  hour: number
  /** PM2.5 in µg/m³ */
  pm25: number
  /** optional weighting, defaults to 1 */
  weight?: number
}

export interface ExposureQuery {
  lat: number
  lon: number
  hour: number
  /** search radius in km, defaults to unbounded */
  radiusKm?: number
}

export interface ExposureEstimate {
  /** smoothed PM2.5 in µg/m³ */
  value: number
  /** weighted standard deviation of the contributing readings, µg/m³ */
  spread: number
  /** distance to the nearest contributing reading, km */
  distanceKm: number
  /** how many readings the estimate was fitted from */
  sampleCount: number
}

export interface GridBounds {
  south: number
  north: number
  west: number
  east: number
}

export interface GridCell {
  lat: number
  lon: number
  value: number
  spread: number
}

const HOUR_SCALE = 24

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const latKm = Math.abs(a.lat - b.lat) * 111.32
  const lonKm = Math.abs(a.lon - b.lon) * 111.32 * Math.max(Math.cos((a.lat * Math.PI) / 180), 0.01)
  return Math.hypot(latKm, lonKm)
}

/**
 * Radial basis function over the (lat, lon, hour) feature space; the hour axis is scaled to
 * hours so the kernel reads naturally in either axis.
 */
function kernelWeight(sample: ExposureSample, query: ExposureQuery, thetaKm: number): number {
  const hourKm = Math.abs(sample.hour - query.hour) / HOUR_SCALE
  const d = Math.hypot(distanceKm(sample, query), hourKm)
  const weight = sample.weight ?? 1
  return weight * Math.exp(-(d * d) / (2 * thetaKm * thetaKm))
}

/**
 * Estimate smoothed PM2.5 concentration and neighbourhood spread at a single `(lat, lon, hour)` query
 * using a Gaussian radial basis function kernel over nearby forecast samples.
 */
export function exposureAt(
  samples: ExposureSample[],
  query: ExposureQuery,
  thetaKm = 12,
): ExposureEstimate {
  const bandwidthKm = Number.isFinite(thetaKm) && thetaKm > 0 ? thetaKm : 12
  const validSamples = samples.filter(
    (s) =>
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lon) &&
      Number.isFinite(s.hour) &&
      Number.isFinite(s.pm25),
  )
  const radiusKm = query.radiusKm
  const inRadius =
    radiusKm === undefined
      ? validSamples
      : validSamples.filter((s) => distanceKm(s, query) <= radiusKm)
  const contributing = inRadius
    .map((sample) => ({ sample, weight: kernelWeight(sample, query, bandwidthKm) }))
    .filter((entry) => entry.weight > 0)

  if (contributing.length === 0) {
    const nearest = inRadius.slice().sort((a, b) => distanceKm(a, query) - distanceKm(b, query))[0]
    const fallback = nearest ? nearest.pm25 : 0
    const fallbackDistance = nearest ? distanceKm(nearest, query) : (query.radiusKm ?? 0)
    return { value: fallback, spread: 0, distanceKm: fallbackDistance, sampleCount: 0 }
  }

  const totalWeight = contributing.reduce((sum, entry) => sum + entry.weight, 0)
  const value =
    contributing.reduce((sum, entry) => sum + entry.weight * entry.sample.pm25, 0) / totalWeight
  const spread = Math.sqrt(
    contributing.reduce((sum, entry) => sum + entry.weight * (entry.sample.pm25 - value) ** 2, 0) /
      totalWeight,
  )
  const nearestEntry = contributing.reduce((best, entry) =>
    distanceKm(entry.sample, query) < distanceKm(best.sample, query) ? entry : best,
  )

  return {
    value,
    spread,
    distanceKm: distanceKm(nearestEntry.sample, query),
    sampleCount: contributing.length,
  }
}

/**
 * Evaluate the exposure surface across a regular spatial grid covering `bounds` at `hours`.
 * Returns an empty array when `cellKm` is non-positive or `bounds` are inverted.
 */
export function exposureGrid(
  samples: ExposureSample[],
  hours: number,
  bounds: GridBounds,
  cellKm: number,
  thetaKm = 12,
): GridCell[] {
  if (!Number.isFinite(cellKm) || cellKm <= 0) return []
  if (bounds.north < bounds.south || bounds.east < bounds.west) return []

  const latStep = cellKm / 111.32
  const lonStep = cellKm / (111.32 * Math.max(Math.cos((bounds.south * Math.PI) / 180), 0.01))
  const cells: GridCell[] = []
  const columns = Math.max(1, Math.ceil((bounds.east - bounds.west) / lonStep))
  const rows = Math.max(1, Math.ceil((bounds.north - bounds.south) / latStep))

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const lat = Math.min(bounds.north, bounds.south + (row + 0.5) * latStep)
      const lon = Math.min(bounds.east, bounds.west + (column + 0.5) * lonStep)
      const estimate = exposureAt(samples, { lat, lon, hour: hours }, thetaKm)
      cells.push({ lat, lon, value: estimate.value, spread: estimate.spread })
    }
  }
  return cells
}
