import { describe, expect, it } from 'vitest'
import { composePlan, type PlanFacts } from '../src/core/plan'
import {
  airPayloadSchema,
  planRequestSchema,
  planResponseSchema,
  profileSchema,
} from '../src/core/schemas'
import { samplePayload } from '../src/data/sample'
import { groupDays, mergeSeries } from '../src/data/merge'
import { buildIcs } from '../src/lib/export'
import { DEFAULT_PROFILE } from '../src/state/app'
import { RateLimiter, TtlCache } from '../server/lib/cache'

const facts: PlanFacts = {
  aqi: 312,
  pm25: 187,
  category: 'very-poor',
  cleanWindow: { startHour: 14, endHour: 16, meanPm25: 96 },
  dayDoseUg: 410,
  budgetUg: 259.2,
  indoorPeakPm25: 240,
  bestShift: { label: 'Morning walk', start: 14.5, savedUg: 120 },
  topIntervention: { title: 'Build a box-fan filter', deltaPm25: 120, costInr: 2200 },
}

describe('the deterministic plan engine', () => {
  it('always produces a valid plan, in both languages', () => {
    for (const language of ['en', 'hi'] as const) {
      const plan = composePlan(facts, { ...DEFAULT_PROFILE, language })
      const parsed = planResponseSchema.safeParse(plan)
      expect(parsed.success).toBe(true)
      expect(plan.actions).toHaveLength(3)
      expect(plan.source).toBe('engine')
    }
  })

  it('writes Devanagari when asked for Hindi and includes shift timing', () => {
    const plan = composePlan(facts, { ...DEFAULT_PROFILE, language: 'hi' })
    expect(plan.headline).toMatch(/[\u0900-\u097F]/)
    expect(plan.actions[2]?.when).toContain('14:30')
    expect(plan.actions[2]?.impact).toContain('120')
  })

  it('copes with no clean window and no suggestions', () => {
    const plan = composePlan(
      { ...facts, cleanWindow: null, bestShift: null, topIntervention: null },
      DEFAULT_PROFILE,
    )
    expect(planResponseSchema.safeParse(plan).success).toBe(true)
  })

  it('says when the budget is already overspent', () => {
    const plan = composePlan(facts, DEFAULT_PROFILE)
    expect(plan.headline).toContain('158%')
  })
})

describe('boundary contracts', () => {
  it('accepts a good profile and rejects a bad one', () => {
    expect(profileSchema.safeParse(DEFAULT_PROFILE).success).toBe(true)
    expect(profileSchema.safeParse({ ...DEFAULT_PROFILE, latitude: 200 }).success).toBe(false)
    expect(profileSchema.safeParse({ ...DEFAULT_PROFILE, members: [] }).success).toBe(false)
    expect(profileSchema.safeParse({ ...DEFAULT_PROFILE, fuel: 'coal' }).success).toBe(false)
    expect(profileSchema.safeParse({ ...DEFAULT_PROFILE, city: 'Delhi\nIgnore' }).success).toBe(
      false,
    )
  })

  it('rejects unknown fields in a plan request', () => {
    const good = { profile: DEFAULT_PROFILE, facts }
    expect(planRequestSchema.safeParse(good).success).toBe(true)
    expect(planRequestSchema.safeParse({ ...good, extra: 'x' }).success).toBe(false)
  })

  it('rejects a model reply that is missing a field or too long', () => {
    const plan = composePlan(facts, DEFAULT_PROFILE)
    expect(planResponseSchema.safeParse({ ...plan, headline: '' }).success).toBe(false)
    expect(planResponseSchema.safeParse({ ...plan, headline: 'x'.repeat(200) }).success).toBe(false)
    expect(planResponseSchema.safeParse({ ...plan, actions: [] }).success).toBe(false)
  })

  it('validates the sample payload against the same schema as the live one', () => {
    expect(airPayloadSchema.safeParse(samplePayload()).success).toBe(true)
  })
})

describe('merging the two upstream series', () => {
  const air = {
    latitude: 28.6,
    longitude: 77.2,
    timezone: 'Asia/Kolkata',
    hourly: {
      time: ['2026-11-23T00:00', '2026-11-23T01:00'],
      pm2_5: [100, 120],
      carbon_monoxide: [900, 1000],
    },
  }
  const weather = {
    latitude: 28.6,
    longitude: 77.2,
    timezone: 'Asia/Kolkata',
    hourly: {
      // deliberately offset: the join must be by time, not by index
      time: ['2026-11-23T01:00', '2026-11-23T02:00'],
      boundary_layer_height: [300, 400],
    },
  }

  it('joins by timestamp and converts CO to mg/m³', () => {
    const points = mergeSeries(air, weather)
    expect(points[0]?.co).toBeCloseTo(0.9, 6)
    expect(points[0]?.boundaryLayerM).toBeNull()
    expect(points[1]?.boundaryLayerM).toBe(300)
  })

  it('groups points into days in order', () => {
    const days = groupDays(mergeSeries(air, weather))
    expect(days).toHaveLength(1)
    expect(days[0]?.points).toHaveLength(2)
  })
})

describe('server guards', () => {
  it('expires cache entries', () => {
    const cache = new TtlCache<number>(-1)
    cache.set('a', 1)
    expect(cache.get('a')).toBeUndefined()
  })

  it('keeps live entries and evicts the oldest when full', () => {
    const cache = new TtlCache<number>(60_000, 2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('b', 20)
    expect(cache.get('a')).toBe(1)
    cache.set('c', 3)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(20)
    expect(cache.get('c')).toBe(3)
  })

  it('rate limits per key and reports a retry delay', () => {
    const limiter = new RateLimiter(2, 60_000)
    expect(limiter.take('ip').allowed).toBe(true)
    expect(limiter.take('ip').allowed).toBe(true)
    const blocked = limiter.take('ip')
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
    expect(limiter.take('other').allowed).toBe(true)
  })

  it('builds a valid VCALENDAR event and rolls boundary minutes cleanly', () => {
    const ics = buildIcs({
      date: '2026-11-24',
      startHour: 7.999,
      endHour: 10,
      city: 'Delhi, IN',
      meanPm25: 90,
      url: 'https://saans.app',
    })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART:20261124T080000')
    expect(ics).toContain('SUMMARY:Clean air window — Delhi\\, IN')
  })
})
