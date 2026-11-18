import { z } from 'zod'

const nullableNumbers = z.array(z.number().nullable())

export const airHourlySchema = z.object({
  time: z.array(z.string()),
  pm2_5: nullableNumbers.optional(),
  pm10: nullableNumbers.optional(),
  carbon_monoxide: nullableNumbers.optional(),
  nitrogen_dioxide: nullableNumbers.optional(),
  sulphur_dioxide: nullableNumbers.optional(),
  ozone: nullableNumbers.optional(),
})

export const airResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  hourly: airHourlySchema,
})

export const weatherHourlySchema = z.object({
  time: z.array(z.string()),
  boundary_layer_height: nullableNumbers.optional(),
  wind_speed_10m: nullableNumbers.optional(),
  temperature_2m: nullableNumbers.optional(),
  relative_humidity_2m: nullableNumbers.optional(),
})

export const weatherResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  hourly: weatherHourlySchema,
})

export const geocodeResponseSchema = z.object({
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

export const profileSchema = z.object({
  city: z.string().min(1).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1).max(64),
  dwelling: z.enum(['one-room', 'apartment', 'house']),
  fuel: z.enum(['lpg', 'biomass', 'mixed', 'none']),
  purifierCadr: z.number().min(0).max(2000),
  floorAreaM2: z.number().min(5).max(500),
  commuteMode: z.enum(['walk', 'cycle', 'bus', 'metro', 'car', 'two-wheeler', 'auto']),
  commuteKm: z.number().min(0).max(200),
  members: z
    .array(z.enum(['adult', 'child', 'elder', 'asthma', 'pregnancy']))
    .min(1)
    .max(12),
  language: z.enum(['en', 'hi']),
})

export const planFactsSchema = z.object({
  aqi: z.number().min(0).max(500),
  pm25: z.number().min(0).max(2000),
  category: z.string().max(24),
  cleanWindow: z
    .object({
      startHour: z.number().min(0).max(24),
      endHour: z.number().min(0).max(24),
      meanPm25: z.number().min(0).max(2000),
    })
    .nullable(),
  dayDoseUg: z.number().min(0).max(1e6),
  budgetUg: z.number().min(0).max(1e6),
  indoorPeakPm25: z.number().min(0).max(1e5),
  bestShift: z
    .object({
      label: z.string().max(40),
      start: z.number().min(0).max(24),
      savedUg: z.number().min(0).max(1e6),
    })
    .nullable(),
  topIntervention: z
    .object({
      title: z.string().max(80),
      deltaPm25: z.number().min(0).max(1e5),
      costInr: z.number().min(0).max(1e6),
    })
    .nullable(),
})

export const planRequestSchema = z
  .object({
    profile: profileSchema,
    facts: planFactsSchema,
  })
  .strict()

export const planResponseSchema = z.object({
  headline: z.string().min(1).max(90),
  summary: z.string().min(1).max(360),
  actions: z
    .array(
      z.object({
        title: z.string().min(1).max(64),
        why: z.string().min(1).max(200),
        when: z.string().min(1).max(48),
        impact: z.string().min(1).max(96),
      }),
    )
    .min(2)
    .max(4),
  caution: z.string().min(1).max(200),
})

export const planPayloadSchema = planResponseSchema.extend({
  source: z.enum(['model', 'engine']),
})

export const hourPointSchema = z.object({
  time: z.string(),
  hour: z.number().int().min(0).max(23),
  pm25: z.number().nullable(),
  pm10: z.number().nullable(),
  no2: z.number().nullable(),
  so2: z.number().nullable(),
  o3: z.number().nullable(),
  co: z.number().nullable(),
  windKmh: z.number().nullable(),
  boundaryLayerM: z.number().nullable(),
  temperatureC: z.number().nullable(),
  humidity: z.number().nullable(),
})

export const airPayloadSchema = z.object({
  timezone: z.string(),
  currentHour: z.number(),
  days: z.array(z.object({ date: z.string(), points: z.array(hourPointSchema) })),
  current: hourPointSchema
    .extend({
      aqi: z.object({
        aqi: z.number(),
        category: z.string(),
        dominant: z.string().nullable(),
        subIndices: z.record(z.number()),
      }),
    })
    .nullable(),
  fetchedAt: z.string(),
  attribution: z.string(),
  sample: z.boolean().optional(),
})

export type AirPayload = z.infer<typeof airPayloadSchema>
/** What the model returns: the prose, with no provenance field. */
export type PlanResponse = z.infer<typeof planResponseSchema>
/** What the API returns: the prose plus who wrote it. */
export type PlanPayload = z.infer<typeof planPayloadSchema>
export type PlanRequest = z.infer<typeof planRequestSchema>
