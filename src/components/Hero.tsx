import { CATEGORY_LABEL, POLLUTANT_LABEL } from '../core/aqi'
import { whoMultiple } from '../core/aqi'
import { aqiVar, fmt } from '../lib/format'
import { useApp } from '../state/app'

export interface HeroProps {
  onPlan: () => void
  onOpenMethod?: () => void
}

export function Hero({ onPlan, onOpenMethod }: HeroProps) {
  const { t, tf, pm25, aqi, category, dominant, profile, air, status } = useApp()
  const label = CATEGORY_LABEL[category]

  return (
    <section className="hero" id="hero" aria-labelledby="hero-title">
      <h1 className="hero__title" id="hero-title" data-motion="words">
        {t('hero.title')}
      </h1>

      <p className="hero__standfirst" data-reveal>
        {t('hero.lede')}
      </p>

      <div className="hero__actions" data-reveal>
        <button className="btn btn--primary" type="button" onClick={onPlan} data-magnetic="0.14">
          {t('hero.cta')}
        </button>
        <a
          className="btn btn--ghost"
          href="/method"
          onClick={
            onOpenMethod
              ? (event) => {
                  event.preventDefault()
                  onOpenMethod()
                }
              : undefined
          }
        >
          {t('hero.secondary')}
        </a>
      </div>

      <div className="hero__reading" data-reveal>
        <span className="hero__aqi num">{status === 'loading' ? '—' : fmt(aqi)}</span>
        <p>
          <span
            className="hero__band"
            aria-hidden="true"
            style={{ background: aqiVar(category) }}
          />
          {tf('hero.now', {
            city: profile.city,
            category: label,
            dominant: dominant ? POLLUTANT_LABEL[dominant] : 'PM2.5',
          })}
          <br />
          {tf('hero.who', { pm: fmt(pm25), times: whoMultiple(pm25).toFixed(1) })}
        </p>
      </div>

      {(air?.sample || status === 'loading') && (
        <p className="note">{status === 'loading' ? t('hero.loading') : t('hero.sample')}</p>
      )}
    </section>
  )
}
