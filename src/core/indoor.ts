import { FUEL_ANNUAL } from './impact'
import type { Dwelling, Fuel } from './types'

/**
 * Single-zone steady-state mass balance for a home.
 *
 *   C_in = (P · C_out · ACH_inf + G / V) / (ACH_inf + ACH_filtered)
 *
 * P is the penetration factor for PM2.5 (0.8 is the usual figure for a leaky envelope), G is
 * indoor generation in µg/h, V is room volume and ACH is air changes per hour. A purifier is just
 * another air-change term: ACH_filtered = CADR / V. Everything is an estimate; the inputs are
 * printed at /method so the reader can check the arithmetic.
 */

export const CEILING_M = 2.7
export const PENETRATION = 0.8

export const INFILTRATION_ACH: Record<Dwelling, number> = {
  'one-room': 0.9,
  apartment: 0.5,
  house: 0.35,
}

/** Indoor PM2.5 generation while the stove is on, µg/h. */
export const COOKING_GENERATION_UG_PER_H: Record<Fuel, number> = {
  lpg: 3500,
  biomass: 22000,
  mixed: 12000,
  none: 600,
}

export const COOKING_HOURS_PER_DAY = 3

export interface IndoorInput {
  outdoorPm25: number
  dwelling: Dwelling
  fuel: Fuel
  floorAreaM2: number
  /** m³/h, 0 when there is no purifier */
  purifierCadr: number
}

export interface IndoorResult {
  volumeM3: number
  infiltrationAch: number
  purifierAch: number
  /** concentration while cooking, with whatever filtration is present */
  cookingPeakPm25: number
  /** 21 hours without cooking generation + 3 hours with */
  dailyMeanPm25: number
  recommendedCadr: number
  /** minutes for the purifier to remove 90% of a spike */
  clearanceMinutes: number
}

function concentration(
  outdoor: number,
  achInf: number,
  achFilt: number,
  generation: number,
  volume: number,
): number {
  const inflow = PENETRATION * outdoor * achInf + generation / volume
  const total = achInf + achFilt
  if (total <= 0) return 0
  return inflow / total
}

/** Estimate indoor cooking peak, daily mean PM2.5, target CADR and 90% clearance time. */
export function modelIndoor(input: IndoorInput): IndoorResult {
  const volumeM3 = Math.max(8, input.floorAreaM2) * CEILING_M
  const achInf = INFILTRATION_ACH[input.dwelling]
  const achFilt = Math.max(0, input.purifierCadr) / volumeM3
  const generation = COOKING_GENERATION_UG_PER_H[input.fuel]
  const outdoor = Math.max(0, input.outdoorPm25)

  const cookingPeakPm25 = concentration(outdoor, achInf, achFilt, generation, volumeM3)
  const quietPm25 = concentration(outdoor, achInf, achFilt, 0, volumeM3)
  const dailyMeanPm25 =
    (quietPm25 * (24 - COOKING_HOURS_PER_DAY) + cookingPeakPm25 * COOKING_HOURS_PER_DAY) / 24

  const totalAch = achInf + achFilt
  const clearanceMinutes = totalAch > 0 ? (Math.log(10) / totalAch) * 60 : 0

  return {
    volumeM3,
    infiltrationAch: achInf,
    purifierAch: achFilt,
    cookingPeakPm25,
    dailyMeanPm25,
    recommendedCadr: Math.round(volumeM3 * 5),
    clearanceMinutes,
  }
}

export interface Intervention {
  id: string
  title: string
  detail: string
  /** reduction in cooking-hour PM2.5, µg/m³ */
  deltaPm25: number
  costInr: number
  /** ₹ per µg/m³ removed — lower is better */
  costPerUg: number
  recurring: boolean
}

/** The famous four-filter box fan. Costs about a purifier's filter, works about as well. */
export const CORSI_ROSENTHAL = {
  costInr: 2200,
  cadrM3h: 200,
  watts: 45,
  filters: 4,
  filterSpec: 'MERV-13, 20 × 20 × 1 in',
} as const

export const PURIFIER_OPTIONS = [
  {
    id: 'small',
    label: 'Small room purifier',
    hiLabel: 'छोटा कमरा प्यूरीफ़ायर',
    cadr: 180,
    costInr: 9000,
  },
  {
    id: 'medium',
    label: 'Living-room purifier',
    hiLabel: 'बैठक कमरा प्यूरीफ़ायर',
    cadr: 300,
    costInr: 16000,
  },
  {
    id: 'large',
    label: 'Large-room purifier',
    hiLabel: 'बड़ा कमरा प्यूरीफ़ायर',
    cadr: 500,
    costInr: 28000,
  },
] as const

