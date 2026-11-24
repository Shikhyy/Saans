import { useCallback, useRef, useState } from 'react'
import { formatHour, routineDose } from '../core/planner'
import type { Routine } from '../core/types'
import { whoMultiple } from '../core/aqi'
import { useApp } from '../state/app'
import { clamp, fmt } from '../lib/format'
import { PROFILE_LABEL_I18N } from '../lib/i18n'
import { downloadIcs, shareCard } from '../lib/export'

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

function RoutineRow({ routine }: { routine: Routine }) {
  const { setRoutineStart, today, indoor, bestShift, t } = useApp()
  const rowRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(false)
  const points = today?.points ?? []
  const dose = routineDose(routine, points, indoor.dailyMeanPm25)

  const setFromClientX = useCallback(
    (clientX: number) => {
      const element = rowRef.current
      if (!element) return
      const rect = element.getBoundingClientRect()
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
      setRoutineStart(routine.id, Math.round(ratio * 24 * 4) / 4)
    },
    [routine.id, setRoutineStart],
  )

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!routine.movable) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setActive(true)
    setFromClientX(event.clientX)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return
    setFromClientX(event.clientX)
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    setActive(false)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!routine.movable) return
    const step = event.shiftKey ? 1 : 0.25
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      setRoutineStart(routine.id, routine.start + step)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      setRoutineStart(routine.id, routine.start - step)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setRoutineStart(routine.id, 0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setRoutineStart(routine.id, 23.75)
    }
  }

  return (
    <div className="row">
      <div className="row__label">
        <span>{routine.label}</span>
        <span className="num">{formatHour(routine.start)}</span>
      </div>
      <div className="track__row" ref={rowRef}>
        {bestShift?.routineId === routine.id && (
          <div
            className="block--ghost"
            style={{
              left: `${(bestShift.start / 24) * 100}%`,
              width: `${Math.max(1.2, (routine.minutes / 1440) * 100)}%`,
            }}
            aria-hidden="true"
          />
        )}
        <div
          className="block"
          data-active={active}
          data-movable={routine.movable}
          role="slider"
          tabIndex={routine.movable ? 0 : -1}
          aria-valuemin={0}
          aria-valuemax={24}
          aria-valuenow={Math.round(routine.start * 100) / 100}
          aria-valuetext={formatHour(routine.start)}
          aria-label={`${routine.label}, starts ${formatHour(routine.start)}, ${routine.minutes} minutes, ${fmt(dose)} micrograms`}
          style={{
            left: `${(routine.start / 24) * 100}%`,
            width: `${Math.max(1.2, (routine.minutes / 1440) * 100)}%`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          title={t('day.drag')}
        />
      </div>
    </div>
  )
}

function DayBackdrop() {
  const { today, cleanWindow, tf } = useApp()
  const points = today?.points ?? []
  const values = points.map((point) => point.pm25).filter((value): value is number => value !== null)
  if (values.length < 2) return null

  const width = 240
  const height = 100
  const ceiling = Math.max(...values, 60)
  const step = width / Math.max(1, points.length - 1)
  const coords = points.map((point, index) => {
    const value = point.pm25 ?? 0
    return [index * step, 4 + (1 - Math.min(value / ceiling, 1)) * 92] as const
  })
  const line = coords
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`

  const low = Math.min(...values)
  const high = Math.max(...values)
  const lowHour = points.find((point) => point.pm25 === low)?.hour ?? 0
  const highHour = points.find((point) => point.pm25 === high)?.hour ?? 0
  const label = tf('day.curveLabel', {
    low: fmt(low),
    lowHour: formatHour(lowHour),
    high: fmt(high),
    highHour: formatHour(highHour),
  })

  return (
    <div className="daychart__backdrop">
      {cleanWindow && (
        <span
          className="daychart__window"
          aria-hidden="true"
          style={{
            left: `${(cleanWindow.startHour / 24) * 100}%`,
            width: `${((cleanWindow.endHour - cleanWindow.startHour) / 24) * 100}%`,
          }}
        />
      )}
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
        <path d={area} className="daychart__area" />
        <path d={line} className="daychart__line" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

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
    pm25,
  } = useApp()
  const [shareState, setShareState] = useState<'idle' | 'working' | 'done'>('idle')

  const used = budget > 0 ? dose / budget : 0
  const pct = Math.round(used * 100)
  const peak = routines
    .map((routine) => ({
      routine,
      ug: routineDose(routine, today?.points ?? [], indoor.dailyMeanPm25),
    }))
    .sort((a, b) => b.ug - a.ug)[0]
  const ticks = language === 'hi' ? TICKS_HI : TICKS_EN

  const onShare = async () => {
    setShareState('working')
    const result = await shareCard({
      city: profile.city,
      date: today?.date ?? '',
      pm25,
      multiple: whoMultiple(pm25),
      dose,
      budget,
      window: cleanWindow,
      headline: `Your household breathes about ${fmt(dose)} µg of PM2.5 today. The cleanest window is ${
        cleanWindow
          ? `${formatHour(cleanWindow.startHour)}–${formatHour(cleanWindow.endHour)}`
          : 'not available'
      }.`,
      url: window.location.origin,
    })
    setShareState(result === 'failed' ? 'idle' : 'done')
  }

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

        <aside className="planner__side">
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
                <button className="btn btn--quiet" type="button" onClick={onShare}>
                  {shareState === 'working' ? '…' : t('common.share')}
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
                    routines.find((routine) => routine.id === bestShift.routineId)?.label ?? '',
                  hour: formatHour(bestShift.start),
                })}{' '}
                <strong className="num">{fmt(bestShift.savedUg)} µg</strong>
              </p>
            </div>
          )}

          {peak && (
            <div className="panel" data-reveal>
              <div className="panel__time">{peak.routine.label}</div>
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
