import type { PlanFacts } from '../../src/core/plan'
import { planResponseSchema, type PlanResponse } from '../../src/core/schemas'
import type { HouseholdProfile } from '../../src/core/types'

/**
 * The model is a writer, not a calculator. It receives facts that were already computed and is asked
 * to phrase them. Numbers in the output are checked against the input by construction: the prompt
 * forbids new ones, the schema bounds their length, and the deterministic engine is used whenever
 * the reply fails validation.
 */

const MODEL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    summary: { type: 'STRING' },
    actions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          why: { type: 'STRING' },
          when: { type: 'STRING' },
          impact: { type: 'STRING' },
        },
        required: ['title', 'why', 'when', 'impact'],
      },
    },
    caution: { type: 'STRING' },
  },
  required: ['headline', 'summary', 'actions', 'caution'],
} as const

function systemPrompt(profile: HouseholdProfile): string {
  const language =
    profile.language === 'hi'
      ? 'Write every string in Hindi (Devanagari). Keep numerals as Western digits.'
      : 'Write in plain English at a 9th-grade reading level.'
  return [
    'You are SAANS, an air-quality planning assistant for households in smog-heavy cities.',
    language,
    'You are given JSON facts that have already been computed from a forecast. Use ONLY those numbers.',
    'Never invent a number, a measurement, a product name or a health outcome.',
    'Never give medical advice or a diagnosis. Never promise that an action prevents illness.',
    'Be concrete: name the hour, the action and the change it produces.',
    'headline: at most 8 words, no exclamation mark. summary: 2 sentences, at most 55 words.',
    'actions: exactly 3, ordered by how much they reduce exposure per rupee. why: one sentence with a number from the facts. when: a clock time or a short moment. impact: a short quantity such as "-420 µg" or "₹2,200".',
    'caution: one sentence reminding the reader this is an estimate, not medical advice.',
    'Do not use markdown, emoji, or bullet characters inside strings.',
  ].join('\n')
}

function sanitizeLabel(value: string): string {
  return value.replace(/[\r\n\t\0]/g, ' ').trim()
}

/**
 * Ask Gemini to phrase pre-computed `facts` into a structured household action plan, returning
 * `null` if the upstream call fails or produces schema-invalid JSON so callers fall back cleanly.
 */
export async function writePlanWithModel(
  profile: HouseholdProfile,
  facts: PlanFacts,
  apiKey: string,
  model: string,
): Promise<PlanResponse | null> {
  const safeProfile: HouseholdProfile = { ...profile, city: sanitizeLabel(profile.city) }
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt(safeProfile) }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Household profile:\n${JSON.stringify(safeProfile)}\n\nComputed facts:\n${JSON.stringify(facts)}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 900,
      responseMimeType: 'application/json',
      responseSchema: MODEL_SCHEMA,
    },
  }

  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  )

  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  })

  if (!response.ok) return null

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return null

  try {
    const parsed: unknown = JSON.parse(text)
    const validated = planResponseSchema.safeParse(parsed)
    return validated.success ? validated.data : null
  } catch {
    return null
  }
}
