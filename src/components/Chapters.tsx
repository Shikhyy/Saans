import { formatHour, pm25At, pointAt } from '../core/planner'
import { fmt } from '../lib/format'
import { useApp } from '../state/app'
import type { StringKey } from '../lib/i18n'

const CHAPTERS: { hours: StringKey; title: StringKey; body: StringKey; at: number }[] = [
  { hours: 'chapter.one.hours', title: 'chapter.one.title', body: 'chapter.one.body', at: 7 },
  { hours: 'chapter.two.hours', title: 'chapter.two.title', body: 'chapter.two.body', at: 14 },
  {
    hours: 'chapter.three.hours',
    title: 'chapter.three.title',
    body: 'chapter.three.body',
    at: 20,
  },
]

/**
 * The scrolling half of the split. Each chapter is a real hour of the forecast, so the fixed city
 * and the text beside it are always describing the same moment.
 */
export function Chapters() {
  const { t, tf, today, dose, budget, cleanWindow } = useApp()
  const points = today?.points ?? []
  const used = budget > 0 ? Math.round((dose / budget) * 100) : 0

  return (
    <>
      {CHAPTERS.map((chapter) => {
        const point = pointAt(points, chapter.at)
        const pm = points.length ? pm25At(points, chapter.at) : null
        const hour = `${String(chapter.at).padStart(2, '0')}:00`
        return (
          <section
            className="chapter read-block"
            key={chapter.title}
            aria-labelledby={`${chapter.title}-title`}
            data-reveal-group
          >
            <p className="chapter__hour num" data-reveal-item>
              {t(chapter.hours)}
            </p>
            <h2 id={`${chapter.title}-title`} data-reveal-item>
              {t(chapter.title)}
            </h2>
            <p data-reveal-item>{t(chapter.body)}</p>
            <div className="chapter__figures" data-reveal-item>
              <div>
                <strong className="num">{pm == null ? '—' : `${fmt(pm)} µg/m³`}</strong>
                <span>{tf('chapter.pmAt', { hour })}</span>
              </div>
              <div>
                <strong className="num">
                  {point?.boundaryLayerM ? `${fmt(point.boundaryLayerM)} m` : '—'}
                </strong>
                <span>{tf('chapter.layerAt', { hour })}</span>
              </div>
            </div>
          </section>
        )
      })}

      <section className="cost read-block" aria-labelledby="cost-title" data-reveal-group>
        <h2 id="cost-title" data-reveal-item>
          {t('cost.title')}
        </h2>
        <dl className="figures">
          <div className="figure-row" data-reveal-item>
            <dt className="num">{fmt(dose)} µg</dt>
            <dd>{t('cost.dose')}</dd>
          </div>
          <div className="figure-row" data-reveal-item>
            <dt className="num">{fmt(budget)} µg</dt>
            <dd>{t('cost.budget')}</dd>
          </div>
          <div className="figure-row" data-reveal-item>
            <dt className="num">{used}%</dt>
            <dd>{t('cost.used')}</dd>
          </div>
          <div className="figure-row" data-reveal-item>
            <dt className="num">
              {cleanWindow
                ? `${formatHour(cleanWindow.startHour)}–${formatHour(cleanWindow.endHour)}`
                : '—'}
            </dt>
            <dd>{cleanWindow ? t('cost.window') : t('cost.none')}</dd>
          </div>
        </dl>
      </section>
    </>
  )
}
