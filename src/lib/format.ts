export function fmt(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function fmtCompact(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1_000_000) return `${fmt(value / 1_000_000, 1)}M`
  if (Math.abs(value) >= 1_000) return `${fmt(value / 1_000, 1)}k`
  return fmt(value)
}

export function inr(value: number): string {
  return `₹${fmt(Math.round(value))}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function dateLabel(iso: string, language: 'en' | 'hi' = 'en'): string {
  const date = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

export function aqiVar(category: string): string {
  switch (category) {
    case 'good':
      return 'var(--aqi-good)'
    case 'satisfactory':
      return 'var(--aqi-satisfactory)'
    case 'moderate':
      return 'var(--aqi-moderate)'
    case 'poor':
      return 'var(--aqi-poor)'
    case 'very-poor':
      return 'var(--aqi-very-poor)'
    default:
      return 'var(--aqi-severe)'
  }
}

export function hazeColor(pm25: number): string {
  const t = clamp(pm25 / 400, 0, 1)
  const r = Math.round(150 + t * 60)
  const g = Math.round(150 - t * 40)
  const b = Math.round(160 - t * 90)
  return `rgb(${r}, ${g}, ${b})`
}
