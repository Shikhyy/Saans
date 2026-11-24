import { useMemo } from 'react'
import { exposureGrid, type ExposureSample } from '../core/exposure'
import { ramp } from '../lib/ramp'

export interface HeatmapProps {
  /** readings the surface is fitted from */
  samples: ExposureSample[]
  /** latitude of the point the surface is read at */
  lat: number
  /** longitude of the point the surface is read at */
  lon: number
  /** hour the surface is read at, 0–23 */
  hours: number
  /** optional spatial box, defaults to a neighbourhood around the point */
  bounds?: { south: number; north: number; west: number; east: number }
  /** cell size in km */
  cellKm?: number
}

/**
 * The exposure surface drawn as a strip of cells, one per position in the fitted neighbourhood.
 * The colour is the smoothed reading, the strip is decorative; the spoken value lives in the text
 * beside it.
 */
export function Heatmap({ samples, lat, lon, hours, bounds, cellKm = 12 }: HeatmapProps) {
  const cells = useMemo(() => {
    const box =
      bounds ??
      {
        south: lat - 0.12,
        north: lat + 0.12,
        west: lon - (0.12 / Math.max(Math.cos((lat * Math.PI) / 180), 0.01)),
        east: lon + (0.12 / Math.max(Math.cos((lat * Math.PI) / 180), 0.01)),
      }
    return exposureGrid(samples, hours, box, cellKm)
  }, [samples, lat, lon, hours, bounds, cellKm])

  const max = Math.max(1e-6, ...cells.map((cell) => cell.value))
  const ordered = cells.slice().sort((a, b) => a.lon - b.lon)

  return (
    <div
      className="heatmap"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, ordered.length)}, minmax(0, 1fr))` }}
      data-reveal
      aria-hidden="true"
    >
      {ordered.map((cell) => (
        <div
          key={`${cell.lat.toFixed(4)}-${cell.lon.toFixed(4)}`}
          className="heatmap__cell"
          style={{ background: ramp(cell.value, max) }}
        />
      ))}
    </div>
  )
}