function deltaFor(base: IndoorResult, next: IndoorResult): number {
  return Math.max(0, base.cookingPeakPm25 - next.cookingPeakPm25)
}

/** Rank household indoor-air interventions by rupees spent per µg/m³ removed. */
export function interventions(input: IndoorInput, language: 'en' | 'hi' = 'en'): Intervention[] {
  const hi = language === 'hi'
  const base = modelIndoor(input)
  const list: Intervention[] = []

  if (input.purifierCadr <= 0) {
    const cr = modelIndoor({ ...input, purifierCadr: CORSI_ROSENTHAL.cadrM3h })
    list.push({
      id: 'corsi',
      title: hi ? 'बॉक्स-फ़ैन फ़िल्टर बनाएँ' : 'Build a box-fan filter',
      detail: hi
        ? `बॉक्स फ़ैन पर चार ${CORSI_ROSENTHAL.filterSpec} फ़िल्टर। लगभग ${CORSI_ROSENTHAL.cadrM3h} m³/h साफ़ हवा, एक फ़िल्टर की कीमत में।`
        : `Four ${CORSI_ROSENTHAL.filterSpec} filters taped to a box fan. About ${CORSI_ROSENTHAL.cadrM3h} m³/h of clean air for the price of one replacement filter.`,
      deltaPm25: deltaFor(base, cr),
      costInr: CORSI_ROSENTHAL.costInr,
      costPerUg: 0,
      recurring: false,
    })
    const sized =
      PURIFIER_OPTIONS.find((option) => option.cadr >= base.recommendedCadr) ?? PURIFIER_OPTIONS[2]
    const withPurifier = modelIndoor({ ...input, purifierCadr: sized.cadr })
    list.push({
      id: 'purifier',
      title: hi
        ? `${base.recommendedCadr} m³/h का प्यूरीफ़ायर चुनें`
        : `Size a purifier to ${base.recommendedCadr} m³/h`,
      detail: hi
        ? `${sized.hiLabel} (${sized.cadr} m³/h) से ${Math.round(base.volumeM3)} m³ कमरे में प्रति घंटे ${(sized.cadr / base.volumeM3).toFixed(1)} बार हवा बदलती है।`
        : `${sized.label} at ${sized.cadr} m³/h gives ${(sized.cadr / base.volumeM3).toFixed(1)} air changes an hour in ${Math.round(base.volumeM3)} m³.`,
      deltaPm25: deltaFor(base, withPurifier),
      costInr: sized.costInr,
      costPerUg: 0,
      recurring: false,
    })
  }

  if (input.fuel === 'biomass' || input.fuel === 'mixed') {
    const lpg = modelIndoor({ ...input, fuel: 'lpg' })
    list.push({
      id: 'fuel',
      title: hi ? 'लकड़ी छोड़ स्वच्छ ईंधन अपनाएँ' : 'Move cooking off wood',
      detail: hi
        ? 'लकड़ी का चूल्हा LPG की तुलना में रसोई में लगभग छह गुना कण छोड़ता है, और दिन में तीन घंटे चलता है।'
        : 'A biomass stove puts roughly six times the particles into the kitchen that an LPG flame does, and it does it for three hours a day.',
      deltaPm25: deltaFor(base, lpg),
      costInr: FUEL_ANNUAL.lpg.costInr,
      costPerUg: 0,
      recurring: true,
    })
  }

  const sealed = modelIndoor({
    ...input,
    dwelling: input.dwelling === 'one-room' ? 'apartment' : 'house',
  })
  list.push({
    id: 'seal',
    title: hi ? 'खिड़की-दरवाज़े सील करें' : 'Close the envelope',
    detail: hi
      ? 'खिड़की की दरारें टेप करना और दरवाज़े पर पर्दा लगाना बाहर की हवा का रिसाव घटाता है और प्यूरीफ़ायर की साफ़ हवा भीतर रोकता है।'
      : 'Taping window seams and hanging a curtain over the door drops infiltration from a leaky shell to a tight one — free, and it keeps the purifier’s work from leaking out.',
    deltaPm25: deltaFor(base, sealed),
    costInr: 600,
    costPerUg: 0,
    recurring: false,
  })

  return list
    .map((item) => ({
      ...item,
      costPerUg: item.deltaPm25 > 0 ? item.costInr / item.deltaPm25 : Infinity,
    }))
    .sort((a, b) => a.costPerUg - b.costPerUg)
}
