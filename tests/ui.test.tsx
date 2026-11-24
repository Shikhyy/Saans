import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { AppProvider } from '../src/state/app'
import { DayPlanner } from '../src/components/DayPlanner'
import { Copilot } from '../src/components/Copilot'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { Heatmap } from '../src/components/Heatmap'
import { Method } from '../src/components/Method'
import { readCachedAir } from '../src/state/storage'
import { samplePayload } from '../src/data/sample'
import { composePlan } from '../src/core/plan'
import { DEFAULT_PROFILE } from '../src/state/app'
import type { PlanFacts } from '../src/core/plan'

const facts: PlanFacts = {
  aqi: 300,
  pm25: 180,
  category: 'poor',
  cleanWindow: { startHour: 14, endHour: 16, meanPm25: 90 },
  dayDoseUg: 400,
  budgetUg: 259.2,
  indoorPeakPm25: 200,
  bestShift: null,
  topIntervention: null,
}

function mockNetwork(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes('/api/plan')
        ? { ...composePlan(facts, DEFAULT_PROFILE), source: 'engine' }
        : samplePayload()
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
}

beforeEach(() => {
  mockNetwork()
})

describe('the day timeline', () => {
  it('exposes every movable routine as a slider with a spoken value', async () => {
    render(
      <AppProvider>
        <DayPlanner />
      </AppProvider>,
    )
    const walk = await screen.findByRole('slider', { name: /Morning walk/i })
    expect(walk).toHaveAttribute('aria-valuetext', '06:30')
    expect(walk).toHaveAttribute('aria-valuemin', '0')
    expect(walk).toHaveAttribute('aria-valuemax', '24')
  })

  it('moves a routine by 15 minutes with the arrow key, and an hour with shift', async () => {
    const user = userEvent.setup()
    render(
      <AppProvider>
        <DayPlanner />
      </AppProvider>,
    )
    const walk = await screen.findByRole('slider', { name: /Morning walk/i })
    walk.focus()
    await user.keyboard('{ArrowRight}')
    expect(walk).toHaveAttribute('aria-valuetext', '06:45')
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(walk).toHaveAttribute('aria-valuetext', '07:45')
    await user.keyboard('{ArrowLeft}')
    expect(walk).toHaveAttribute('aria-valuetext', '07:30')
  })

  it('jumps to the ends of the day with Home and End', async () => {
    const user = userEvent.setup()
    render(
      <AppProvider>
        <DayPlanner />
      </AppProvider>,
    )
    const walk = await screen.findByRole('slider', { name: /Morning walk/i })
    walk.focus()
    await user.keyboard('{End}')
    expect(walk).toHaveAttribute('aria-valuetext', '23:45')
    await user.keyboard('{Home}')
    expect(walk).toHaveAttribute('aria-valuetext', '00:00')
  })

  it('does not let the cooking routine be moved', async () => {
    render(
      <AppProvider>
        <DayPlanner />
      </AppProvider>,
    )
    const cook = await screen.findByRole('slider', { name: /Cooking/i })
    expect(cook).toHaveAttribute('tabindex', '-1')
    expect(cook).toHaveAttribute('data-movable', 'false')
  })

  it('reports the budget as a progressbar with a text percentage', async () => {
    render(
      <AppProvider>
        <DayPlanner />
      </AppProvider>,
    )
    const bar = await screen.findByRole('progressbar', { name: /Budget spent/i })
    await waitFor(() => expect(Number(bar.getAttribute('aria-valuenow'))).toBeGreaterThan(0))
  })
})

describe('the exposure heatmap', () => {
  it('draws one cell per position in the fitted neighbourhood', () => {
    const { container } = render(
      <Heatmap
        samples={[
          { lat: 28.61, lon: 77.21, hour: 9, pm25: 64.5 },
          { lat: 28.62, lon: 77.22, hour: 9, pm25: 70.0 },
        ]}
        lat={28.61}
        lon={77.21}
        hours={9}
      />,
    )
    expect(container.querySelector('.heatmap')).not.toBeNull()
    expect(container.querySelectorAll('.heatmap__cell')).toHaveLength(9)
  })
})

describe('the written plan', () => {
  it('renders the plan as text and names its source', async () => {
    const user = userEvent.setup()
    render(
      <AppProvider>
        <Copilot />
      </AppProvider>,
    )
    await user.click(screen.getByRole('button', { name: /Write my plan/i }))
    await waitFor(() =>
      expect(document.querySelector('.slip__foot')?.textContent).toMatch(
        /Written by the local engine/i,
      ),
    )
    const slip = document.querySelector('.slip')
    expect(slip?.querySelectorAll('script, iframe')).toHaveLength(0)
  })

  it('shows the facts it is given before anything is generated', () => {
    render(
      <AppProvider>
        <Copilot />
      </AppProvider>,
    )
    expect(screen.getByRole('rowheader', { name: 'CPCB AQI' })).toBeInTheDocument()
    expect(screen.getByText(/No plan written yet/i)).toBeInTheDocument()
  })
})

describe('accessibility', () => {
  it('has no axe violations in the planner', async () => {
    const { container } = render(
      <AppProvider>
        <DayPlanner />
      </AppProvider>,
    )
    await screen.findByRole('slider', { name: /Morning walk/i })
    const results = await axe.run(container, {
      rules: {
        // jsdom paints nothing, so contrast and page-level rules cannot be measured here.
        'color-contrast': { enabled: false },
        region: { enabled: false },
        'page-has-heading-one': { enabled: false },
      },
    })
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  it('has valid heading order and zero axe violations on the method page', async () => {
    const { container } = render(<Method />)
    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    })
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})

describe('resilience and storage', () => {
  it('recovers gracefully inside ErrorBoundary when a child throws', async () => {
    const user = userEvent.setup()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let shouldThrow = true
    function Bomb() {
      if (shouldThrow) throw new Error('boom')
      return <p>Recovered content</p>
    }
    const { getByRole, queryByText } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(getByRole('alert')).toBeInTheDocument()
    shouldThrow = false
    await user.click(getByRole('button', { name: /Reload view/i }))
    expect(queryByText('Recovered content')).toBeInTheDocument()
    errorSpy.mockRestore()
  })

  it('ignores cached air forecasts older than 24 hours', () => {
    const payload = samplePayload()
    window.localStorage.setItem(
      'saans.air.v1',
      JSON.stringify({ at: Date.now() - 25 * 60 * 60 * 1000, payload }),
    )
    expect(readCachedAir()).toBeNull()
  })
})
