/** A bounded TTL cache. One process, one map — enough for a demo and honest about its limits. */
export class TtlCache<T> {
  private readonly map = new Map<string, { value: T; expires: number }>()

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 400,
  ) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expires) {
      this.map.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
    this.map.set(key, { value, expires: Date.now() + this.ttlMs })
  }
}

export class RateLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  take(key: string): { allowed: boolean; remaining: number; retryAfter: number } {
    const now = Date.now()
    const recent = (this.hits.get(key) ?? []).filter((time) => now - time < this.windowMs)
    if (recent.length >= this.limit) {
      const oldest = recent[0] ?? now
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((this.windowMs - (now - oldest)) / 1000),
      }
    }
    recent.push(now)
    this.hits.set(key, recent)
    if (this.hits.size > 5000) {
      for (const [key2, times] of this.hits) {
        if (times.every((time) => now - time >= this.windowMs)) this.hits.delete(key2)
      }
    }
    return { allowed: true, remaining: this.limit - recent.length, retryAfter: 0 }
  }
}
