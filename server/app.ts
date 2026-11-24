import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { aqiFromPoint } from '../src/core/aqi'
import { composePlan } from '../src/core/plan'
import {
  airResponseSchema,
  geocodeResponseSchema,
  planRequestSchema,
  weatherResponseSchema,
  type AirPayload,
  type GeocodePayload,
  type PlanPayload,
  type PlanRequest,
} from '../src/core/schemas'
import { groupDays, mergeSeries } from '../src/data/merge'
import { RateLimiter, TtlCache } from './lib/cache'
import { writePlanWithModel } from './lib/gemini'
import { buildUrl, fetchJson, UpstreamError } from './lib/upstream'

export const api = new Hono().basePath('/api')

const MAX_PLAN_BODY_BYTES = 8192

const airCache = new TtlCache<AirPayload>(10 * 60 * 1000)
const geoCache = new TtlCache<GeocodePayload>(24 * 60 * 60 * 1000)
const planCache = new TtlCache<PlanPayload>(30 * 60 * 1000)

const readLimiter = new RateLimiter(60, 60_000)
const planLimiter = new RateLimiter(10, 60_000)

const coordinate = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
})

function allowedOriginSet(): Set<string> {
  const raw = process.env.ALLOWED_ORIGINS ?? ''
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
}

api.use('*', async (c, next) => {
  const origin = c.req.header('origin')
  if (origin) {
    const allowed = allowedOriginSet()
    const hostHeader = c.req.header('host')
    let sameHost = false
    try {
      sameHost = new URL(origin).host === (hostHeader ?? new URL(c.req.url).host)
    } catch {
      sameHost = false
    }
    if (!allowed.has(origin) && !sameHost) {
      return c.json({ error: 'forbidden_origin' }, 403)
    }
    if (allowed.has(origin)) {
      c.header('Access-Control-Allow-Origin', origin)
      c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      c.header('Access-Control-Allow-Headers', 'Content-Type, Accept')
      c.header('Vary', 'Origin')
    }
  }
  if (c.req.method === 'OPTIONS') return c.body(null, 204)
  await next()
})

async function fetchForecastBundle(
  lat: number,
  lon: number,
  signal: AbortSignal,
): Promise<AirPayload> {
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
    fetchJson(airUrl, signal),
    fetchJson(weatherUrl, signal),
  ])

  const air = airResponseSchema.parse(airRaw)
  const weather = weatherResponseSchema.parse(weatherRaw)
  const points = mergeSeries(air, weather)
  const days = groupDays(points)

  const hour = hourInZone(air.timezone)
  const today = days[0]?.points ?? []
  const currentPoint = today.find((point) => point.hour === hour) ?? today[0] ?? null

  return {
    timezone: air.timezone,
    currentHour: hour,
    days,
    current: currentPoint
      ? {
          ...currentPoint,
          aqi: aqiFromPoint(currentPoint),
        }
      : null,
    fetchedAt: new Date().toISOString(),
    attribution: 'Air quality and weather: Open-Meteo (CC BY 4.0)',
  }
}

async function readTextLimited(request: Request, maxBytes: number): Promise<string | null> {
  const stream = request.body
  if (!stream) return ''
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const combined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(combined)
}

function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = headers.get('x-real-ip')?.trim()
  return (forwarded || realIp || 'local').slice(0, 64)
}

function checkRateLimit(c: Context, limiter: RateLimiter): Response | null {
  const limit = limiter.take(clientKey(c.req.raw.headers))
  if (limit.allowed) return null
  c.header('Retry-After', String(limit.retryAfter))
  return c.json({ error: 'rate_limited' }, 429)
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
  const blocked = checkRateLimit(c, readLimiter)
  if (blocked) return blocked

  const parsed = coordinate.safeParse({
    lat: c.req.query('lat'),
    lon: c.req.query('lon'),
  })
  if (!parsed.success) return c.json({ error: 'bad_coordinates' }, 400)

  const { lat, lon } = parsed.data
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const cached = airCache.get(key)
  if (cached) return c.json(cached)

  try {
    const payload = await fetchForecastBundle(lat, lon, c.req.raw.signal)
    airCache.set(key, payload)
    return c.json(payload)
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 502
    return c.json({ error: 'upstream_unavailable', detail: status }, 502)
  }
})

api.get('/geocode', async (c) => {
  const blocked = checkRateLimit(c, readLimiter)
  if (blocked) return blocked

  const query = z.string().trim().min(2).max(60).safeParse(c.req.query('q'))
  if (!query.success) return c.json({ error: 'bad_query' }, 400)

  const key = query.data.toLowerCase()
  const cached = geoCache.get(key)
  if (cached) return c.json(cached)

  try {
    const url = buildUrl('https://geocoding-api.open-meteo.com/v1/search', {
      name: query.data,
      count: 6,
      language: 'en',
      format: 'json',
    })
    const raw = await fetchJson(url, c.req.raw.signal)
    const parsed = geocodeResponseSchema.parse(raw)

    const payload: GeocodePayload = {
      results: (parsed.results ?? []).map((place) => ({
        id: place.id,
        name: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone ?? 'auto',
        country: place.country ?? '',
        admin1: place.admin1 ?? '',
      })),
    }

    geoCache.set(key, payload)
    return c.json(payload)
  } catch {
    return c.json({ error: 'upstream_unavailable' }, 502)
  }
})

api.post('/plan', async (c) => {
  const blocked = checkRateLimit(c, planLimiter)
  if (blocked) return blocked

  const length = Number(c.req.header('content-length') ?? '0')
  if (Number.isFinite(length) && length > MAX_PLAN_BODY_BYTES) {
    return c.json({ error: 'too_large' }, 413)
  }

  const raw = await readTextLimited(c.req.raw, MAX_PLAN_BODY_BYTES)
  if (raw === null) {
    return c.json({ error: 'too_large' }, 413)
  }

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
  if (cached) return c.json(cached)

  const enginePlan = composePlan(request.facts, request.profile)
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

  if (apiKey) {
    try {
      const written = await writePlanWithModel(request.profile, request.facts, apiKey, model)
      if (written) {
        const payload: PlanPayload = { ...written, source: 'model' }
        planCache.set(cacheKey, payload)
        return c.json(payload)
      }
    } catch {
      // fall through to the engine: a slow model must never break the page
    }
  }

  return c.json(enginePlan)
})
