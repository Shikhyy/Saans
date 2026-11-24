import { useEffect, useRef } from 'react'
import { COOKING_GENERATION_UG_PER_H, COOKING_HOURS_PER_DAY } from '../core/indoor'
import type { Dwelling, Fuel } from '../core/types'
import { useApp } from '../state/app'
import { useInView, useReducedMotion } from '../lib/hooks'
import { DWELLING_LABEL_I18N, FUEL_LABEL_I18N } from '../lib/i18n'
import { supportsWebGL } from '../lib/webgl'
import type { RoomScene } from '../three/RoomScene'
import { fmt, hazeColor, inr } from '../lib/format'

const DWELLINGS: Dwelling[] = ['one-room', 'apartment', 'house']
const FUELS: Fuel[] = ['lpg', 'biomass', 'mixed', 'none']

export function HomeLab() {
  const { t, tf, language, profile, updateProfile, indoor, hacks, pm25 } = useApp()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<RoomScene | null>(null)
  const [stageRef, inView] = useInView<HTMLDivElement>({ threshold: 0.15 })
  const reduced = useReducedMotion()
  const purifierOn = profile.purifierCadr > 0
  const latestRef = useRef({
    indoorPm25: indoor.cookingPeakPm25,
    haze: hazeColor(pm25),
    purifierOn,
    active: inView && !reduced,
  })
  latestRef.current = {
    indoorPm25: indoor.cookingPeakPm25,
    haze: hazeColor(pm25),
    purifierOn,
    active: inView && !reduced,
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !supportsWebGL()) return
    let cancelled = false
    let scene: RoomScene | null = null
    void import('../three/RoomScene')
      .then((module) => {
        if (cancelled) return
        try {
          scene = new module.RoomScene(canvas, reduced)
        } catch {
          return
        }
        sceneRef.current = scene
        const snapshot = latestRef.current
        scene.setIndoor(snapshot.indoorPm25, snapshot.haze)
        scene.setPurifier(snapshot.purifierOn)
        scene.setActive(snapshot.active)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      scene?.dispose()
      sceneRef.current = null
    }
  }, [reduced])

  useEffect(() => {
    sceneRef.current?.setIndoor(indoor.cookingPeakPm25, hazeColor(pm25))
  }, [indoor.cookingPeakPm25, pm25])

  useEffect(() => {
    sceneRef.current?.setPurifier(purifierOn)
  }, [purifierOn])

  useEffect(() => {
    sceneRef.current?.setActive(inView && !reduced)
  }, [inView, reduced])

  return (
    <section className="band" id="home" aria-labelledby="home-title">
      <div className="pinned">
        <div className="pinned__head">
          <h2 id="home-title" data-motion="words">
            {t('home.title')}
          </h2>
          <p data-reveal>{t('home.note')}</p>
          <div className="pinned__object" ref={stageRef}>
            <canvas ref={canvasRef} aria-hidden="true" />
          </div>
          <p className="pinned__caption">
            {tf('home.roomCaption', {
              pm: fmt(indoor.cookingPeakPm25),
              state: purifierOn ? t('home.purifierOn') : t('home.purifierNone'),
            })}
          </p>
        </div>

        <div className="rows">
          <article className="row-block" data-reveal-group>
            <h3 data-reveal-item>{t('home.rowOne')}</h3>
            <div className="row-block__body">
              <div className="row-block__media" data-image-reveal>
                <img
                  src="/img/chulha-900.jpg"
                  srcSet="/img/chulha-520.jpg 520w, /img/chulha-900.jpg 900w, /img/chulha-1600.jpg 1600w"
                  sizes="(max-width: 980px) 90vw, 220px"
                  width={900}
                  height={600}
                  alt="A cooking pot on an earthen chulha, lit with twigs, in a North Indian home."
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div data-reveal-item>
                <ul className="plain-list">
                  <li>
                    <span>{t('home.lpg')}</span>
                    <b>
                      {fmt(COOKING_GENERATION_UG_PER_H.lpg)} {t('home.perHour')}
                    </b>
                  </li>
                  <li>
                    <span>{t('home.wood')}</span>
                    <b>
                      {fmt(COOKING_GENERATION_UG_PER_H.biomass)} {t('home.perHour')}
                    </b>
                  </li>
                  <li>
                    <span>{t('home.both')}</span>
                    <b>
                      {fmt(COOKING_GENERATION_UG_PER_H.mixed)} {t('home.perHour')}
                    </b>
                  </li>
                  <li>
                    <span>{t('home.hours')}</span>
                    <b>{COOKING_HOURS_PER_DAY}</b>
                  </li>
                </ul>

                <div className="controls">
                  <div className="field">
                    <span className="field__label">{t('home.fuel')}</span>
                    <div className="seg" role="group" aria-label={t('home.fuel')}>
                      {FUELS.map((fuel) => (
                        <button
                          key={fuel}
                          type="button"
                          className="seg__btn"
                          aria-pressed={profile.fuel === fuel}
                          onClick={() => updateProfile({ fuel })}
                        >
                          {FUEL_LABEL_I18N[language][fuel]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="row-block" data-reveal-group>
            <h3 data-reveal-item>{t('home.rowTwo')}</h3>
            <div>
              <div data-reveal-item>
                <div className="readouts">
                  <div className="readout">
                    <div className="readout__v num">{fmt(indoor.cookingPeakPm25)}</div>
                    <div className="readout__k">{t('home.cookingPeak')} · µg/m³</div>
                  </div>
                  <div className="readout">
                    <div className="readout__v num">{fmt(indoor.dailyMeanPm25)}</div>
                    <div className="readout__k">{t('home.dailyMean')} · µg/m³</div>
                  </div>
                  <div className="readout">
                    <div className="readout__v num">{fmt(indoor.clearanceMinutes)}</div>
                    <div className="readout__k">{t('home.clearance')} · min</div>
                  </div>
                  <div className="readout">
                    <div className="readout__v num">{fmt(indoor.recommendedCadr)}</div>
                    <div className="readout__k">{t('home.recommended')} · m³/h</div>
                  </div>
                </div>

                <div className="controls">
                  <div className="field">
                    <span className="field__label">{t('home.dwelling')}</span>
                    <div className="seg" role="group" aria-label={t('home.dwelling')}>
                      {DWELLINGS.map((dwelling) => (
                        <button
                          key={dwelling}
                          type="button"
                          className="seg__btn"
                          aria-pressed={profile.dwelling === dwelling}
                          onClick={() => updateProfile({ dwelling })}
                        >
                          {DWELLING_LABEL_I18N[language][dwelling]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <span className="field__label">{t('home.purifier')}</span>
                    <div className="seg" role="group" aria-label={t('home.purifier')}>
                      <button
                        type="button"
                        className="seg__btn"
                        aria-pressed={!purifierOn}
                        onClick={() => updateProfile({ purifierCadr: 0 })}
                      >
                        {t('home.purifierOff')}
                      </button>
                      <button
                        type="button"
                        className="seg__btn"
                        aria-pressed={purifierOn}
                        onClick={() => updateProfile({ purifierCadr: 300 })}
                      >
                        300 m³/h
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="row-block" data-reveal-group>
            <h3 data-reveal-item>{t('home.rowThree')}</h3>
            <div className="hacks">
              {hacks.map((hack, index) => (
                <div
                  className={index === 0 ? 'hack hack--lead' : 'hack'}
                  key={hack.id}
                  data-reveal-item
                >
                  <div>
                    <div className="hack__delta num">−{fmt(hack.deltaPm25)}</div>
                    <div className="hack__cost">
                      µg/m³ {hack.recurring ? t('home.recurring') : t('home.cost')}
                    </div>
                  </div>
                  <div>
                    <div className="hack__title">{hack.title}</div>
                    <p className="hack__detail">{hack.detail}</p>
                  </div>
                  <div className="hack__price">
                    <div className="hack__amount num">
                      {hack.costInr === 0 ? t('home.free') : inr(hack.costInr)}
                    </div>
                    <div className="hack__cost">
                      {hack.costPerUg !== Infinity && hack.deltaPm25 > 0
                        ? `${inr(hack.costPerUg)} / µg`
                        : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
