import { describe, expect, it } from 'vitest'
import { api } from '../server/app'
import { buildUrl, fetchJson, UpstreamError } from '../server/lib/upstream'
import { DEFAULT_PROFILE } from '../src/state/app'
import type { PlanFacts } from '../src/core/plan'

const facts: PlanFacts = {
  aqi: 300,
  pm25: 180,
  category: 'poor',
  cleanWindow: null,
  dayDoseUg: 400,
  budgetUg: 259.2,
  indoorPeakPm25: 200,
  bestShift: null,
  topIntervention: null,
}

function post(body: string): Request {
  return new Request('http://localhost/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

describe('the upstream guard', () => {
  it('refuses any host that is not on the allowlist', async () => {
    await expect(fetchJson(new URL('https://evil.example.com/data'))).rejects.toBeInstanceOf(
      UpstreamError,
    )
    await expect(fetchJson(new URL('https://169.254.169.254/latest'))).rejects.toBeInstanceOf(
      UpstreamError,
    )
  })

  it('refuses plain http even on an allowed host', async () => {
    await expect(
      fetchJson(new URL('http://api.open-meteo.com/v1/forecast')),
    ).rejects.toBeInstanceOf(UpstreamError)
  })

  it('builds urls from parameters, never from a caller-supplied url', () => {
    const url = buildUrl('https://api.open-meteo.com/v1/forecast', { latitude: 28.6, q: 'a&b=c' })
    expect(url.hostname).toBe('api.open-meteo.com')
    expect(url.searchParams.get('q')).toBe('a&b=c')
    expect(url.searchParams.get('latitude')).toBe('28.6')
  })
})

describe('the api surface', () => {
  it('answers health', async () => {
    const response = await api.fetch(new Request('http://localhost/api/health'))
    expect(response.status).toBe(200)
    expect((await response.json()).ok).toBe(true)
  })

  it('rejects coordinates outside the globe', async () => {
    const response = await api.fetch(new Request('http://localhost/api/air?lat=999&lon=0'))
    expect(response.status).toBe(400)
  })

  it('rejects a geocode query that is too short', async () => {
    const response = await api.fetch(new Request('http://localhost/api/geocode?q=a'))
    expect(response.status).toBe(400)
  })

  it('rejects malformed json', async () => {
    const response = await api.fetch(post('{not json'))
    expect(response.status).toBe(400)
  })

  it('rejects unknown fields and bad values', async () => {
    const good = { profile: DEFAULT_PROFILE, facts }
    expect((await api.fetch(post(JSON.stringify({ ...good, extra: 1 })))).status).toBe(400)
    expect(
      (
        await api.fetch(
          post(JSON.stringify({ ...good, profile: { ...DEFAULT_PROFILE, latitude: 500 } })),
        )
      ).status,
    ).toBe(400)
  })

  it('rejects a body over the cap', async () => {
    const response = await api.fetch(post('x'.repeat(9000)))
    expect(response.status).toBe(413)
  })

  it('writes a plan from the engine when no model key is set', async () => {
    const previous = process.env.GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY
    const response = await api.fetch(post(JSON.stringify({ profile: DEFAULT_PROFILE, facts })))
    expect(response.status).toBe(200)
    const plan = await response.json()
    expect(plan.source).toBe('engine')
    expect(plan.actions.length).toBe(3)
    if (previous) process.env.GEMINI_API_KEY = previous
  })
})
