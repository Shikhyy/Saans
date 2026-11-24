import { useCallback } from 'react'
import { fmt } from '../lib/format'
import { useSharePlan } from '../lib/useSharePlan'
import { useApp } from '../state/app'

export function Close() {
  const { t, profile, dose } = useApp()

  const buildHeadline = useCallback(
    (windowLabel: string) =>
      `The cleanest window in ${profile.city} today is ${windowLabel}. Our day costs ${fmt(dose)} µg of PM2.5.`,
    [profile.city, dose],
  )
  const [state, download] = useSharePlan(buildHeadline)

  return (
    <section className="close" aria-labelledby="close-title" data-parallax-section>
      <img
        src="/img/lamp-1600.jpg"
        srcSet="/img/lamp-520.jpg 520w, /img/lamp-900.jpg 900w, /img/lamp-1600.jpg 1600w"
        sizes="100vw"
        width={1600}
        height={1200}
        alt="A sodium street lamp burning through the smog on a Delhi night, the air thick around it."
        loading="lazy"
        decoding="async"
        data-parallax="0.1"
      />
      <div className="close__inner">
        <p className="close__caption" data-reveal>
          Delhi, winter, 05:40.
        </p>
        <div className="close__text" data-reveal-group>
          <h2 id="close-title" data-reveal-item>
            {t('close.title')}
          </h2>
          <p data-reveal-item>{t('close.body')}</p>
          <button
            className="btn btn--paper"
            type="button"
            onClick={() => void download()}
            disabled={state === 'working'}
            aria-busy={state === 'working'}
            data-reveal-item
          >
            {state === 'working'
              ? t('close.working')
              : state === 'done'
                ? t('close.done')
                : t('close.cta')}
          </button>
        </div>
      </div>
    </section>
  )
}
