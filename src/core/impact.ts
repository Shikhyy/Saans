import { inhaledUg } from './dose'
import { MODES } from './modes'
import type { CommuteMode } from './types'

export interface CommuteComparison {
  fromMode: CommuteMode
  toMode: CommuteMode
  distanceKm: number
  fromMinutes: number
  toMinutes: number
  fromUg: number
  toUg: number
  /** negative = you breathe less */
  deltaUg: number
  deltaCo2G: number
  deltaCostInr: number
}

/**
 * Compares two ways of making the same trip. The trip is the same length, so the difference is
 * entirely in the concentration you sit in, how hard you breathe, and how long you are exposed.
 */
export function compareCommute(
  distanceKm: number,
  fromMode: CommuteMode,
  toMode: CommuteMode,
  ambientPm25: number,
): CommuteComparison {
  const from = MODES[fromMode]
  const to = MODES[toMode]
  const km = Math.max(0, distanceKm)

  const fromMinutes = (km / from.speedKmh) * 60
  const toMinutes = (km / to.speedKmh) * 60

  const fromUg = inhaledUg(ambientPm25 * from.exposureFactor, fromMinutes, 'light')
  const toUg = inhaledUg(ambientPm25 * to.exposureFactor, toMinutes, 'light')

  return {
    fromMode,
    toMode,
    distanceKm: km,
    fromMinutes,
    toMinutes,
    fromUg,
    toUg,
    deltaUg: toUg - fromUg,
    deltaCo2G: (to.co2GPerKm - from.co2GPerKm) * km,
    deltaCostInr: (to.costInrPerKm - from.costInrPerKm) * km,
  }
}

export interface FuelSwitchImpact {
  fromFuel: string
  toFuel: string
  /** µg/m³ removed from the kitchen while cooking */
  indoorDeltaUg: number
  co2DeltaKgPerYear: number
  costDeltaInrPerYear: number
}

/**
 * Annual fuel-switch accounting. The indoor figure comes from the household model; the CO₂e and
 * cost figures are per-household annual estimates for a family cooking three meals a day.
 * Wood smoke carries a high CO₂-equivalent because of methane and black carbon, not because the
 * carbon is fossil — that is why the number is not zero.
 */
export const FUEL_ANNUAL = {
  biomass: { co2eKg: 2250, costInr: 0 },
  lpg: { co2eKg: 492, costInr: 7200 },
  induction: { co2eKg: 390, costInr: 4500 },
} as const

export function fuelSwitchImpact(
  from: 'biomass' | 'lpg',
  to: 'lpg' | 'induction',
  indoorDeltaUg: number,
): FuelSwitchImpact {
  return {
    fromFuel: from,
    toFuel: to,
    indoorDeltaUg,
    co2DeltaKgPerYear: FUEL_ANNUAL[to].co2eKg - FUEL_ANNUAL[from].co2eKg,
    costDeltaInrPerYear: FUEL_ANNUAL[to].costInr - FUEL_ANNUAL[from].costInr,
  }
}
