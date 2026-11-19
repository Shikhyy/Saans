import type { CommuteMode } from './types'

/**
 * Per-kilometre factors for the commute comparison. All three columns are estimates with a
 * documented basis, and all three are shown next to the result so a reader can disagree with them.
 *
 * - CO₂: UK DEFRA / India GHG Platform order-of-magnitude figures for passenger-km.
 * - Cost: Indian metro-city pump prices, 2026, per passenger-km.
 * - Exposure: how much of the roadside concentration reaches the traveller. Metro platforms are
 *   filtered and enclosed; a cyclist sits in the plume and breathes harder.
 */
export interface ModeProfile {
  label: string
  co2GPerKm: number
  costInrPerKm: number
  /** multiplier on ambient PM2.5 while travelling */
  exposureFactor: number
  speedKmh: number
}

export const MODES: Record<CommuteMode, ModeProfile> = {
  walk: { label: 'Walk', co2GPerKm: 0, costInrPerKm: 0, exposureFactor: 1, speedKmh: 4.5 },
  cycle: { label: 'Cycle', co2GPerKm: 0, costInrPerKm: 0, exposureFactor: 1.15, speedKmh: 14 },
  bus: { label: 'Bus', co2GPerKm: 55, costInrPerKm: 1.5, exposureFactor: 0.85, speedKmh: 18 },
  metro: { label: 'Metro', co2GPerKm: 25, costInrPerKm: 2.5, exposureFactor: 0.35, speedKmh: 30 },
  car: { label: 'Car', co2GPerKm: 130, costInrPerKm: 8.5, exposureFactor: 0.9, speedKmh: 22 },
  'two-wheeler': {
    label: 'Two-wheeler',
    co2GPerKm: 45,
    costInrPerKm: 3.2,
    exposureFactor: 1.05,
    speedKmh: 25,
  },
  auto: { label: 'Auto', co2GPerKm: 70, costInrPerKm: 12, exposureFactor: 1.05, speedKmh: 20 },
}
