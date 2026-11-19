import { MINUTE_VENTILATION } from './dose'
import { modelIndoor } from './indoor'
import { cleanestWindow, meanPm25 } from './planner'
import type { CleanWindow, HourPoint } from './types'

/**
 * Ward mode is a bottom-up scenario, not a measurement. It answers one question honestly: if N
 * households stop burning wood, how much PM2.5 stops being emitted, how much CO₂e changes, and how
 * much less do the people in those homes breathe in? Every factor is listed at /method.
 */

export const HOUSEHOLD_FUEL = {
  biomass: { pm25KgPerYear: 4.5, co2eKgPerYear: 2250, costInrPerYear: 0 },
  lpg: { pm25KgPerYear: 0.02, co2eKgPerYear: 492, costInrPerYear: 7200 },
  induction: { pm25KgPerYear: 0.005, co2eKgPerYear: 390, costInrPerYear: 4500 },
} as const

export type CleanCookingOption = 'lpg' | 'induction'

export interface WardInput {
  households: number
  /** 0–1 */
  biomassShare: number
  peoplePerHousehold: number
}

export interface WardScenario {
  switchedHouseholds: number
  pm25AvoidedKgPerYear: number
  co2eAvoidedKgPerYear: number
  costDeltaInrPerYear: number
  inhaledAvoidedKgPerYear: number
  peopleProtected: number
}

export function wardScenario(
  input: WardInput,
  targetBiomassShare: number,
  option: CleanCookingOption = 'lpg',
): WardScenario {
  const households = Math.max(0, Math.round(input.households))
  const from = Math.min(1, Math.max(0, input.biomassShare))
  const to = Math.min(from, Math.max(0, targetBiomassShare))
  const switched = Math.round(households * (from - to))
  const people = switched * Math.max(1, input.peoplePerHousehold)

  const before = HOUSEHOLD_FUEL.biomass
  const after = HOUSEHOLD_FUEL[option]

  // Kitchen concentration change for a typical 30 m² apartment at 250 µg/m³ outdoors.
  const kitchenBefore = modelIndoor({
    outdoorPm25: 250,
    dwelling: 'apartment',
    fuel: 'biomass',
    floorAreaM2: 30,
    purifierCadr: 0,
  }).cookingPeakPm25
  const kitchenAfter = modelIndoor({
    outdoorPm25: 250,
    dwelling: 'apartment',
    fuel: option === 'induction' ? 'none' : 'lpg',
    floorAreaM2: 30,
    purifierCadr: 0,
  }).cookingPeakPm25
  const kitchenDelta = Math.max(0, kitchenBefore - kitchenAfter)

  // 3 cooking hours a day at moderate activity, for every person in the household.
  const inhaledUgPerPersonPerYear =
    kitchenDelta * 180 * MINUTE_VENTILATION.moderate * 365

  return {
    switchedHouseholds: switched,
    pm25AvoidedKgPerYear: switched * (before.pm25KgPerYear - after.pm25KgPerYear),
    co2eAvoidedKgPerYear: switched * (before.co2eKgPerYear - after.co2eKgPerYear),
    costDeltaInrPerYear: switched * (after.costInrPerYear - before.costInrPerYear),
    inhaledAvoidedKgPerYear: (people * inhaledUgPerPersonPerYear) / 1e9,
    peopleProtected: people,
  }
}

export interface RecessPlan {
  best: CleanWindow
  currentStart: number
  currentMean: number
  bestMean: number
  /** µg of PM2.5 not inhaled by the whole school on one day */
  savedUgPerDay: number
}

/**
 * A school decides one thing: when 400 children go outside. The cleanest 45 minutes between
 * assembly and the last bell is a computable answer, and the difference between 10:30 and 14:00 in
 * a winter inversion is often a factor of three.
 */
export function schoolRecess(
  points: HourPoint[],
  children: number,
  currentStart = 10.5,
  durationHours = 0.75,
): RecessPlan | null {
  const best = cleanestWindow(points, durationHours, 8, 16)
  if (!best) return null
  const currentMean = meanPm25(points, currentStart, durationHours)
  if (currentMean == null) return null
  const minutes = durationHours * 60
  const currentDose = children * currentMean * minutes * MINUTE_VENTILATION.light
  const bestDose = children * best.meanPm25 * minutes * MINUTE_VENTILATION.light
  return {
    best,
    currentStart,
    currentMean,
    bestMean: best.meanPm25,
    savedUgPerDay: Math.max(0, currentDose - bestDose),
  }
}
