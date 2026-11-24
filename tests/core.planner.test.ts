import { describe, expect, it } from 'vitest'
import {
  bestShiftFor,
  cleanestWindow,
  dayDose,
  DEFAULT_ROUTINES,
  fitRoutinesInWindow,
  formatHour,
  meanPm25,
  moveRoutine,
  pm25At,
  routineDose,
} from '../src/core/planner'
import { compareCommute, fuelSwitchImpact } from '../src/core/impact'
import { schoolRecess, wardScenario } from '../src/core/ward'
import type { HourPoint } from '../src/core/types'

/** A winter day with a dawn peak and an afternoon dip, the shape the planner is built for. */
function day(): HourPoint[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    time: `2026-11-23T${String(hour).padStart(2, '0')}:00`,
    hour,
    pm25: hour < 12 ? 240 - hour * 10 : 120 + (hour - 12) * 12,
    pm10: null,
    no2: null,
    so2: null,
    o3: null,
    co: null,
    windKmh: null,
    boundaryLayerM: null,
    temperatureC: null,
    humidity: null,
  }))
}

describe('reading the forecast', () => {
  it('interpolates between hours', () => {
    const points = day()
    expect(pm25At(points, 6)).toBe(180)
    expect(pm25At(points, 6.5)).toBe(175)
  })

  it('wraps past midnight', () => {
    expect(pm25At(day(), 24)).toBe(240)
    expect(pm25At(day(), -1)).toBe(pm25At(day(), 23))
  })

  it('returns null when there is no data', () => {
    expect(pm25At([], 7)).toBeNull()
  })

  it('averages a window', () => {
    expect(meanPm25(day(), 12, 2)).toBeCloseTo(130.5, 1)
    expect(meanPm25(day(), 12, 0)).toBeNull()
  })
})

describe('the clean window', () => {
  it('finds the afternoon dip, not the dawn peak', () => {
    const window = cleanestWindow(day(), 2)
    expect(window).not.toBeNull()
    expect(window!.startHour).toBeGreaterThanOrEqual(10)
    expect(window!.meanPm25).toBeLessThan(140)
  })

  it('returns null when the window cannot fit', () => {
    expect(cleanestWindow(day(), 20, 6, 21)).toBeNull()
  })
})

describe('routines', () => {
  const points = day()

  it('prices a routine by the air at its hour', () => {
    const walk = DEFAULT_ROUTINES[0]!
    const early = routineDose({ ...walk, start: 6 }, points, 100)
    const late = routineDose({ ...walk, start: 13 }, points, 100)
    expect(early).toBeGreaterThan(late)
  })

  it('uses the indoor concentration for indoor routines', () => {
    const cook = DEFAULT_ROUTINES.find((routine) => routine.place === 'indoor')!
    expect(routineDose(cook, points, 100)).toBeCloseTo(100 * cook.minutes * 0.012, 6)
  })

  it('clamps a move inside the day', () => {
    const walk = DEFAULT_ROUTINES[0]!
    expect(moveRoutine(walk, -4).start).toBe(0)
    expect(moveRoutine(walk, 30).start).toBe(23.75)
  })

  it('suggests a cheaper hour and reports the saving', () => {
    const walk = DEFAULT_ROUTINES[0]!
    const shift = bestShiftFor(walk, points, 100)
    expect(shift).not.toBeNull()
    expect(shift!.savedUg).toBeGreaterThan(0)
    expect(shift!.start).toBeGreaterThanOrEqual(12)
  })

  it('never suggests moving an immovable routine', () => {
    const cook = DEFAULT_ROUTINES.find((routine) => !routine.movable)!
    expect(bestShiftFor(cook, points, 100)).toBeNull()
  })

  it('adds the day up', () => {
    const total = dayDose(DEFAULT_ROUTINES, points, 100)
    const parts = DEFAULT_ROUTINES.reduce(
      (sum, routine) => sum + routineDose(routine, points, 100),
      0,
    )
    expect(total).toBeCloseTo(parts, 6)
  })

  it('fits movable routines inside the clean window without shifting immovable ones', () => {
    const clean = { startHour: 13, endHour: 15, meanPm25: 90 }
    const fitted = fitRoutinesInWindow(DEFAULT_ROUTINES, clean)
    const cookBefore = DEFAULT_ROUTINES.find((routine) => !routine.movable)!
    const cookAfter = fitted.find((routine) => !routine.movable)!
    expect(cookAfter.start).toBe(cookBefore.start)
    for (const routine of fitted.filter((item) => item.movable)) {
      expect(routine.start).toBeGreaterThanOrEqual(clean.startHour)
      expect(routine.start).toBeLessThanOrEqual(clean.endHour)
    }
  })
})

describe('clock labels', () => {
  it('formats decimal hours', () => {
    expect(formatHour(7.5)).toBe('07:30')
    expect(formatHour(0)).toBe('00:00')
    expect(formatHour(23.999)).toBe('00:00')
    expect(formatHour(25)).toBe('01:00')
  })
})

describe('commute comparison', () => {
  it('holds distance constant and changes exposure', () => {
    const result = compareCommute(12, 'car', 'metro', 200)
    expect(result.distanceKm).toBe(12)
    expect(result.deltaUg).toBeLessThan(0)
    expect(result.deltaCo2G).toBeLessThan(0)
  })

  it('costs more to cycle in dirty air than to ride the metro', () => {
    const result = compareCommute(12, 'metro', 'cycle', 200)
    expect(result.deltaUg).toBeGreaterThan(0)
    expect(result.deltaCostInr).toBeLessThan(0)
  })
})

describe('fuel switching', () => {
  it('reports the annual carbon and cost change', () => {
    const result = fuelSwitchImpact('biomass', 'lpg', 300)
    expect(result.co2DeltaKgPerYear).toBeLessThan(0)
    expect(result.costDeltaInrPerYear).toBeGreaterThan(0)
    expect(result.indoorDeltaUg).toBe(300)
  })
})

describe('the ward scenario', () => {
  const input = { households: 480, biomassShare: 0.72, peoplePerHousehold: 5 }

  it('counts only households that actually switch', () => {
    const scenario = wardScenario(input, 0.72)
    expect(scenario.switchedHouseholds).toBe(0)
    expect(scenario.pm25AvoidedKgPerYear).toBe(0)
  })

  it('never switches a negative number of households', () => {
    const scenario = wardScenario(input, 0.99)
    expect(scenario.switchedHouseholds).toBe(0)
  })

  it('scales with the share that switches', () => {
    const half = wardScenario(input, 0.36)
    const all = wardScenario(input, 0)
    expect(all.switchedHouseholds).toBeGreaterThan(half.switchedHouseholds)
    expect(all.pm25AvoidedKgPerYear).toBeGreaterThan(half.pm25AvoidedKgPerYear)
    expect(all.peopleProtected).toBe(all.switchedHouseholds * 5)
  })

  it('protects more people than it switches households', () => {
    const scenario = wardScenario(input, 0)
    expect(scenario.peopleProtected).toBeGreaterThan(scenario.switchedHouseholds)
  })
})

describe('school recess', () => {
  it('moves recess out of the morning peak', () => {
    const plan = schoolRecess(day(), 400, 10.5, 0.75)
    expect(plan).not.toBeNull()
    expect(plan!.best.startHour).toBeGreaterThan(10.5)
    expect(plan!.savedUgPerDay).toBeGreaterThan(0)
  })

  it('returns null without a forecast', () => {
    expect(schoolRecess([], 400)).toBeNull()
  })
})
