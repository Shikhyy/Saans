import type { Activity, HealthProfile } from './types'

/**
 * Inhaled mass, not deposited dose.
 *
 *   inhaled (µg) = concentration (µg/m³) × minute ventilation (m³/min) × minutes
 *
 * Minute ventilation by activity is the standard adult range used in exposure science
 * (US EPA *Exposure Factors Handbook*, ch. 6): rest ≈ 6 L/min, light ≈ 12, moderate ≈ 25,
 * vigorous ≈ 50. Children breathe less per minute but more per kilogram, so the household
 * budget carries a separate sensitivity factor rather than pretending the physics changes.
 */
export const MINUTE_VENTILATION: Record<Activity, number> = {
  rest: 0.006,
  light: 0.012,
  moderate: 0.025,
  vigorous: 0.05,
}

/** WHO 2021 air-quality guideline: 15 µg/m³ as a 24-hour mean for PM2.5. */
export const WHO_24H_PM25 = 15

/**
 * The inhaled mass a healthy adult accrues in 24 hours at exactly the WHO guideline, at light
 * activity. This is the household "budget" the app spends against: 15 × 1440 × 0.012 ≈ 259 µg.
 */
export const WHO_DAILY_INHALED_UG = WHO_24H_PM25 * 1440 * MINUTE_VENTILATION.light

/** Lower tolerance for the same physics. Not a medical threshold. */
export const SENSITIVITY: Record<HealthProfile, number> = {
  adult: 1,
  child: 0.9,
  elder: 0.85,
  asthma: 0.7,
  pregnancy: 0.8,
}

export const PROFILE_LABEL: Record<HealthProfile, string> = {
  adult: 'Adult',
  child: 'Child',
  elder: 'Older adult',
  asthma: 'Asthma',
  pregnancy: 'Pregnancy',
}

export function inhaledUg(pm25: number, minutes: number, activity: Activity): number {
  if (!Number.isFinite(pm25) || pm25 <= 0 || minutes <= 0) return 0
  return pm25 * minutes * MINUTE_VENTILATION[activity]
}

export function dailyBudget(profile: HealthProfile): number {
  return WHO_DAILY_INHALED_UG * SENSITIVITY[profile]
}

/** Share of the budget already spent, 0–1+. */
export function budgetUsed(spentUg: number, profile: HealthProfile): number {
  const budget = dailyBudget(profile)
  if (budget <= 0) return 0
  return spentUg / budget
}

/** The exposure index shown to the user, rounded for display but never for arithmetic. */
export function roundUg(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}
