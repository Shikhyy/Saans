import { useCallback, useMemo } from 'react'
import { formatHour, routineDose } from '../core/planner'
import type { Routine } from '../core/types'
import { downloadIcs } from '../lib/export'
import { fmt } from '../lib/format'
import { PROFILE_LABEL_I18N, ROUTINE_LABEL_I18N } from '../lib/i18n'
import { useSharePlan } from '../lib/useSharePlan'
import { useApp } from '../state/app'
import { DayBackdrop } from './DayBackdrop'
import { RoutineRow } from './RoutineRow'

const TICKS_EN: [number, string][] = [
  [6, '6am'],
  [9, '9am'],
  [12, 'noon'],
  [15, '3pm'],
  [18, '6pm'],
  [21, '9pm'],
]

const TICKS_HI: [number, string][] = [
  [6, 'सुबह 6'],
  [9, 'सुबह 9'],
  [12, 'दोपहर'],
  [15, 'शाम 3'],
  [18, 'शाम 6'],
  [21, 'रात 9'],
]

export function DayPlanner() {
  const {
    t,
    tf,
    language,
    profile,
    routines,
    activeMember,
    setActiveMember,
    dose,
    budget,
    cleanWindow,
    bestShift,
    adoptWindow,
    resetRoutines,
    today,
    indoor,
  } = useApp()

  const buildHeadline = useCallback(
    (windowLabel: string) =>
      `Your household breathes about ${fmt(dose)} µg of PM2.5 today. The cleanest window is ${windowLabel}.`,
    [dose],
  )
  const [shareState, onShare] = useSharePlan(buildHeadline)

  const used = budget > 0 ? dose / budget : 0
  const pct = Math.round(used * 100)
  const points = today?.points ?? []
  const peak = useMemo(() => {
    let best: { routine: Routine; ug: number } | undefined
    for (const routine of routines) {
      const ug = routineDose(routine, points, indoor.dailyMeanPm25)
      if (!best || ug > best.ug) best = { routine, ug }
    }
    return best
  }, [routines, points, indoor.dailyMeanPm25])
  const ticks = language === 'hi' ? TICKS_HI : TICKS_EN

  return (
    <section className="band band--raised" id="day" aria-labelledby="day-title">
      <header className="band__head">
        <h2 id="day-title" data-motion="words">
          {t('day.title')}
        </h2>
        <p data-reveal>{t('day.note')}</p>
      </header>

      <div className="planner">
        <div data-reveal>
          <div className="seg" role="group" aria-label={t('day.member')}>
            {profile.members.map((member) => (
              <button
                key={member}
                type="button"
                className="seg__btn"
                aria-pressed={member === activeMember}
                onClick={() => setActiveMember(member)}
              >
                {PROFILE_LABEL_I18N[language][member]}
              </button>
            ))}
          </div>

          <div className="daychart">
            <div className="daychart__head">
              <div className="daychart__label">
                <span>{t('day.curve')}</span>
                <span className="num">µg/m³</span>
              </div>
              <div className="daychart__scale" aria-hidden="true">
                {ticks.map(([hour, label]) => (
                  <span
                    key={hour}
                    className="daychart__tick"
                    style={{ left: `${(hour / 24) * 100}%` }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="daychart__body">
              <DayBackdrop />
              <div className="daychart__rows">
                {routines.map((routine) => (
                  <RoutineRow key={routine.id} routine={routine} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="planner__side" aria-label={t('day.summary')}>
          <div className="gauge" data-reveal>
            <div className="gauge__value num">{fmt(dose)}</div>
            <div className="gauge__of">
              {t('day.of')} {fmt(budget)} µg — {PROFILE_LABEL_I18N[language][activeMember]} ·{' '}
              {t('day.budget')} <span className="num">{pct}%</span>
            </div>
            <div
              className="gauge__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, pct)}
              aria-label={`${t('day.budget')}: ${pct}%`}
            >
              <div
                className="gauge__fill"
                data-over={used > 1}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>

          {cleanWindow && today && (
            <div className="panel" data-reveal>
              <div className="panel__time num">
                {formatHour(cleanWindow.startHour)}–{formatHour(cleanWindow.endHour)}
              </div>
              <p>
                {t('day.cleanest')} · {fmt(cleanWindow.meanPm25)} µg/m³. {t('day.windowNote')}
              </p>
              <div className="panel__actions">
                <button className="btn btn--primary" type="button" onClick={adoptWindow}>
                  {t('day.adopt')}
                </button>
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() =>
                    downloadIcs({
                      date: today.date,
                      startHour: cleanWindow.startHour,
                      endHour: cleanWindow.endHour,
                      city: profile.city,
                      meanPm25: cleanWindow.meanPm25,
                      url: window.location.origin,
                    })
                  }
                >
                  {t('common.calendar')}
                </button>
              </div>
              <div className="panel__actions">
                <button
                  className="btn btn--quiet"
                  type="button"
                  onClick={() => void onShare()}
                  disabled={shareState === 'working'}
                  aria-busy={shareState === 'working'}
                >
                  {shareState === 'working'
                    ? t('close.working')
                    : shareState === 'done'
                      ? t('close.done')
                      : t('common.share')}
                </button>
                <button className="btn btn--quiet" type="button" onClick={resetRoutines}>
                  {t('day.reset')}
                </button>
              </div>
            </div>
          )}

          {bestShift && (
            <div className="panel" data-reveal>
              <div className="panel__time num">{formatHour(bestShift.start)}</div>
              <p>
                {tf('day.saved', {
                  label:
                    ROUTINE_LABEL_I18N[language][bestShift.routineId] ??
                    routines.find((routine) => routine.id === bestShift.routineId)?.label ??
                    '',
                  hour: formatHour(bestShift.start),
                })}{' '}
                <strong className="num">{fmt(bestShift.savedUg)} µg</strong>
              </p>
            </div>
          )}

          {peak && (
            <div className="panel" data-reveal>
              <div className="panel__time">
                {ROUTINE_LABEL_I18N[language][peak.routine.id] ?? peak.routine.label}
              </div>
              <p>
                <span className="num">{fmt(peak.ug)} µg</span> · {formatHour(peak.routine.start)}
                {peak.routine.place === 'indoor'
                  ? ` · ${tf('day.indoors', { pm: fmt(indoor.cookingPeakPm25) })}`
                  : ''}
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
