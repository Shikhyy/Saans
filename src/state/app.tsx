import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { dailyBudget } from '../core/dose'
import { interventions, modelIndoor, type IndoorResult, type Intervention } from '../core/indoor'
import { composePlan, type PlanFacts } from '../core/plan'
import {
  bestShiftFor,
  cleanestWindow,
  dayDose,
  DEFAULT_ROUTINES,
  type ShiftSuggestion,
} from '../core/planner'
import type { AirPayload, PlanPayload } from '../core/schemas'
import { airPayloadSchema, profileSchema } from '../core/schemas'
import type {
  CleanWindow,
  DaySeries,
  HealthProfile,
  HouseholdProfile,
  Routine,
} from '../core/types'
import { fetchAir, requestPlan } from '../data/api'
import { samplePayload } from '../data/sample'
import { fill, translate, type Language, type StringKey } from '../lib/i18n'

const PROFILE_KEY = 'saans.profile.v1'
const AIR_KEY = 'saans.air.v1'

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

function readProfile(): HouseholdProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    if (raw) {
      const parsed = profileSchema.safeParse(JSON.parse(raw))
      if (parsed.success) return parsed.data
    }
    const params = new URLSearchParams(window.location.search)
    const lat = Number(params.get('lat'))
    const lon = Number(params.get('lon'))
    if (Number.isFinite(lat) && Number.isFinite(lon) && params.get('city')) {
      return {
        ...DEFAULT_PROFILE,
        city: params.get('city') ?? DEFAULT_PROFILE.city,
        latitude: lat,
        longitude: lon,
        language: params.get('lang') === 'hi' ? 'hi' : 'en',
      }
    }
  } catch {
    // a corrupt profile should never block the app
  }
  return DEFAULT_PROFILE
}

