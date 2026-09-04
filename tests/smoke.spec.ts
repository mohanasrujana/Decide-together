import { test, expect } from 'deepspace/testing'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Smoke tests covering both page kinds this template ships:
 *   - '/'      → the static landing (top level of src/pages/): no providers,
 *                so no auth fetch and no records WebSocket on load.
 *   - '/home'  → a gated dynamic page: providers mount, the nav shell renders,
 *                and signed-out visitors cannot see the dashboard.
 *
 * The "static contract" test is the guardrail for the per-page opt-out: if
 * someone moves the providers back up into _app.tsx, it fails.
 */

/** Wait for the React app shell (present on every page). */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('static landing loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('static-landing')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('static contract: landing fires no auth request, opens no websocket', async ({ page }) => {
    const offenders: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/')) offenders.push(req.url())
    })
    // Only the DO room route counts — vite's own HMR socket is a dev artifact.
    page.on('websocket', (ws) => {
      if (new URL(ws.url()).pathname.startsWith('/ws/')) offenders.push(`ws: ${ws.url()}`)
    })
    await page.goto('/')
    await expect(page.getByTestId('static-landing')).toBeVisible()
    await page.waitForTimeout(1500)
    expect(offenders).toEqual([])
  })

  test('dynamic app boundary mounts on /home', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 15000 })
  })

  test('sign-in button visible when logged out', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByTestId('nav-sign-in-button')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('nav-user-name')).toHaveCount(0)
    await expect(page.getByTestId('decision-dashboard')).toHaveCount(0)
    await page.getByTestId('nav-sign-in-button').click()
    await expect(page.getByTestId('auth-overlay')).toBeVisible()
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await waitForApp(page)
    await expect(page.locator('text=404')).toBeVisible()
  })

  test('signed-in user completes a weighted decision', async ({ users }) => {
    const [user] = await users(1)
    const marker = `__test-${Date.now()}__`
    const roomTitle = `${marker} Vendor choice`

    await user.page.goto('/home')
    await expect(user.page.getByTestId('decision-dashboard')).toBeVisible({ timeout: 15_000 })

    // A previously interrupted run may leave its prefixed room behind. Remove
    // only test-owned rooms rather than wiping the shared local database.
    const staleRoomCards = user.page.getByTestId('decision-room-card').filter({ hasText: '__test-' })
    while ((await staleRoomCards.count()) > 0) {
      await staleRoomCards.first().click()
      await user.page.getByRole('button', { name: 'Delete room' }).click()
      await user.page.getByRole('button', { name: 'Confirm delete' }).click()
      await expect(user.page).toHaveURL(/\/home$/)
    }

    await user.page.getByLabel('Decision name').fill(roomTitle)
    await user.page.getByLabel('What are you deciding?').fill('Which vendor best balances quality and cost?')
    await user.page.getByRole('button', { name: 'Create room' }).click()
    await expect(user.page).toHaveURL(/\/decisions\/[^/]+$/)
    await expect(user.page.getByTestId('decision-room')).toContainText(roomTitle)
    await expect(user.page.getByTestId('ai-summary-empty')).toBeVisible()
    await expect(user.page.getByRole('button', { name: 'Generate explanation' })).toHaveCount(0)

    for (const option of ['Northstar', 'Bluebird']) {
      await user.page.getByLabel('Option title').fill(`${marker} ${option}`)
      await user.page.getByRole('button', { name: 'Add option' }).click()
      await expect(user.page.getByRole('heading', { name: `${marker} ${option}` })).toBeVisible()
    }

    await user.page.getByRole('button', { name: `Edit ${marker} Bluebird` }).click()
    await user.page.getByLabel('Option title').fill(`${marker} Bluebird revised`)
    await user.page.getByRole('button', { name: 'Save option' }).click()
    await expect(user.page.getByRole('heading', { name: `${marker} Bluebird revised` })).toBeVisible()

    await user.page.getByLabel('Option title').fill(`${marker} Temporary`)
    await user.page.getByRole('button', { name: 'Add option' }).click()
    await user.page.getByRole('button', { name: `Delete ${marker} Temporary` }).click()
    await expect(user.page.getByRole('heading', { name: `${marker} Temporary` })).toHaveCount(0)

    for (const criterion of ['Quality', 'Cost']) {
      await user.page.getByLabel('Criterion name').fill(criterion)
      await user.page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(user.page.getByRole('heading', { name: criterion })).toBeVisible()
    }

    const qualityWeight = user.page.getByRole('status', { name: 'Quality weight' })
    const costWeight = user.page.getByRole('status', { name: 'Cost weight' })
    await user.page.getByRole('button', { name: 'Increase Quality weight' }).click()
    await expect(qualityWeight).toHaveText('4')
    await user.page.getByRole('button', { name: 'Increase Quality weight' }).click()
    await expect(qualityWeight).toHaveText('5')
    await user.page.getByRole('button', { name: 'Decrease Cost weight' }).click()
    await expect(costWeight).toHaveText('2')
    await user.page.getByRole('button', { name: 'Decrease Cost weight' }).click()
    await expect(costWeight).toHaveText('1')

    await user.page.getByLabel(`${marker} Northstar score for Quality`).selectOption('5')
    await user.page.getByLabel(`${marker} Northstar score for Cost`).selectOption('1')
    await user.page.getByLabel(`${marker} Bluebird revised score for Quality`).selectOption('3')
    await user.page.getByLabel(`${marker} Bluebird revised score for Cost`).selectOption('5')

    const ranking = user.page.getByTestId('weighted-ranking')
    await expect(user.page.getByText('4/4 scored')).toBeVisible()
    await expect(ranking.locator('li').first()).toContainText(`${marker} Northstar`)
    await expect(ranking.locator('li').first()).toContainText('4.33')
    await expect(ranking.locator('li').nth(1)).toContainText('3.33')

    await user.page.getByRole('button', { name: 'Complete decision' }).click()
    await expect(user.page.getByRole('button', { name: 'Decision complete' })).toBeVisible()

    await user.page.getByRole('link', { name: 'Back to decisions' }).click()
    await expect(user.page.getByTestId('decision-room-card').filter({ hasText: roomTitle })).toBeVisible()
    await user.page.getByTestId('decision-room-card').filter({ hasText: roomTitle }).click()
    await expect(user.page.getByTestId('decision-room')).toContainText(roomTitle)

    await user.page.getByRole('button', { name: 'Delete room' }).click()
    await user.page.getByRole('button', { name: 'Confirm delete' }).click()
    await expect(user.page).toHaveURL(/\/home$/)
    await expect(user.page.getByText(roomTitle)).toHaveCount(0)
  })
})
