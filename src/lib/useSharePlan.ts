import { useCallback, useState } from 'react'
import { whoMultiple } from '../core/aqi'
import { formatHour } from '../core/planner'
import { shareCard } from './export'
import { useApp } from '../state/app'

export type ShareState = 'idle' | 'working' | 'done'

/**
 * Shared state wrapper for generating and sharing/downloading a household air-quality card
 * while ensuring the trigger button never remains stuck in a busy state on failure.
 */
export function useSharePlan(
  buildHeadline: (windowLabel: string) => string,
): [ShareState, () => Promise<void>] {
  const { profile, today, pm25, dose, budget, cleanWindow } = useApp()
  const [state, setState] = useState<ShareState>('idle')

  const share = useCallback(async () => {
    setState('working')
    try {
      const windowLabel = cleanWindow
        ? `${formatHour(cleanWindow.startHour)}–${formatHour(cleanWindow.endHour)}`
        : 'not available'
      const result = await shareCard({
        city: profile.city,
        date: today?.date ?? '',
        pm25,
        multiple: whoMultiple(pm25),
        dose,
        budget,
        window: cleanWindow,
        headline: buildHeadline(windowLabel),
        url: window.location.origin,
      })
      setState(result === 'failed' ? 'idle' : 'done')
    } catch {
      setState('idle')
    }
  }, [profile.city, today?.date, pm25, dose, budget, cleanWindow, buildHeadline])

  return [state, share]
}
