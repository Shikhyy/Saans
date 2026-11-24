import { describe, expect, it } from 'vitest'
import { ramp } from '../src/lib/ramp'

/**
 * The exposure strip maps a smoothed reading onto the brand ramp — low grey-green at the bottom,
 * the warm accent at the top. The endpoints and the interpolation are part of the surface, so they
 * get the same golden-value treatment the AQI table gets.
 */
describe('the exposure ramp', () => {
  it('maps the lowest reading onto the ramp low colour', () => {
    expect(ramp(0, 400)).toBe('rgb(20, 22, 27)')
  })

  it('maps the highest reading onto the ramp high colour', () => {
    expect(ramp(400, 400)).toBe('rgb(255, 174, 92)')
  })

  it('interpolates linearly between the two end colours', () => {
    // halfway up the ramp: 20 + (255 - 20) * 0.5 = 137.5 -> 138, and so on per channel.
    expect(ramp(200, 400)).toBe('rgb(138, 98, 60)')
  })

  it('clamps readings outside the fitted range', () => {
    expect(ramp(900, 400)).toBe('rgb(255, 174, 92)')
    expect(ramp(-5, 400)).toBe('rgb(20, 22, 27)')
  })
})
