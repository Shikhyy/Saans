import { formatHour } from '../core/planner'
import { dateLabel, fmt } from '../lib/format'
import { useApp } from '../state/app'

/**
 * The plan is printed, not chatted. It arrives as a slip: the household's day as an itinerary with
 * times on the right and the reason under each line, and a total at the foot.
 */
export function Copilot() {
  const {
    t,
    tf,
    language,
    profile,
    plan,
    planStatus,
    generatePlan,
    indoor,
    pm25,
    aqi,
    cleanWindow,
    dose,
    budget,
    hacks,
    today,
  } = useApp()

  const pct = budget > 0 ? Math.round((dose / budget) * 100) : 0
  const windowText = cleanWindow
    ? `${formatHour(cleanWindow.startHour)}–${formatHour(cleanWindow.endHour)}`
    : t('plan.none')

  const given: [string, string][] = [
    [t('plan.pmNow'), `${fmt(pm25)} µg/m³`],
    [t('plan.aqi'), fmt(aqi)],
    [t('plan.window'), windowText],
    [t('plan.dayTotal'), `${fmt(dose)} / ${fmt(budget)} µg`],
    [t('plan.kitchen'), `${fmt(indoor.cookingPeakPm25)} µg/m³`],
    [t('plan.topFix'), hacks[0]?.title ?? '—'],
  ]

  return (
    <section className="band band--raised" id="plan" aria-labelledby="plan-title">
      <header className="band__head">
        <h2 id="plan-title" data-motion="words">
          {t('plan.title')}
        </h2>
        <p data-reveal>{t('plan.note')}</p>
      </header>

      <div className="slip-split">
        <div data-reveal-group>
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => void generatePlan()}
            disabled={planStatus === 'loading'}
            aria-busy={planStatus === 'loading'}
            data-reveal-item
            data-magnetic="0.12"
          >
            {planStatus === 'loading' ? t('plan.generating') : t('plan.generate')}
          </button>

          <table className="facts" data-reveal-item>
            <caption className="sr-only">{t('plan.given')}</caption>
            <tbody>
              {given.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="note" data-reveal-item>
            {t('plan.givenNote')}
          </p>
        </div>

        <div className="slip" data-reveal aria-live="polite">
          <div className="slip__mark">SAANS</div>
          <div className="slip__meta">
            {tf('plan.slipMeta', {
              city: profile.city,
              date: today ? dateLabel(today.date, language) : '',
            })}
          </div>

          <p className="slip__headline">
            {plan
              ? plan.headline
              : planStatus === 'loading'
                ? t('plan.generating')
                : t('plan.empty')}
          </p>
          <p className="slip__summary">{plan ? plan.summary : t('plan.emptyBody')}</p>

          {plan && (
            <>
              <div className="slip__group">{t('plan.today')}</div>
              {plan.actions.map((action) => (
                <div className="slip__row" key={action.title}>
                  <div className="slip__line">
                    <span>{action.title}</span>
                    <span className="slip__dots" aria-hidden="true" />
                    <b>{action.when}</b>
                  </div>
                  <p className="slip__why">
                    {action.why} <b>{action.impact}</b>
                  </p>
                </div>
              ))}
            </>
          )}

          <div className="slip__total">
            <span>{t('plan.total')}</span>
            <b className="num">{pct}%</b>
          </div>

          <p className="slip__foot">
            {plan ? plan.caution : t('plan.caution')}
            <br />
            {plan
              ? plan.source === 'model'
                ? t('plan.sourceModel')
                : t('plan.sourceEngine')
              : t('plan.sourceEngine')}
          </p>
        </div>
      </div>
    </section>
  )
}
