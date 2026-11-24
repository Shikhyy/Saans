/**
 * Shared domain types. Nothing in this folder may import React, the DOM or the network:
 * every function here has to be callable from a test, a worker or a serverless handler.
 */

export type Pollutant = 'pm2_5' | 'pm10' | 'no2' | 'so2' | 'o3' | 'co'

export type AqiCategory = 'good' | 'satisfactory' | 'moderate' | 'poor' | 'very-poor' | 'severe'

export type Activity = 'rest' | 'light' | 'moderate' | 'vigorous'

export type Place = 'outdoor' | 'indoor' | 'commute'

export type HealthProfile = 'adult' | 'child' | 'elder' | 'asthma' | 'pregnancy'

export type Fuel = 'lpg' | 'biomass' | 'mixed' | 'none'

export type Dwelling = 'one-room' | 'apartment' | 'house'

export type CommuteMode = 'walk' | 'cycle' | 'bus' | 'metro' | 'car' | 'two-wheeler' | 'auto'

/** One local hour of air + weather. Values are null when the upstream grid has no reading. */
export interface HourPoint {
  /** ISO local time, e.g. 2026-11-23T07:00 */
  time: string
  /** 0–23 in the location's own timezone */
  hour: number
  pm25: number | null
  pm10: number | null
  no2: number | null
  so2: number | null
  o3: number | null
  /** mg/m³ (upstream reports µg/m³; converted at the boundary) */
  co: number | null
  windKmh: number | null
  /** Boundary-layer height in metres — the single best predictor of winter smog. */
  boundaryLayerM: number | null
  temperatureC: number | null
  humidity: number | null
}

export interface DaySeries {
  /** YYYY-MM-DD in the location's timezone */
  date: string
  points: HourPoint[]
}

export interface AqiResult {
  aqi: number
  category: AqiCategory
  dominant: Pollutant | null
  subIndices: Partial<Record<Pollutant, number>>
}

export interface Routine {
  id: string
  label: string
  /** decimal hour, e.g. 7.5 = 07:30 */
  start: number
  minutes: number
  activity: Activity
  place: Place
  mode?: CommuteMode
  /** whether the user is allowed to move this routine */
  movable: boolean
}

export interface HouseholdProfile {
  city: string
  latitude: number
  longitude: number
  timezone: string
  dwelling: Dwelling
  fuel: Fuel
  purifierCadr: number
  floorAreaM2: number
  commuteMode: CommuteMode
  commuteKm: number
  members: HealthProfile[]
  language: 'en' | 'hi'
}

export interface CleanWindow {
  startHour: number
  endHour: number
  meanPm25: number
}

export interface PlanAction {
  title: string
  why: string
  when: string
  impact: string
}

export interface Plan {
  headline: string
  summary: string
  actions: PlanAction[]
  caution: string
  source: 'model' | 'engine'
}