function readCachedAir(): AirPayload | null {
  try {
    const raw = window.localStorage.getItem(AIR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: number; payload?: unknown }
    if (!parsed.payload) return null
    const result = airPayloadSchema.safeParse(parsed.payload)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

function cacheAir(payload: AirPayload): void {
  try {
    window.localStorage.setItem(AIR_KEY, JSON.stringify({ at: Date.now(), payload }))
  } catch {
    // storage may be full or blocked; the app works without it
  }
}

export interface AppValue {
  profile: HouseholdProfile
  updateProfile: (patch: Partial<HouseholdProfile>) => void
  language: Language
  t: (key: StringKey) => string
  tf: (key: StringKey, vars: Record<string, string | number>) => string
  air: AirPayload | null
  status: 'loading' | 'ready'
  offline: boolean
  refresh: () => void
  today: DaySeries | null
  pm25: number
  aqi: number
  category: string
  dominant: string | null
  indoor: IndoorResult
  routines: Routine[]
  setRoutineStart: (id: string, start: number) => void
  resetRoutines: () => void
  adoptWindow: () => void
  activeMember: HealthProfile
  setActiveMember: (member: HealthProfile) => void
  dose: number
  budget: number
  cleanWindow: CleanWindow | null
  bestShift: ShiftSuggestion | null
  hacks: Intervention[]
  facts: PlanFacts
  plan: PlanPayload | null
  planStatus: 'idle' | 'loading' | 'ready'
  generatePlan: () => Promise<void>
}

const AppContext = createContext<AppValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<HouseholdProfile>(readProfile)
  const [routines, setRoutines] = useState<Routine[]>(DEFAULT_ROUTINES)
  const [activeMember, setActiveMember] = useState<HealthProfile>(
    profile.members[0] ?? 'adult',
  )
  const [air, setAir] = useState<AirPayload | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [offline, setOffline] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [plan, setPlan] = useState<PlanPayload | null>(null)
  const [planStatus, setPlanStatus] = useState<'idle' | 'loading' | 'ready'>('idle')

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    } catch {
      // ignore
    }
  }, [profile])

  useEffect(() => {
    if (!profile.members.includes(activeMember)) {
      setActiveMember(profile.members[0] ?? 'adult')
    }
  }, [profile.members, activeMember])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    fetchAir(profile.latitude, profile.longitude, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return
        setAir(payload)
        setOffline(false)
        setStatus('ready')
        cacheAir(payload)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        const cached = readCachedAir()
        setAir(cached ?? samplePayload())
        setOffline(true)
        setStatus('ready')
      })
    return () => controller.abort()
  }, [profile.latitude, profile.longitude, refreshKey])

  const updateProfile = useCallback((patch: Partial<HouseholdProfile>) => {
    setProfile((current) => ({ ...current, ...patch }))
  }, [])

  const language = profile.language
  const t = useCallback((key: StringKey) => translate(language, key), [language])
  const tf = useCallback(
    (key: StringKey, vars: Record<string, string | number>) => fill(translate(language, key), vars),
    [language],
  )

  const today = air?.days[0] ?? null
  const current = air?.current ?? null
  const pm25 = current?.pm25 ?? 0
  const aqi = current?.aqi.aqi ?? 0
  const category = current?.aqi.category ?? 'moderate'
  const dominant = current?.aqi.dominant ?? null

  const indoor = useMemo(
    () =>
      modelIndoor({
        outdoorPm25: pm25,
        dwelling: profile.dwelling,
        fuel: profile.fuel,
        floorAreaM2: profile.floorAreaM2,
        purifierCadr: profile.purifierCadr,
      }),
    [pm25, profile.dwelling, profile.fuel, profile.floorAreaM2, profile.purifierCadr],
  )

  const dose = useMemo(
    () => (today ? dayDose(routines, today.points, indoor.dailyMeanPm25) : 0),
    [routines, today, indoor.dailyMeanPm25],
  )

  const budget = dailyBudget(activeMember)

  const cleanWindow = useMemo(
    () => (today ? cleanestWindow(today.points, 2) : null),
    [today],
  )

  const bestShift = useMemo(() => {
    if (!today) return null
    let best: ShiftSuggestion | null = null
    for (const routine of routines) {
      const suggestion = bestShiftFor(routine, today.points, indoor.dailyMeanPm25)
      if (!suggestion) continue
      if (!best || suggestion.savedUg > best.savedUg) best = suggestion
    }
    return best && best.savedUg > 4 ? best : null
  }, [routines, today, indoor.dailyMeanPm25])

  const hacks = useMemo(
    () =>
      interventions({
        outdoorPm25: pm25,
        dwelling: profile.dwelling,
        fuel: profile.fuel,
        floorAreaM2: profile.floorAreaM2,
        purifierCadr: profile.purifierCadr,
      }),
    [pm25, profile.dwelling, profile.fuel, profile.floorAreaM2, profile.purifierCadr],
  )

  const setRoutineStart = useCallback((id: string, start: number) => {
    setRoutines((current) =>
      current.map((routine) =>
        routine.id === id && routine.movable
          ? { ...routine, start: Math.min(23.75, Math.max(0, start)) }
          : routine,
      ),
    )
  }, [])

  const resetRoutines = useCallback(() => setRoutines(DEFAULT_ROUTINES), [])

  const adoptWindow = useCallback(() => {
    if (!cleanWindow) return
    setRoutines((current) => {
      let cursor = cleanWindow.startHour
      return current.map((routine) => {
        if (!routine.movable) return routine
        const duration = routine.minutes / 60
        const start = Math.min(
          Math.max(cleanWindow.startHour, cleanWindow.endHour - duration),
          Math.max(cleanWindow.startHour, cursor),
        )
        cursor = Math.min(cleanWindow.endHour, start + duration + 0.25)
        return { ...routine, start }
      })
    })
  }, [cleanWindow])

  const facts: PlanFacts = useMemo(() => {
    const topHack = hacks[0]
    return {
      aqi,
      pm25,
      category,
      cleanWindow: cleanWindow
        ? { startHour: cleanWindow.startHour, endHour: cleanWindow.endHour, meanPm25: cleanWindow.meanPm25 }
        : null,
      dayDoseUg: dose,
      budgetUg: budget,
      indoorPeakPm25: indoor.cookingPeakPm25,
      bestShift: bestShift
        ? {
            label:
              routines.find((routine) => routine.id === bestShift.routineId)?.label ?? 'a routine',
            start: bestShift.start,
            savedUg: bestShift.savedUg,
          }
        : null,
      topIntervention: topHack
        ? { title: topHack.title, deltaPm25: topHack.deltaPm25, costInr: topHack.costInr }
        : null,
    }
  }, [aqi, pm25, category, cleanWindow, dose, budget, indoor.cookingPeakPm25, bestShift, hacks, routines, today])

  const generatePlan = useCallback(async () => {
    setPlanStatus('loading')
    const controller = new AbortController()
    try {
      const payload = await requestPlan(profile, facts, controller.signal)
      setPlan(payload)
      setPlanStatus('ready')
    } catch {
      setPlan(composePlan(facts, profile))
      setPlanStatus('ready')
    }
  }, [profile, facts])

  const value: AppValue = useMemo(
    () => ({
      profile,
      updateProfile,
      language,
      t,
      tf,
      air,
      status,
      offline,
      refresh: () => setRefreshKey((key) => key + 1),
      today,
      pm25,
      aqi,
      category,
      dominant,
      indoor,
      routines,
      setRoutineStart,
      resetRoutines,
      adoptWindow,
      activeMember,
      setActiveMember,
      dose,
      budget,
      cleanWindow,
      bestShift,
      hacks,
      facts,
      plan,
      planStatus,
      generatePlan,
    }),
    [
      profile,
      updateProfile,
      language,
      t,
      tf,
      air,
      status,
      offline,
      today,
      pm25,
      aqi,
      category,
      dominant,
      indoor,
      routines,
      setRoutineStart,
      resetRoutines,
      adoptWindow,
      activeMember,
      dose,
      budget,
      cleanWindow,
      bestShift,
      hacks,
      facts,
      plan,
      planStatus,
      generatePlan,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppProvider')
  return value
}
