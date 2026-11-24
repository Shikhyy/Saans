import { airPayloadSchema, profileSchema, type AirPayload } from '../core/schemas'
import type { HouseholdProfile } from '../core/types'

const PROFILE_KEY = 'saans.profile.v1'
const AIR_KEY = 'saans.air.v1'
const MAX_AIR_CACHE_AGE_MS = 24 * 60 * 60 * 1000

export const DEFAULT_PROFILE: HouseholdProfile = {
  city: 'Delhi',
  latitude: 28.6139,
  longitude: 77.209,
  timezone: 'Asia/Kolkata',
  dwelling: 'apartment',
  fuel: 'lpg',
  purifierCadr: 0,
  floorAreaM2: 42,
  commuteMode: 'car',
  commuteKm: 12,
  members: ['adult', 'child', 'elder'],
  language: 'en',
}

/** Read and schema-validate the household profile from `localStorage` or deep-link query params. */
export function readProfile(): HouseholdProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    if (raw) {
      const parsed = profileSchema.safeParse(JSON.parse(raw))
      if (parsed.success) return parsed.data
    }
    const params = new URLSearchParams(window.location.search)
    const city = params.get('city')
    const latRaw = params.get('lat')
    const lonRaw = params.get('lon')
    if (city && latRaw && lonRaw) {
      const candidate: HouseholdProfile = {
        ...DEFAULT_PROFILE,
        city,
        latitude: Number(latRaw),
        longitude: Number(lonRaw),
        language: params.get('lang') === 'hi' ? 'hi' : 'en',
      }
      const validated = profileSchema.safeParse(candidate)
      if (validated.success) return validated.data
    }
  } catch {
    // a corrupt profile or URL parameter should never block the app
  }
  return DEFAULT_PROFILE
}

/** Persist the household profile cleanly when `localStorage` is available. */
export function saveProfile(profile: HouseholdProfile): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // storage may be full or blocked; the app continues in memory
  }
}

/** Read the last saved forecast if it is schema-valid and newer than 24 hours. */
export function readCachedAir(now = Date.now()): AirPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AIR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: number; payload?: unknown }
    if (typeof parsed.at !== 'number' || now - parsed.at > MAX_AIR_CACHE_AGE_MS) return null
    if (!parsed.payload) return null
    const result = airPayloadSchema.safeParse(parsed.payload)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/** Cache the latest live forecast alongside its fetch timestamp for offline use. */
export function cacheAir(payload: AirPayload): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(AIR_KEY, JSON.stringify({ at: Date.now(), payload }))
  } catch {
    // storage may be full or blocked; the app works without it
  }
}
