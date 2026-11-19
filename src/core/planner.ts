import { inhaledUg } from './dose'
import { MODES } from './modes'
import type { CleanWindow, HourPoint, Routine } from './types'

/**
 * The day planner is pure arithmetic over the forecast: for every routine, concentration at its
 * hour × breathing rate × minutes. Moving a routine re-reads the same forecast at a different hour,
 * which is why the counter can respond instantly while dragging.
 */

/** A representative household day. Times are decimal hours in the location's timezone. */
export const DEFAULT_ROUTINES: Routine[] = [
  {
    id: 'walk',
    label: 'Morning walk',
    start: 6.5,
    minutes: 45,
    activity: 'moderate',
    place: 'outdoor',
    movable: true,
  },
  {
    id: 'school',
    label: 'School run',
    start: 7.75,
    minutes: 30,
    activity: 'light',
    place: 'commute',
    mode: 'two-wheeler',
    movable: true,
  },
  {
    id: 'commute',
    label: 'Commute to work',
    start: 9,
    minutes: 40,
    activity: 'light',
    place: 'commute',
    mode: 'car',
    movable: true,
  },
  {
    id: 'lunch',
    label: 'Lunch outside',
    start: 13,
    minutes: 30,
    activity: 'light',
    place: 'outdoor',
    movable: true,
  },
  {
    id: 'play',
    label: 'Evening play',
    start: 17.5,
    minutes: 45,
    activity: 'moderate',
    place: 'outdoor',
    movable: true,
  },
  {
    id: 'cook',
    label: 'Cooking',
    start: 18.5,
    minutes: 60,
    activity: 'light',
    place: 'indoor',
    movable: false,
  },
  {
    id: 'errand',
    label: 'Evening errand',
    start: 19.5,
    minutes: 25,
    activity: 'light',
    place: 'commute',
    mode: 'auto',
    movable: true,
  },
]

const seriesCache = new WeakMap<HourPoint[], Map<number, number>>()

function seriesOf(points: HourPoint[]): Map<number, number> {
  const cached = seriesCache.get(points)
  if (cached) return cached
  const map = new Map<number, number>()
  for (const point of points) {
    if (point.pm25 != null && Number.isFinite(point.pm25)) map.set(point.hour, point.pm25)
  }
  seriesCache.set(points, map)
  return map
}

/** Linear interpolation between the hour and the next, wrapping past midnight. */
export function pm25At(points: HourPoint[], hour: number): number | null {
  const series = seriesOf(points)
  if (series.size === 0) return null
  const normalised = ((hour % 24) + 24) % 24
  const base = Math.floor(normalised)
  const next = (base + 1) % 24
  const a = series.get(base)
  const b = series.get(next)
  if (a == null && b == null) return null
  if (a == null) return b ?? null
  if (b == null) return a
  return a + (b - a) * (normalised - base)
}

export function pointAt(points: HourPoint[], hour: number): HourPoint | null {
  const target = Math.round(((hour % 24) + 24) % 24)
  return points.find((point) => point.hour === target) ?? null
}

export function routineDose(
  routine: Routine,
  points: HourPoint[],
  indoorPm25: number,
): number {
  if (routine.place === 'indoor') return inhaledUg(indoorPm25, routine.minutes, routine.activity)
  const ambient = pm25At(points, routine.start)
  if (ambient == null) return 0
  const factor = routine.place === 'commute' && routine.mode ? MODES[routine.mode].exposureFactor : 1
  return inhaledUg(ambient * factor, routine.minutes, routine.activity)
}

export function dayDose(
  routines: Routine[],
  points: HourPoint[],
  indoorPm25: number,
): number {
  return routines.reduce((sum, routine) => sum + routineDose(routine, points, indoorPm25), 0)
}

export function meanPm25(
  points: HourPoint[],
  startHour: number,
  durationHours: number,
): number | null {
  if (durationHours <= 0) return null
  const step = 0.25
  let sum = 0
  let count = 0
  for (let t = 0; t < durationHours; t += step) {
    const value = pm25At(points, startHour + t)
    if (value == null) return null
    sum += value
    count += 1
  }
  return count === 0 ? null : sum / count
}

/** The cleanest stretch of `durationHours` between two hours, scanning in half-hour steps. */
export function cleanestWindow(
  points: HourPoint[],
  durationHours: number,
  fromHour = 6,
  toHour = 21,
): CleanWindow | null {
  const latest = toHour - durationHours
  if (latest < fromHour) return null
  let best: CleanWindow | null = null
  for (let start = fromHour; start <= latest + 1e-9; start += 0.5) {
    const mean = meanPm25(points, start, durationHours)
    if (mean == null) continue
    if (!best || mean < best.meanPm25) {
      best = { startHour: start, endHour: start + durationHours, meanPm25: mean }
    }
  }
  return best
}

export function moveRoutine(routine: Routine, start: number): Routine {
  return { ...routine, start: Math.max(0, Math.min(23.75, start)) }
}

export interface ShiftSuggestion {
  routineId: string
  start: number
  doseUg: number
  savedUg: number
}

/**
 * The best legal hour for one routine, and how much it saves against where it currently sits.
 * "Legal" means inside the waking window the household actually lives in.
 */
export function bestShiftFor(
  routine: Routine,
  points: HourPoint[],
  indoorPm25: number,
  fromHour = 6,
  toHour = 21,
): ShiftSuggestion | null {
  if (!routine.movable) return null
  const current = routineDose(routine, points, indoorPm25)
  let best: ShiftSuggestion | null = null
  const step = 0.25
  for (let start = fromHour; start <= toHour; start += step) {
    const dose = routineDose({ ...routine, start }, points, indoorPm25)
    if (!best || dose < best.doseUg) {
      best = { routineId: routine.id, start, doseUg: dose, savedUg: current - dose }
    }
  }
  return best
}

export function formatHour(hour: number): string {
  const normalised = ((hour % 24) + 24) % 24
  const whole = Math.floor(normalised)
  const minutes = Math.round((normalised - whole) * 60)
  const h = minutes === 60 ? (whole + 1) % 24 : whole
  const m = minutes === 60 ? 0 : minutes
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
