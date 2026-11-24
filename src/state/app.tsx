import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  fitRoutinesInWindow,
  moveRoutine,
  type ShiftSuggestion,
} from '../core/planner'
import type { AirPayload, PlanPayload } from '../core/schemas'
import type {
  AqiCategory,
  CleanWindow,
  DaySeries,
  HealthProfile,
  HouseholdProfile,
  Pollutant,
  Routine,
} from '../core/types'
import { fetchAir, requestPlan } from '../data/api'
import { samplePayload } from '../data/sample'
import { fill, ROUTINE_LABEL_I18N, translate, type Language, type StringKey } from '../lib/i18n'
import { cacheAir, DEFAULT_PROFILE, readCachedAir, readProfile, saveProfile } from './storage'

export { DEFAULT_PROFILE }

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
  category: AqiCategory
  dominant: Pollutant | null
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
  const [activeMember, setActiveMember] = useState<HealthProfile>(profile.members[0] ?? 'adult')
  const [air, setAir] = useState<AirPayload | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [offline, setOffline] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [plan, setPlan] = useState<PlanPayload | null>(null)
  const [planStatus, setPlanStatus] = useState<'idle' | 'loading' | 'ready'>('idle')
  const planAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    saveProfile(profile)
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

  useEffect(() => () => planAbortRef.current?.abort(), [])

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
  const category: AqiCategory = current?.aqi.category ?? 'moderate'
  const dominant: Pollutant | null = current?.aqi.dominant ?? null

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

  const cleanWindow = useMemo(() => (today ? cleanestWindow(today.points, 2) : null), [today])

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
      interventions(
        {
          outdoorPm25: pm25,
          dwelling: profile.dwelling,
          fuel: profile.fuel,
          floorAreaM2: profile.floorAreaM2,
          purifierCadr: profile.purifierCadr,
        },
        language,
      ),
    [pm25, profile.dwelling, profile.fuel, profile.floorAreaM2, profile.purifierCadr, language],
  )

  const setRoutineStart = useCallback((id: string, start: number) => {
    setRoutines((current) =>
      current.map((routine) =>
        routine.id === id && routine.movable ? moveRoutine(routine, start) : routine,
      ),
    )
  }, [])

  const resetRoutines = useCallback(() => setRoutines(DEFAULT_ROUTINES), [])

  const adoptWindow = useCallback(() => {
    if (!cleanWindow) return
    setRoutines((current) => fitRoutinesInWindow(current, cleanWindow))
  }, [cleanWindow])

  const facts: PlanFacts = useMemo(() => {
    const topHack = hacks[0]
    return {
      aqi,
      pm25,
      category,
      cleanWindow: cleanWindow
        ? {
            startHour: cleanWindow.startHour,
            endHour: cleanWindow.endHour,
            meanPm25: cleanWindow.meanPm25,
          }
        : null,
      dayDoseUg: dose,
      budgetUg: budget,
      indoorPeakPm25: indoor.cookingPeakPm25,
      bestShift: bestShift
        ? {
            label:
              ROUTINE_LABEL_I18N[language][bestShift.routineId] ??
              routines.find((routine) => routine.id === bestShift.routineId)?.label ??
              'a routine',
            start: bestShift.start,
            savedUg: bestShift.savedUg,
          }
        : null,
      topIntervention: topHack
        ? { title: topHack.title, deltaPm25: topHack.deltaPm25, costInr: topHack.costInr }
        : null,
    }
  }, [
    aqi,
    pm25,
    category,
    cleanWindow,
    dose,
    budget,
    indoor.cookingPeakPm25,
    bestShift,
    hacks,
    routines,
    language,
  ])

  const generatePlan = useCallback(async () => {
    planAbortRef.current?.abort()
    const controller = new AbortController()
    planAbortRef.current = controller
    setPlanStatus('loading')
    try {
      const payload = await requestPlan(profile, facts, controller.signal)
      if (!controller.signal.aborted) {
        setPlan(payload)
        setPlanStatus('ready')
      }
    } catch {
      if (!controller.signal.aborted) {
        setPlan(composePlan(facts, profile))
        setPlanStatus('ready')
      }
    }
  }, [profile, facts])

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])

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
      refresh,
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
      refresh,
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
