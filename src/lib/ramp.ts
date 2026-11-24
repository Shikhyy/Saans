/** The exposure strip's colour scale: cool grey-green at the low end, warm accent at the high. */
const RAMP_LOW = [20, 22, 27] as const
const RAMP_HIGH = [255, 174, 92] as const

/**
 * Map a smoothed PM2.5 reading onto the exposure ramp, normalised against the worst reading in the
 * fitted neighbourhood. The endpoints and the linear interpolation between them are golden values.
 */
export function ramp(value: number, max: number): string {
  const t = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const mix = (from: number, to: number) => Math.round(from + (to - from) * t)
  const r = mix(RAMP_LOW[0], RAMP_HIGH[0])
  const g = mix(RAMP_LOW[1], RAMP_HIGH[1])
  const b = mix(RAMP_LOW[2], RAMP_HIGH[2])
  return `rgb(${r}, ${g}, ${b})`
}
