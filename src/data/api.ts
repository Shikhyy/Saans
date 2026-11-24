import type { PlanFacts } from '../core/plan'
import {
  airPayloadSchema,
  geocodePayloadSchema,
  planPayloadSchema,
  type AirPayload,
  type CityResult,
  type PlanPayload,
} from '../core/schemas'
import type { HouseholdProfile } from '../core/types'

export type { CityResult }

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function json(response: Response): Promise<unknown> {
  if (!response.ok) throw new ApiError(`Request failed: ${response.status}`, response.status)
  return response.json()
}

export async function fetchAir(
  latitude: number,
  longitude: number,
  signal: AbortSignal,
): Promise<AirPayload> {
  const url = new URL('/api/air', window.location.origin)
  url.searchParams.set('lat', latitude.toFixed(3))
  url.searchParams.set('lon', longitude.toFixed(3))
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  return airPayloadSchema.parse(await json(response))
}

export async function searchCities(query: string, signal: AbortSignal): Promise<CityResult[]> {
  const url = new URL('/api/geocode', window.location.origin)
  url.searchParams.set('q', query)
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  return geocodePayloadSchema.parse(await json(response)).results
}

export async function requestPlan(
  profile: HouseholdProfile,
  facts: PlanFacts,
  signal: AbortSignal,
): Promise<PlanPayload> {
  const response = await fetch('/api/plan', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ profile, facts }),
  })
  return planPayloadSchema.parse(await json(response))
}
