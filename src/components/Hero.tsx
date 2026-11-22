import { CATEGORY_LABEL, whoMultiple } from '../core/aqi'
import type { AqiCategory } from '../core/types'
import { fmt } from '../lib/format'
import { useApp } from '../state/app'

const DOMINANT_LABEL: Record<string, string> = {
  pm2_5: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  so2: 'SO₂',
  o3: 'O₃',
  co: 'CO',
}

export function Hero({ onPlan }: { onPlan: () => void }) {
  const { t, tf, pm25, aqi, category, dominant, profile, air, status } = useApp()
  const label = CATEGORY_LABEL[category as AqiCategory] ?? 'Moderate'

  return (
    <section className="hero" id="hero" aria-labelledby="hero-title">
      <h1 className="hero__title" id="hero-title" data-motion="words">
        {t('hero.title')}
      </h1>

      <p className="hero__standfirst" data-reveal>
        {t('hero.lede')}
      </p>

      <div className="hero__actions" data-reveal>
        <button
          className="btn btn--primary"
          type="button"
          onClick={onPlan}
          data-magnetic="0.14"
        >
          {t('hero.cta')}
        </button>
        <a className="btn btn--ghost" href="/method">
          {t('hero.secondary')}
        </a>
      </div>

      <div className="hero__reading" data-reveal>
        <span className="hero__aqi num">{status === 'loading' ? '—' : fmt(aqi)}</span>
        <p>
          <span
            className="hero__band"
            aria-hidden="true"
            style={{ background: `var(--aqi-${category})` }}
          />
          {tf('hero.now', {
            city: profile.city,
            category: label,
            dominant: DOMINANT_LABEL[dominant ?? ''] ?? 'PM2.5',
          })}
          <br />
          {tf('hero.who', { pm: fmt(pm25), times: whoMultiple(pm25).toFixed(1) })}
        </p>
      </div>

      {(air?.sample || status === 'loading') && (
        <p className="note" style={{ marginTop: 20 }}>
          {status === 'loading' ? t('hero.loading') : t('hero.sample')}
        </p>
      )}
    </section>
  )
}
