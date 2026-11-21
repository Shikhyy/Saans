/**
 * Every outbound request goes through here. The host allowlist is the SSRF guard: the client can
 * choose a latitude and longitude, never a URL.
 */

const ALLOWED_HOSTS = new Set([
  'air-quality-api.open-meteo.com',
  'api.open-meteo.com',
  'geocoding-api.open-meteo.com',
])

const TIMEOUT_MS = 8000

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'UpstreamError'
  }
}

export async function fetchJson(url: URL, signal?: AbortSignal): Promise<unknown> {
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new UpstreamError('Blocked upstream host', 502)
  }
  if (url.protocol !== 'https:') {
    throw new UpstreamError('Upstream must be https', 502)
  }

  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  const response = await fetch(url, {
    signal: combined,
    headers: {
      'User-Agent': 'SAANS/1.0 (air-quality planning app)',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new UpstreamError(`Upstream responded ${response.status}`, 502)
  }
  return response.json()
}

export function buildUrl(base: string, params: Record<string, string | number>): URL {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
  return url
}
