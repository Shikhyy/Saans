import { Hono } from 'hono'
import { z } from 'zod'
import { computeAqi } from '../src/core/aqi'
import { composePlan } from '../src/core/plan'
import {
  airResponseSchema,
  planRequestSchema,
  weatherResponseSchema,
  type PlanRequest,
} from '../src/core/schemas'
import { groupDays, mergeSeries } from '../src/data/merge'
import { RateLimiter, TtlCache } from './lib/cache'
import { writePlanWithModel } from './lib/gemini'
import { buildUrl, fetchJson, UpstreamError } from './lib/upstream'

export const api = new Hono().basePath('/api')

const airCache = new TtlCache<unknown>(10 * 60 * 1000)
const geoCache = new TtlCache<unknown>(24 * 60 * 60 * 1000)
const planCache = new TtlCache<unknown>(30 * 60 * 1000)

const readLimiter = new RateLimiter(60, 60_000)
const planLimiter = new RateLimiter(10, 60_000)

const coordinate = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
})

function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'local'
}

function hourInZone(timeZone: string, now = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone,
    }).formatToParts(now)
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '12')
    return Number.isFinite(hour) ? hour % 24 : 12
  } catch {
    return 12
  }
}

api.get('/health', (c) => c.json({ ok: true, service: 'saans', time: new Date().toISOString() }))

api.get('/air', async (c) => {
  const limit = readLimiter.take(clientKey(c.req.raw.headers))
  if (!limit.allowed) {
    c.header('Retry-After', String(limit.retryAfter))
    return c.json({ error: 'rate_limited' }, 429)
  }

  const parsed = coordinate.safeParse({
    lat: c.req.query('lat'),
    lon: c.req.query('lon'),
  })
  if (!parsed.success) return c.json({ error: 'bad_coordinates' }, 400)

  const { lat, lon } = parsed.data
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const cached = airCache.get(key)
  if (cached) return c.json(cached as object)

  try {
    const airUrl = buildUrl('https://air-quality-api.open-meteo.com/v1/air-quality', {
      latitude: lat,
      longitude: lon,
      hourly: 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone',
      timezone: 'auto',
      forecast_days: 5,
    })
    const weatherUrl = buildUrl('https://api.open-meteo.com/v1/forecast', {
      latitude: lat,
      longitude: lon,
      hourly: 'boundary_layer_height,wind_speed_10m,temperature_2m,relative_humidity_2m',
      timezone: 'auto',
      forecast_days: 5,
    })

    const [airRaw, weatherRaw] = await Promise.all([
      fetchJson(airUrl, c.req.raw.signal),
      fetchJson(weatherUrl, c.req.raw.signal),
    ])

    const air = airResponseSchema.parse(airRaw)
    const weather = weatherResponseSchema.parse(weatherRaw)
    const points = mergeSeries(air, weather)
    const days = groupDays(points)

    const hour = hourInZone(air.timezone)
    const today = days[0]?.points ?? []
    const currentPoint = today.find((point) => point.hour === hour) ?? today[0] ?? null

    const payload = {
      timezone: air.timezone,
      currentHour: hour,
      days,
      current: currentPoint
        ? {
            ...currentPoint,
            aqi: computeAqi({
              pm2_5: currentPoint.pm25,
              pm10: currentPoint.pm10,
              no2: currentPoint.no2,
              so2: currentPoint.so2,
              o3: currentPoint.o3,
              co: currentPoint.co,
            }),
          }
        : null,
      fetchedAt: new Date().toISOString(),
      attribution: 'Air quality and weather: Open-Meteo (CC BY 4.0)',
    }

    airCache.set(key, payload)
    return c.json(payload)
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 502
    return c.json({ error: 'upstream_unavailable', detail: status }, 502)
  }
})

api.get('/geocode', async (c) => {
  const limit = readLimiter.take(clientKey(c.req.raw.headers))
  if (!limit.allowed) return c.json({ error: 'rate_limited' }, 429)

  const query = z.string().min(2).max(60).safeParse(c.req.query('q'))
  if (!query.success) return c.json({ error: 'bad_query' }, 400)

  const key = query.data.toLowerCase()
  const cached = geoCache.get(key)
  if (cached) return c.json(cached as object)

  try {
    const url = buildUrl('https://geocoding-api.open-meteo.com/v1/search', {
      name: query.data,
      count: 6,
      language: 'en',
      format: 'json',
    })
    const raw = await fetchJson(url, c.req.raw.signal)
    const parsed = z
      .object({
        results: z
          .array(
            z.object({
              id: z.number(),
              name: z.string(),
              latitude: z.number(),
              longitude: z.number(),
              timezone: z.string().optional(),
              country: z.string().optional(),
              admin1: z.string().optional(),
            }),
          )
          .optional(),
      })
      .parse(raw)

    const results = (parsed.results ?? []).map((place) => ({
      id: place.id,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone ?? 'auto',
      country: place.country ?? '',
      admin1: place.admin1 ?? '',
    }))

    geoCache.set(key, { results })
    return c.json({ results })
  } catch {
    return c.json({ error: 'upstream_unavailable' }, 502)
  }
})

api.post('/plan', async (c) => {
  const limit = planLimiter.take(clientKey(c.req.raw.headers))
  if (!limit.allowed) {
    c.header('Retry-After', String(limit.retryAfter))
    return c.json({ error: 'rate_limited' }, 429)
  }

  const length = Number(c.req.header('content-length') ?? '0')
  if (Number.isFinite(length) && length > 8192) return c.json({ error: 'too_large' }, 413)

  const raw = await c.req.text()
  if (raw.length > 8192) return c.json({ error: 'too_large' }, 413)

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return c.json({ error: 'bad_json' }, 400)
  }

  const parsed = planRequestSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400)

  const request: PlanRequest = parsed.data
  const cacheKey = JSON.stringify(request)
  const cached = planCache.get(cacheKey)
  if (cached) return c.json(cached as object)

  const enginePlan = composePlan(request.facts, request.profile)
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

  if (apiKey) {
    try {
      const written = await writePlanWithModel(request.profile, request.facts, apiKey, model)
      if (written) {
        const payload = { ...written, source: 'model' as const }
        planCache.set(cacheKey, payload)
        return c.json(payload)
      }
    } catch {
      // fall through to the engine: a slow model must never break the page
    }
  }

  return c.json(enginePlan)
})
