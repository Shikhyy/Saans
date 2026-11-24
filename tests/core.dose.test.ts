import { describe, expect, it } from 'vitest'
import {
  budgetUsed,
  dailyBudget,
  inhaledUg,
  MINUTE_VENTILATION,
  roundUg,
  WHO_24H_PM25,
  WHO_DAILY_INHALED_UG,
} from '../src/core/dose'
import {
  modelIndoor,
  interventions,
  CORSI_ROSENTHAL,
  COOKING_GENERATION_UG_PER_H,
} from '../src/core/indoor'

describe('inhaled mass', () => {
  it('is concentration × ventilation × minutes', () => {
    expect(inhaledUg(100, 60, 'light')).toBeCloseTo(100 * 60 * 0.012, 6)
    expect(inhaledUg(187, 45, 'moderate')).toBeCloseTo(210.375, 6)
  })

  it('is zero for no time, no air, or nonsense', () => {
    expect(inhaledUg(200, 0, 'light')).toBe(0)
    expect(inhaledUg(0, 60, 'light')).toBe(0)
    expect(inhaledUg(Number.NaN, 60, 'light')).toBe(0)
  })

  it('orders activity by breathing rate', () => {
    expect(MINUTE_VENTILATION.rest).toBeLessThan(MINUTE_VENTILATION.light)
    expect(MINUTE_VENTILATION.light).toBeLessThan(MINUTE_VENTILATION.moderate)
    expect(MINUTE_VENTILATION.moderate).toBeLessThan(MINUTE_VENTILATION.vigorous)
  })
})

describe('the household budget', () => {
  it('is a day at the WHO guideline at light activity', () => {
    expect(WHO_24H_PM25).toBe(15)
    expect(WHO_DAILY_INHALED_UG).toBeCloseTo(259.2, 6)
    expect(dailyBudget('adult')).toBeCloseTo(259.2, 6)
  })

  it('is smaller for the more sensitive profiles', () => {
    expect(dailyBudget('asthma')).toBeLessThan(dailyBudget('child'))
    expect(dailyBudget('child')).toBeLessThan(dailyBudget('adult'))
  })

  it('reports the share spent', () => {
    expect(budgetUsed(259.2, 'adult')).toBeCloseTo(1, 6)
    expect(budgetUsed(0, 'adult')).toBe(0)
  })

  it('rounds only for display', () => {
    expect(roundUg(210.375)).toBe(210)
    expect(roundUg(Number.NaN)).toBe(0)
  })
})

describe('the indoor mass balance', () => {
  const base = {
    outdoorPm25: 250,
    dwelling: 'apartment' as const,
    fuel: 'biomass' as const,
    floorAreaM2: 30,
    purifierCadr: 0,
  }

  it('computes volume from floor area at a 2.7 m ceiling', () => {
    expect(modelIndoor(base).volumeM3).toBeCloseTo(81, 6)
  })

  it('puts more particles in the room from wood than from LPG', () => {
    const wood = modelIndoor(base).cookingPeakPm25
    const lpg = modelIndoor({ ...base, fuel: 'lpg' }).cookingPeakPm25
    // The stove generates about six times as much; the room peak also carries infiltrated
    // outdoor air, so the ratio in the room is smaller than the ratio at the flame.
    expect(COOKING_GENERATION_UG_PER_H.biomass / COOKING_GENERATION_UG_PER_H.lpg).toBeGreaterThan(6)
    expect(wood).toBeGreaterThan(lpg * 2)
  })

  it('lowers the peak when a purifier is added', () => {
    const without = modelIndoor(base).cookingPeakPm25
    const withFilter = modelIndoor({ ...base, purifierCadr: 300 }).cookingPeakPm25
    expect(withFilter).toBeLessThan(without)
  })

  it('never returns a negative concentration or a negative clearance time', () => {
    const result = modelIndoor({ ...base, outdoorPm25: -50, purifierCadr: -10 })
    expect(result.cookingPeakPm25).toBeGreaterThanOrEqual(0)
    expect(result.clearanceMinutes).toBeGreaterThan(0)
  })

  it('sizes a purifier at five air changes an hour', () => {
    const result = modelIndoor(base)
    expect(result.recommendedCadr).toBe(Math.round(result.volumeM3 * 5))
  })
})

describe('ranked interventions', () => {
  const input = {
    outdoorPm25: 250,
    dwelling: 'one-room' as const,
    fuel: 'biomass' as const,
    floorAreaM2: 24,
    purifierCadr: 0,
  }

  it('sorts by rupees per microgram removed', () => {
    const list = interventions(input)
    const costs = list.map((item) => item.costPerUg)
    expect([...costs].sort((a, b) => a - b)).toEqual(costs)
  })

  it('offers the box-fan filter only when there is no purifier', () => {
    expect(interventions(input).some((item) => item.id === 'corsi')).toBe(true)
    expect(interventions({ ...input, purifierCadr: 300 }).some((item) => item.id === 'corsi')).toBe(
      false,
    )
  })

  it('offers the fuel switch only to households burning biomass', () => {
    expect(interventions(input).some((item) => item.id === 'fuel')).toBe(true)
    expect(interventions({ ...input, fuel: 'lpg' }).some((item) => item.id === 'fuel')).toBe(false)
  })

  it('prices the box fan below a bought purifier', () => {
    const list = interventions(input)
    const corsi = list.find((item) => item.id === 'corsi')
    const purifier = list.find((item) => item.id === 'purifier')
    expect(corsi?.costInr).toBe(CORSI_ROSENTHAL.costInr)
    expect(corsi!.costInr).toBeLessThan(purifier!.costInr)
  })

  it('localizes intervention copy into Hindi when asked', () => {
    const list = interventions(input, 'hi')
    expect(list[0]?.title).toMatch(/[\u0900-\u097F]/)
    expect(list[0]?.detail).toMatch(/[\u0900-\u097F]/)
  })
})
