import { useCallback, useRef, useState } from 'react'
import { formatHour, routineDose } from '../core/planner'
import type { Routine } from '../core/types'
import { clamp, fmt } from '../lib/format'
import { ROUTINE_LABEL_I18N } from '../lib/i18n'
import { useApp } from '../state/app'

/** Interactive draggable + keyboard-operable timeline slider row for a daily routine. */
export function RoutineRow({ routine }: { routine: Routine }) {
  const { setRoutineStart, today, indoor, bestShift, t, language } = useApp()
  const rowRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(false)
  const points = today?.points ?? []
  const dose = routineDose(routine, points, indoor.dailyMeanPm25)
  const displayLabel = ROUTINE_LABEL_I18N[language][routine.id] ?? routine.label

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

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!routine.movable) return
      event.currentTarget.setPointerCapture(event.pointerId)
      setActive(true)
      setFromClientX(event.clientX)
    },
    [routine.movable, setFromClientX],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!active) return
      setFromClientX(event.clientX)
    },
    [active, setFromClientX],
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!active) return
      event.currentTarget.releasePointerCapture(event.pointerId)
      setActive(false)
    },
    [active],
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
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
    },
    [routine.id, routine.movable, routine.start, setRoutineStart],
  )

  return (
    <div className="row">
      <div className="row__label">
        <span>{displayLabel}</span>
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
          aria-label={
            language === 'hi'
              ? `${displayLabel}, ${formatHour(routine.start)} बजे, ${routine.minutes} मिनट, ${fmt(dose)} माइक्रोग्राम`
              : `${displayLabel}, starts ${formatHour(routine.start)}, ${routine.minutes} minutes, ${fmt(dose)} micrograms`
          }
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
