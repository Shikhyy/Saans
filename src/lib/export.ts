import { formatHour } from '../core/planner'
import { fmt } from './format'

/**
 * The two integrations that put a plan where families actually keep it: a calendar event and an
 * image for the WhatsApp group. Both are generated on the device; nothing is uploaded.
 */

function icsDate(date: string, hour: number): string {
  const day = date.replace(/-/g, '')
  return `${day}T${formatHour(hour).replace(':', '')}00`
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function fold(line: string): string {
  if (line.length <= 74) return line
  const chunks: string[] = []
  let rest = line
  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74))
    rest = ` ${rest.slice(74)}`
  }
  chunks.push(rest)
  return chunks.join('\r\n')
}

export interface IcsOptions {
  date: string
  startHour: number
  endHour: number
  city: string
  meanPm25: number
  url: string
}

export function buildIcs(options: IcsOptions): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] ?? ''
  const description = `Cleanest air window in ${options.city} today: about ${fmt(options.meanPm25)} µg/m³ PM2.5 on average. Plan from SAANS: ${options.url}`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SAANS//Breath budget//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:saans-${options.date}-${Math.round(options.startHour * 60)}@saans.app`,
    `DTSTAMP:${stamp}Z`,
    `DTSTART:${icsDate(options.date, options.startHour)}`,
    `DTEND:${icsDate(options.date, options.endHour)}`,
    fold(`SUMMARY:${escapeIcs(`Clean air window — ${options.city}`)}`),
    fold(`DESCRIPTION:${escapeIcs(description)}`),
    fold(`URL:${options.url}`),
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    fold(`DESCRIPTION:${escapeIcs('The clean hour starts in 15 minutes.')}`),
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadIcs(options: IcsOptions): void {
  const blob = new Blob([buildIcs(options)], { type: 'text/calendar;charset=utf-8' })
  triggerDownload(blob, `saans-clean-window-${options.date}.ics`)
}

export interface CardOptions {
  city: string
  date: string
  pm25: number
  multiple: number
  dose: number
  budget: number
  window: { startHour: number; endHour: number; meanPm25: number } | null
  headline: string
  url: string
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function buildShareCard(options: CardOptions): Promise<Blob | null> {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#07080A'
  ctx.fillRect(0, 0, 1080, 1350)

  ctx.fillStyle = '#FFAE5C'
  ctx.fillRect(72, 96, 44, 6)

  ctx.fillStyle = '#F2EDE6'
  ctx.font = '400 30px "Archivo Variable", system-ui, sans-serif'
  ctx.fillText('SAANS', 72, 170)

  ctx.fillStyle = '#8D877E'
  ctx.font = '400 26px "Archivo Variable", system-ui, sans-serif'
  ctx.fillText(`${options.city} · ${options.date}`, 72, 214)

  ctx.fillStyle = '#F2EDE6'
  ctx.font = '400 300px "Archivo Variable", Georgia, serif'
  ctx.fillText(`${options.multiple.toFixed(1)}×`, 60, 520)

  ctx.fillStyle = '#C6BFB5'
  ctx.font = '400 34px "Archivo Variable", system-ui, sans-serif'
  ctx.fillText('the WHO 24-hour PM2.5 limit', 76, 570)

  ctx.fillStyle = '#F2EDE6'
  ctx.font = '400 52px "Archivo Variable", Georgia, serif'
  const lines = wrap(ctx, options.headline, 900).slice(0, 3)
  lines.forEach((line, index) => {
    ctx.fillText(line, 72, 700 + index * 62)
  })

  const rows: [string, string][] = [
    ['PM2.5 now', `${fmt(options.pm25)} µg/m³`],
    ['Budget spent', `${Math.round((options.dose / Math.max(1, options.budget)) * 100)}%`],
    [
      'Cleanest window',
      options.window
        ? `${formatHour(options.window.startHour)}–${formatHour(options.window.endHour)}`
        : 'none today',
    ],
  ]

  rows.forEach(([label, value], index) => {
    const y = 900 + index * 96
    ctx.fillStyle = '#8D877E'
    ctx.font = '400 24px "Archivo Variable", system-ui, sans-serif'
    ctx.fillText(label, 72, y)
    ctx.fillStyle = '#F2EDE6'
    ctx.font = '500 40px "Archivo Variable", system-ui, sans-serif'
    ctx.fillText(value, 72, y + 44)
  })

  ctx.fillStyle = '#8D877E'
  ctx.font = '400 22px "Archivo Variable", system-ui, sans-serif'
  ctx.fillText(options.url, 72, 1268)
  ctx.fillText('Estimate for planning, not medical advice.', 72, 1306)

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}

export async function shareCard(options: CardOptions): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = await buildShareCard(options)
  if (!blob) return 'failed'
  const file = new File([blob], 'saans-plan.png', { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
    share?: (data: { files: File[]; title: string; text: string }) => Promise<void>
  }
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: 'SAANS plan', text: options.headline })
      return 'shared'
    } catch {
      return 'failed'
    }
  }
  triggerDownload(blob, 'saans-plan.png')
  return 'downloaded'
}
