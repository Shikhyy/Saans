import { describe, expect, it, vi } from 'vitest'
import { api } from '../server/app'
import { writePlanWithModel } from '../server/lib/gemini'
import { buildUrl, fetchJson, UpstreamError } from '../server/lib/upstream'
import { DEFAULT_PROFILE } from '../src/state/app'
import { composePlan, type PlanFacts } from '../src/core/plan'

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

  it('rejects a body over the cap even when chunked without content-length', async () => {
    const response = await api.fetch(post('x'.repeat(9000)))
    expect(response.status).toBe(413)

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('x'.repeat(5000)))
        controller.enqueue(encoder.encode('x'.repeat(5000)))
        controller.close()
      },
    })
    const streamed = await api.fetch(
      new Request('http://localhost/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: stream,
        duplex: 'half',
      } as RequestInit),
    )
    expect(streamed.status).toBe(413)
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

  it('blocks untrusted cross-origin requests unless explicitly allowlisted', async () => {
    const previous = process.env.ALLOWED_ORIGINS
    delete process.env.ALLOWED_ORIGINS
    const blocked = await api.fetch(
      new Request('http://localhost/api/health', {
        headers: { Origin: 'https://evil.example.com' },
      }),
    )
    expect(blocked.status).toBe(403)

    process.env.ALLOWED_ORIGINS = 'https://trusted.example.com'
    const allowed = await api.fetch(
      new Request('http://localhost/api/health', {
        headers: { Origin: 'https://trusted.example.com' },
      }),
    )
    expect(allowed.status).toBe(200)
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://trusted.example.com')

    if (previous === undefined) delete process.env.ALLOWED_ORIGINS
    else process.env.ALLOWED_ORIGINS = previous
  })
})

describe('the model writer', () => {
  it('parses valid schema-conforming JSON returned by Gemini', async () => {
    const engine = composePlan(facts, DEFAULT_PROFILE)
    const modelReply = {
      headline: engine.headline,
      summary: engine.summary,
      actions: engine.actions,
      caution: engine.caution,
    }
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(modelReply) }] } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    try {
      const result = await writePlanWithModel(
        DEFAULT_PROFILE,
        facts,
        'test-key',
        'gemini-2.5-flash',
      )
      expect(result).toEqual(modelReply)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('returns null when Gemini responds with invalid JSON or non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('upstream error', { status: 503 })),
    )
    try {
      expect(
        await writePlanWithModel(DEFAULT_PROFILE, facts, 'test-key', 'gemini-2.5-flash'),
      ).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: '{not valid' }] } }] }),
            { status: 200 },
          ),
      ),
    )
    try {
      expect(
        await writePlanWithModel(DEFAULT_PROFILE, facts, 'test-key', 'gemini-2.5-flash'),
      ).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
