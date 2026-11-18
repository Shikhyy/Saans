import type { DaySeries, HourPoint } from '../core/types'
import type { airResponseSchema, weatherResponseSchema } from '../core/schemas'
import type { z } from 'zod'

type AirResponse = z.infer<typeof airResponseSchema>
type WeatherResponse = z.infer<typeof weatherResponseSchema>

const at = (values: (number | null)[] | undefined, index: number): number | null => {
  const value = values?.[index]
  return value == null || !Number.isFinite(value) ? null : value
}

/**
 * Open-Meteo returns two parallel hourly series (air quality and weather) keyed by the same local
 * timestamps. Merging them by time rather than by index is the only safe join: the two endpoints can
 * return different ranges.
 */
export function mergeSeries(air: AirResponse, weather: WeatherResponse): HourPoint[] {
  const weatherByTime = new Map<string, number>()
  weather.hourly.time.forEach((time, index) => weatherByTime.set(time, index))

  return air.hourly.time.map((time, index) => {
    const weatherIndex = weatherByTime.get(time)
    const pick = (values: (number | null)[] | undefined): number | null =>
      weatherIndex == null ? null : at(values, weatherIndex)

    const coUg = at(air.hourly.carbon_monoxide, index)
    const hour = Number(time.slice(11, 13))

    return {
      time,
      hour: Number.isFinite(hour) ? hour : 0,
      pm25: at(air.hourly.pm2_5, index),
      pm10: at(air.hourly.pm10, index),
      no2: at(air.hourly.nitrogen_dioxide, index),
      so2: at(air.hourly.sulphur_dioxide, index),
      o3: at(air.hourly.ozone, index),
      co: coUg == null ? null : coUg / 1000,
      windKmh: pick(weather.hourly.wind_speed_10m),
      boundaryLayerM: pick(weather.hourly.boundary_layer_height),
      temperatureC: pick(weather.hourly.temperature_2m),
      humidity: pick(weather.hourly.relative_humidity_2m),
    }
  })
}

export function groupDays(points: HourPoint[]): DaySeries[] {
  const byDate = new Map<string, HourPoint[]>()
  for (const point of points) {
    const date = point.time.slice(0, 10)
    const bucket = byDate.get(date)
    if (bucket) bucket.push(point)
    else byDate.set(date, [point])
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayPoints]) => ({ date, points: dayPoints }))
}

/** The hour of the day we are in, in the location's own timezone, from the local ISO strings. */
export function localNow(points: HourPoint[], now = new Date()): HourPoint | null {
  const localHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(now),
  )
  if (points.length === 0) return null
  return points.find((point) => point.hour === localHour) ?? points[0] ?? null
}
