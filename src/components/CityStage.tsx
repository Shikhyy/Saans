import { useEffect, useRef, useState } from 'react'
import type { CityScene, Quality } from '../three/CityScene'
import { useApp } from '../state/app'
import { useReducedMotion } from '../lib/hooks'
import { pm25At, pointAt } from '../core/planner'
import { clamp, fmt } from '../lib/format'

function detectQuality(): Quality {
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  if (cores >= 8 && memory >= 8 && window.innerWidth > 1100) return 'high'
  if (cores >= 4 && window.innerWidth > 700) return 'medium'
  return 'low'
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * The fixed half of the page. The city is the clock: the scroll walks the hour from 05:00 to
 * midnight and the haze, the sun and the street lights follow the same forecast the planner reads.
 * At the end of the spread the simulation crossfades to a real photograph of the same night.
 */
export function CityStage() {
  const { pm25, today, t } = useApp()
  const reduced = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const plateRef = useRef<HTMLDivElement | null>(null)
  const hourRef = useRef<HTMLSpanElement | null>(null)
  const pmRef = useRef<HTMLSpanElement | null>(null)
  const layerRef = useRef<HTMLSpanElement | null>(null)
  const progressRef = useRef(0)
  const clockRef = useRef(17)
  const pmValueRef = useRef(pm25)
  const pointsRef = useRef(today?.points ?? [])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    pmValueRef.current = pm25
    pointsRef.current = today?.points ?? []
  }, [pm25, today])

  useEffect(() => {
    const canvas = canvasRef.current
    const split = document.getElementById('split')
    if (!canvas || !split) return

    let scene: CityScene | null = null
    let cancelled = false

    const paint = () => {
      const rect = split.getBoundingClientRect()
      const span = Math.max(1, rect.height - window.innerHeight)
      const progress = clamp(-rect.top / span, 0, 1)
      progressRef.current = progress
      const hour = 5 + progress * 19
      clockRef.current = hour

      const whole = Math.floor(hour)
      const minutes = Math.round((hour - whole) * 60)
      const label = `${String(minutes === 60 ? (whole + 1) % 24 : whole).padStart(2, '0')}:${String(
        minutes === 60 ? 0 : minutes,
      ).padStart(2, '0')}`
      if (hourRef.current) hourRef.current.textContent = label

      const points = pointsRef.current
      const value = points.length ? pm25At(points, hour) : pmValueRef.current
      const point = points.length ? pointAt(points, hour) : null
      if (pmRef.current) pmRef.current.textContent = value == null ? '—' : fmt(value)
      if (layerRef.current) {
        layerRef.current.textContent = point?.boundaryLayerM ? fmt(point.boundaryLayerM) : '—'
      }

      // The signature crossfade: the model gives way to the photograph at the end of the day.
      if (plateRef.current) {
        plateRef.current.style.opacity = progress > 0.86 ? '1' : '0'
      }

      scene?.update({ progress, hour, pm25: value ?? pmValueRef.current })
    }

    const visibility = () => {
      const rect = split.getBoundingClientRect()
      scene?.setActive(rect.bottom > 0 && rect.top < window.innerHeight && !document.hidden)
    }

    const onScroll = () => {
      paint()
      visibility()
    }

    paint()
    visibility()

    // Three.js is a quarter of the bundle; it loads after the page is readable, never before.
    if (supportsWebGL()) {
      void import('../three/CityScene')
        .then((module) => {
          if (cancelled) return
          try {
            scene = new module.CityScene(canvas, detectQuality(), reduced)
          } catch {
            setFailed(true)
            return
          }
          paint()
          visibility()
        })
        .catch(() => setFailed(true))
    } else {
      setFailed(true)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    document.addEventListener('visibilitychange', visibility)

    return () => {
      cancelled = true
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('visibilitychange', visibility)
      scene?.dispose()
    }
  }, [reduced])

  useEffect(() => {
    const points = pointsRef.current
    const value = points.length ? pm25At(points, clockRef.current) : pm25
    if (pmRef.current) pmRef.current.textContent = value == null ? '—' : fmt(value)
  }, [pm25])

  return (
    <aside className="split__stage" id="stage">
      <div className="stage__view">
        {failed ? (
          <div className="stage__fallback">
            <img
              src="/img/lamp-900.jpg"
              srcSet="/img/lamp-520.jpg 520w, /img/lamp-900.jpg 900w, /img/lamp-1600.jpg 1600w"
              sizes="(max-width: 900px) 100vw, 46vw"
              width={1600}
              height={1200}
              alt="A sodium street lamp burning through smog on a Delhi night."
            />
          </div>
        ) : (
          <canvas ref={canvasRef} style={{ touchAction: 'pan-y' }} />
        )}
        <div
          className="stage__plate"
          ref={plateRef}
          style={{ transition: 'opacity 1600ms ease' }}
          aria-hidden="true"
        >
          <img
            src="/img/lamp-900.jpg"
            srcSet="/img/lamp-520.jpg 520w, /img/lamp-900.jpg 900w, /img/lamp-1600.jpg 1600w"
            sizes="(max-width: 900px) 100vw, 46vw"
            width={1600}
            height={1200}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>

      <div className="stage__bar">
        <span className="stage__hour num" ref={hourRef}>
          05:00
        </span>
        <div className="stage__figures">
          <span className="stage__figure">
            <span>{t('stage.pm')}</span>
            <strong className="num">
              <span ref={pmRef}>—</span> µg/m³
            </strong>
          </span>
          <span className="stage__figure">
            <span>{t('stage.layer')}</span>
            <strong className="num">
              <span ref={layerRef}>—</span> m
            </strong>
          </span>
        </div>
      </div>

      {today && (
        <div className="sr-only">
          {today.points.map((point) => (
            <span key={point.time}>
              {point.hour}:00, {Math.round(point.pm25 ?? 0)} micrograms per cubic metre.
            </span>
          ))}
        </div>
      )}
    </aside>
  )
}
