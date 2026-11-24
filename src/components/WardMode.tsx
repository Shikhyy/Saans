import { useEffect, useMemo, useRef, useState } from 'react'
import { formatHour } from '../core/planner'
import { schoolRecess, wardScenario } from '../core/ward'
import type { ExposureSample } from '../core/exposure'
import { useApp } from '../state/app'
import { fmt, fmtCompact, inr } from '../lib/format'
import { Heatmap } from './Heatmap'
import { PlateImage } from './PlateImage'

/** Number of households represented on the illustrative ward block. */
const WARD_HOUSEHOLDS = 480
/** Share of ward households initially cooking with solid biomass. */
const WARD_BIOMASS_SHARE = 0.72
const BIOMASS_COUNT = Math.round(WARD_HOUSEHOLDS * WARD_BIOMASS_SHARE)
/** Grid columns in the 480-dot canvas matrix (`48 × 10`). */
const WARD_COLUMNS = 48
const WARD_ROWS = WARD_HOUSEHOLDS / WARD_COLUMNS
const WARD_PEOPLE_PER_HOUSEHOLD = 5
const SCHOOL_CHILDREN = 400
const RECESS_START_HOUR = 10.5
const RECESS_DURATION_HOURS = 0.75

function DotField({ switched }: { switched: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const gapX = width / WARD_COLUMNS
      const gapY = height / WARD_ROWS
      const radius = Math.min(gapX, gapY) * 0.26

      for (let index = 0; index < WARD_HOUSEHOLDS; index += 1) {
        const column = index % WARD_COLUMNS
        const row = Math.floor(index / WARD_COLUMNS)
        const x = gapX * (column + 0.5)
        const y = gapY * (row + 0.5)
        const isBiomass = index < BIOMASS_COUNT
        const isSwitched = isBiomass && index < switched
        ctx.beginPath()
        ctx.fillStyle = isSwitched ? '#E9E9E6' : isBiomass ? '#D4543F' : '#33383F'
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [switched])

  return <canvas ref={ref} aria-hidden="true" />
}

export function WardMode() {
  const { t, tf, today, profile, cleanWindow } = useApp()
  const [switched, setSwitched] = useState(Math.round(BIOMASS_COUNT * 0.3))

  const targetShare = (BIOMASS_COUNT - switched) / WARD_HOUSEHOLDS
  const scenario = useMemo(
    () =>
      wardScenario(
        {
          households: WARD_HOUSEHOLDS,
          biomassShare: WARD_BIOMASS_SHARE,
          peoplePerHousehold: WARD_PEOPLE_PER_HOUSEHOLD,
        },
        targetShare,
        'lpg',
      ),
    [targetShare],
  )

  const recess = useMemo(
    () =>
      today
        ? schoolRecess(today.points, SCHOOL_CHILDREN, RECESS_START_HOUR, RECESS_DURATION_HOURS)
        : null,
    [today],
  )

  const heatmapSamples = useMemo<ExposureSample[]>(
    () =>
      (today?.points ?? []).flatMap((point) =>
        point.pm25 === null
          ? []
          : [
              {
                lat: profile.latitude,
                lon: profile.longitude,
                hour: point.hour,
                pm25: point.pm25,
              },
            ],
      ),
    [today, profile.latitude, profile.longitude],
  )

  const heatmapHours = cleanWindow?.startHour ?? today?.points[0]?.hour ?? 0

  return (
    <section className="band band--field" id="ward" aria-labelledby="ward-title">
      <div className="plate-split">
        <div>
          <div className="plate" data-image-reveal>
            <PlateImage
              name="ward"
              sizes="(max-width: 900px) 92vw, 46vw"
              width={900}
              height={859}
              alt="Low-rise houses and a tower block on the edge of Delhi, disappearing into November smog."
              lazy
            />
          </div>
          <div className="dotfield" data-reveal>
            <DotField switched={switched} />
          </div>
          <Heatmap
            samples={heatmapSamples}
            lat={profile.latitude}
            lon={profile.longitude}
            hours={heatmapHours}
          />
          <p className="note">{t('ward.heatmap')}</p>
          <p className="note">{t('ward.heatmapNote')}</p>
          <p className="note">
            {tf('ward.households', { count: fmt(WARD_HOUSEHOLDS), wood: fmt(BIOMASS_COUNT) })}
          </p>
        </div>

        <div className="ward__controls" data-reveal-group>
          <h2 id="ward-title" data-reveal-item>
            {t('ward.title')}
          </h2>
          <p data-reveal-item>{t('ward.note')}</p>

          <div className="field" data-reveal-item>
            <label className="field__label" htmlFor="ward-switch">
              {t('ward.switch')} —{' '}
              {tf('ward.switchValue', { count: fmt(switched), total: fmt(BIOMASS_COUNT) })}
            </label>
            <input
              id="ward-switch"
              className="range"
              type="range"
              min={0}
              max={BIOMASS_COUNT}
              step={4}
              value={switched}
              onChange={(event) => setSwitched(Number(event.target.value))}
              aria-valuetext={tf('ward.switchValue', {
                count: fmt(switched),
                total: fmt(BIOMASS_COUNT),
              })}
            />
          </div>

          <div className="readouts" data-reveal-item>
            <div className="readout">
              <div className="readout__v num">{fmtCompact(scenario.pm25AvoidedKgPerYear)} kg</div>
              <div className="readout__k">
                {t('ward.pm25')} · {t('ward.perYear')}
              </div>
            </div>
            <div className="readout">
              <div className="readout__v num">{fmtCompact(scenario.co2eAvoidedKgPerYear)} kg</div>
              <div className="readout__k">
                {t('ward.co2')} · {t('ward.perYear')}
              </div>
            </div>
            <div className="readout">
              <div className="readout__v num">{fmt(scenario.peopleProtected)}</div>
              <div className="readout__k">{t('ward.people')}</div>
            </div>
            <div className="readout">
              <div className="readout__v num">{scenario.inhaledAvoidedKgPerYear.toFixed(1)} kg</div>
              <div className="readout__k">
                {t('ward.inhaled')} · {t('ward.perYear')}
              </div>
            </div>
          </div>

          <p className="note" data-reveal-item>
            {tf('ward.cost', { cost: inr(Math.abs(scenario.costDeltaInrPerYear)) })}
          </p>

          {recess && (
            <div className="recess" data-reveal-item>
              <div className="recess__time num">
                {formatHour(recess.best.startHour)}–{formatHour(recess.best.endHour)}
              </div>
              <p className="note">
                {t('ward.recess')} · {t('ward.recessNote')}
              </p>
              <p className="note">
                {tf('ward.recessBody', {
                  current: fmt(recess.currentMean),
                  best: fmt(recess.bestMean),
                  saved: fmt(recess.savedUgPerDay / 1000),
                })}
              </p>
            </div>
          )}

          <p className="note" data-reveal-item>
            {tf('ward.scenario', { city: profile.city })}
          </p>
        </div>
      </div>
    </section>
  )
}
