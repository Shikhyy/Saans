import { expect, test } from '@playwright/test'

test('the first screen answers what this is and what to do', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('breath budget')
  await expect(page.getByRole('button', { name: /Plan today|आज की योजना/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /How the numbers work|गणना/ })).toBeVisible()
})

test('a routine can be moved from the keyboard alone', async ({ page }) => {
  await page.goto('/')
  const walk = page.getByRole('slider', { name: /Morning walk/i })
  await walk.scrollIntoViewIfNeeded()
  await walk.focus()
  const before = await walk.getAttribute('aria-valuetext')
  await page.keyboard.press('ArrowRight')
  await expect(walk).not.toHaveAttribute('aria-valuetext', before ?? '')
  await page.keyboard.press('Shift+ArrowRight')
  const after = await walk.getAttribute('aria-valuetext')
  expect(after).not.toBe(before)
})

test('the plan is written and attributed', async ({ page }) => {
  await page.goto('/')
  const button = page.getByRole('button', { name: /Write my plan|मेरी योजना/ })
  await button.scrollIntoViewIfNeeded()
  await button.click()
  await expect(page.locator('.slip__foot')).toContainText(/engine|Gemini/)
})

test('the method page carries the formulas and the credits', async ({ page }) => {
  await page.goto('/method')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const indoorFormula = page.locator('pre.formula').filter({ hasText: 'C_in' })
  await expect(indoorFormula).toContainText('C_in')
  await expect(page.getByText('Open-Meteo', { exact: false }).first()).toBeVisible()
})

test('every section is reachable and nothing is left invisible', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1200)
  const hidden = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-reveal],[data-reveal-item],[data-motion]')].filter(
        (element) => getComputedStyle(element).visibility === 'hidden',
      ).length,
  )
  expect(hidden).toBe(0)
})
