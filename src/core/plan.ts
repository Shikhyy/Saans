import { formatHour } from './planner'
import type { HouseholdProfile, Plan } from './types'

/**
 * The deterministic plan engine.
 *
 * This is not a degraded fallback — it is the product's floor. It produces the same shape the model
 * produces, from the same facts, with no network, no key and no variance. The model is allowed to
 * make it read better; it is never allowed to make it more correct.
 */

export interface PlanFacts {
  aqi: number
  pm25: number
  category: string
  cleanWindow: { startHour: number; endHour: number; meanPm25: number } | null
  dayDoseUg: number
  budgetUg: number
  indoorPeakPm25: number
  bestShift: { label: string; start: number; savedUg: number } | null
  topIntervention: { title: string; deltaPm25: number; costInr: number } | null
}

const fmt = (value: number) => new Intl.NumberFormat('en-IN').format(Math.round(value))

export function composePlan(facts: PlanFacts, profile: HouseholdProfile): Plan {
  const hi = profile.language === 'hi'
  const used = facts.budgetUg > 0 ? facts.dayDoseUg / facts.budgetUg : 0
  const pct = Math.round(used * 100)
  const window = facts.cleanWindow
  const windowText = window
    ? `${formatHour(window.startHour)}–${formatHour(window.endHour)}`
    : hi
      ? 'आज नहीं'
      : 'none today'

  if (hi) {
    const headline =
      used > 1 ? `आज का बजट ${pct}% पर पहुँच चुका है` : `आज का बजट ${pct}% पर है`
    const summary = window
      ? `बाहर की हवा में PM2.5 ${fmt(facts.pm25)} µg/m³ है — WHO की सीमा से लगभग ${(facts.pm25 / 15).toFixed(1)} गुना। सबसे साफ़ खिड़की ${windowText} है, जब PM2.5 औसत ${fmt(window.meanPm25)} µg/m³ रहता है।`
      : `बाहर की हवा में PM2.5 ${fmt(facts.pm25)} µg/m³ है। आज कोई साफ़ खिड़की नहीं मिली, इसलिए बाहर का समय कम रखें।`

    const actions = [
      {
        title: window ? `बाहर का समय ${windowText} पर लाएँ` : 'बाहर का समय घटाएँ',
        why: window
          ? `उस अवधि में सांस में जाने वाला कण सबसे कम होता है। आज का अनुमान ${fmt(facts.dayDoseUg)} µg है, जो ${pct}% बजट है।`
          : 'पूरे दिन की हवा खराब है, इसलिए अवधि घटाना ही सबसे बड़ा बदलाव है।',
        when: window ? `${formatHour(window.startHour)} बजे` : 'आज',
        impact: window ? `${fmt(window.meanPm25)} µg/m³ औसत` : 'जोखिम कम',
      },
      facts.topIntervention
        ? {
            title: facts.topIntervention.title,
            why: `घर के अंदर खाना बनाते समय PM2.5 लगभग ${fmt(facts.indoorPeakPm25)} µg/m³ तक जाता है। यह बदलाव उसे ${fmt(facts.topIntervention.deltaPm25)} µg/m³ घटाता है।`,
            when: 'आज से',
            impact: `₹${fmt(facts.topIntervention.costInr)} · −${fmt(facts.topIntervention.deltaPm25)} µg/m³`,
          }
        : {
            title: 'खाना बनाते समय खिड़की बंद रखें',
            why: 'बाहर की हवा अंदर आने से रोकना सबसे सस्ता कदम है।',
            when: 'खाना बनाते समय',
            impact: 'जोखिम कम',
          },
      {
        title: 'सुबह की सैर को दोपहर में बदलें',
        why: 'सर्दियों में सुबह के समय वायुमंडलीय परत नीचे होती है, जिससे धुआँ ज़मीन के पास फँस जाता है।',
        when: 'दोपहर',
        impact: 'कम संपर्क',
      },
    ]

    return {
      headline,
      summary,
      actions,
      caution:
        'यह एक अनुमानित योजना है, चिकित्सकीय सलाह नहीं। दमा या दिल की बीमारी में डॉक्टर से पूछें।',
      source: 'engine',
    }
  }

  const headline =
    used > 1 ? `Today already costs ${pct}% of a safe day` : `Today uses ${pct}% of a safe day`

  const summary = window
    ? `The air outside is ${fmt(facts.pm25)} µg/m³ of PM2.5 — about ${(facts.pm25 / 15).toFixed(1)}× the WHO limit. The cleanest stretch is ${windowText}, averaging ${fmt(window.meanPm25)} µg/m³. Move what you can into it.`
    : `The air outside is ${fmt(facts.pm25)} µg/m³ of PM2.5 and there is no clean window today. Keep outdoor time short and the house closed.`

  const actions = [
    {
      title: window ? `Put outdoor time in ${windowText}` : 'Cut outdoor time',
      why: window
        ? `That stretch carries the least particles. Your household's day currently adds up to ${fmt(facts.dayDoseUg)} µg inhaled, which is ${pct}% of the reference budget.`
        : 'Every hour today is above the reference level, so duration is the only lever that matters.',
      when: window ? `From ${formatHour(window.startHour)}` : 'Today',
      impact: window ? `${fmt(window.meanPm25)} µg/m³ average` : 'Lower exposure',
    },
    facts.topIntervention
      ? {
          title: facts.topIntervention.title,
          why: `Cooking pushes the kitchen to about ${fmt(facts.indoorPeakPm25)} µg/m³. This change takes ${fmt(facts.topIntervention.deltaPm25)} µg/m³ out of that peak.`,
          when: 'From today',
          impact: `₹${fmt(facts.topIntervention.costInr)} · −${fmt(facts.topIntervention.deltaPm25)} µg/m³`,
        }
      : {
          title: 'Keep the kitchen closed while cooking',
          why: 'Stopping outdoor air from entering is the cheapest reduction available.',
          when: 'While cooking',
          impact: 'Lower peak',
        },
    facts.bestShift
      ? {
          title: `Move ${facts.bestShift.label.toLowerCase()} to ${formatHour(facts.bestShift.start)}`,
          why: `The same ${facts.bestShift.label.toLowerCase()} at that hour saves about ${fmt(facts.bestShift.savedUg)} µg of inhaled particles.`,
          when: formatHour(facts.bestShift.start),
          impact: `−${fmt(facts.bestShift.savedUg)} µg`,
        }
      : {
          title: 'Shift one outdoor routine later',
          why: 'Winter inversions lift in the afternoon, and the forecast usually shows it.',
          when: 'Afternoon',
          impact: 'Lower exposure',
        },
  ]

  return {
    headline,
    summary,
    actions,
    caution:
      'An estimate for planning, not medical advice. If someone has asthma, heart disease or is pregnant, follow their clinician’s guidance.',
    source: 'engine',
  }
}
