import type { AirPayload } from '../core/schemas'
import type { HourPoint } from '../core/types'
import { aqiFromPoint } from '../core/aqi'

/**
 * A deterministic sample forecast, used only when both the network and the last saved copy are
 * unavailable. It is labelled in the interface as a sample, and it follows the same winter diurnal
 * shape a real Delhi forecast does: a dawn peak under the inversion and an afternoon dip.
 */
function pm25At(hour: number, dayOffset: number): number {
  const morning = 96 * Math.cos(((hour - 6) / 24) * Math.PI * 2)
  const evening = 26 * Math.cos(((hour - 19) / 12) * Math.PI * 2)
  return Math.max(42, 176 + morning + evening + dayOffset * 7)
}

export function samplePayload(): AirPayload {
  const now = new Date()
  const days: AirPayload['days'] = []

  for (let dayOffset = 0; dayOffset < 3; dayOffset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset)
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`

    const points: HourPoint[] = Array.from({ length: 24 }, (_, hour) => {
      const pm25 = Math.round(pm25At(hour, dayOffset))
      return {
        time: `${iso}T${String(hour).padStart(2, '0')}:00`,
        hour,
        pm25,
        pm10: Math.round(pm25 * 1.8),
        no2: Math.round(28 + pm25 * 0.22),
        so2: Math.round(9 + pm25 * 0.04),
        o3: Math.round(40 + Math.sin((hour / 24) * Math.PI) * 45),
        co: Number((0.7 + pm25 * 0.004).toFixed(2)),
        windKmh: Number((4 + Math.sin((hour / 24) * Math.PI * 2) * 3).toFixed(1)),
        boundaryLayerM: Math.round(120 + Math.max(0, Math.sin(((hour - 7) / 12) * Math.PI)) * 900),
        temperatureC: Math.round(13 + Math.sin(((hour - 9) / 12) * Math.PI) * 8),
        humidity: Math.round(62 + Math.cos((hour / 24) * Math.PI * 2) * 12),
      }
    })

    days.push({ date: iso, points })
  }

  const currentHour = now.getHours()
  const todayPoints = days[0]?.points ?? []
  const currentPoint = todayPoints.find((point) => point.hour === currentHour) ?? todayPoints[0]

  return {
    timezone: 'Asia/Kolkata',
    currentHour,
    days,
    current: currentPoint
      ? {
          ...currentPoint,
          aqi: aqiFromPoint(currentPoint),
        }
      : null,
    fetchedAt: new Date().toISOString(),
    attribution: 'Sample forecast — Open-Meteo unreachable',
    sample: true,
  }
}
