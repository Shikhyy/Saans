import { formatHour } from '../core/planner'
import { fmt } from '../lib/format'
import { useApp } from '../state/app'

/** Hourly PM2.5 curve and highlighted cleanest stretch rendered behind the routine tracks. */
export function DayBackdrop() {
  const { today, cleanWindow, tf } = useApp()
  const points = today?.points ?? []
  const values = points
    .map((point) => point.pm25)
    .filter((value): value is number => value !== null)
  if (values.length < 2) return null

  const width = 240
  const height = 100
  const ceiling = Math.max(...values, 60)
  const step = width / Math.max(1, points.length - 1)
  const coords = points.map((point, index) => {
    const value = point.pm25 ?? 0
    return [index * step, 4 + (1 - Math.min(value / ceiling, 1)) * 92] as const
  })
  const line = coords
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`

  let low = Infinity
  let high = -Infinity
  let lowHour = 0
  let highHour = 0
  for (const point of points) {
    if (point.pm25 === null) continue
    if (point.pm25 < low) {
      low = point.pm25
      lowHour = point.hour
    }
    if (point.pm25 > high) {
      high = point.pm25
      highHour = point.hour
    }
  }
  const label = tf('day.curveLabel', {
    low: fmt(low),
    lowHour: formatHour(lowHour),
    high: fmt(high),
    highHour: formatHour(highHour),
  })

  return (
    <div className="daychart__backdrop">
      {cleanWindow && (
        <span
          className="daychart__window"
          aria-hidden="true"
          style={{
            left: `${(cleanWindow.startHour / 24) * 100}%`,
            width: `${((cleanWindow.endHour - cleanWindow.startHour) / 24) * 100}%`,
          }}
        />
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
      >
        <path d={area} className="daychart__area" />
        <path d={line} className="daychart__line" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
