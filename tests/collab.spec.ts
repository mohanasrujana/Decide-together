/**
 * Multi-user collaboration spec — verifies two users sign in into
 * separate browser contexts and the app distinguishes them.
 *
 * `users(2)` takes any two accounts from your pool, so this spec passes on a
 * fresh app with no setup beyond having two test accounts:
 *   npx deepspace test accounts list
 *   npx deepspace test accounts create --email a@deepspace.test --name "A" --password-stdin
 *
 * Ask for accounts *by name* (`users(['Alice', 'Bob'])`) only when the
 * behaviour under test depends on which identity acts — otherwise naming them
 * couples the spec to one machine's pool.
 *
 * The `users` fixture handles sign-in caching (per-account storageState
 * persisted to `~/.deepspace/playwright-states/`), context creation, and
 * cleanup. No need to manage browser contexts manually.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

// A machine that has never created test accounts is the normal state of a
// fresh checkout, and there `users()` throws — turning "you have no pool yet"
// into three red tests about the app, which it is not. Skip the file instead
// and say what creates the pool. The count is of accounts usable HERE: the
// pool is global per developer, but passwords live only on the machine that
// created the account.
const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create them with ` +
    '`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" ' +
    '--password-stdin`, or fetch existing pool accounts with `npx deepspace test accounts recover --all`.',
)

test('each browser renders its own signed-in account', async ({ users }) => {
  const [a, b] = await users(2)

  // /home is dynamic (under src/pages/(app)/), so it mounts the nav shell;
  // '/' is the static landing and has no navigation.
  await Promise.all([a.page.goto('/home'), b.page.goto('/home')])

  // Email, not name. The page renders the *session's* `name || email`, while
  // `user.name` here comes from the LOCAL account registry — and the two are
  // not the same fact: a display name is optional, and an account recovered on
  // another machine has none stored locally at all. The email is the credential
  // the context signed in with, so it is the one identity both sides agree on,
  // and asserting it proves the page is showing THIS browser's account.
  // The two accounts are distinct, so two exact matches is also the proof that
  // the contexts are not sharing one session.
  for (const user of [a, b]) {
    await expect(user.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })

    // The identity chip shows `name || email`. Its text is not predictable, but
    // its presence is: something must be there once the profile has loaded.
    // (It is `hidden sm:inline` in some templates, so assert text, not
    // visibility.)
    await expect(user.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })

    await user.page.getByRole('button', { name: 'Account menu' }).click()
    await expect(user.page.getByTestId('nav-user-email')).toHaveText(user.email, {
      timeout: 15_000,
    })
  }
})

test('two users join, edit, score, discuss, and vote without refreshing', async ({ users }) => {
  const [a, b] = await users(2)
  const marker = `__test-${Date.now()}__`
  const roomTitle = `${marker} Launch decision`

  await a.page.goto('/home')
  await expect(a.page.getByTestId('decision-dashboard')).toBeVisible({ timeout: 15_000 })
  await a.page.getByLabel('Decision name').fill(roomTitle)
  await a.page.getByLabel('What are you deciding?').fill('Which launch plan should the team choose?')
  await a.page.getByRole('button', { name: 'Create room' }).click()
  await expect(a.page).toHaveURL(/\/decisions\/[^/]+$/)

  try {
    const inviteLink = await a.page.getByTestId('shareable-room-link').inputValue()
    await b.page.goto(inviteLink)
    const invitedRoomId = new URL(inviteLink).pathname.split('/').at(-1)
    expect(invitedRoomId).toBeTruthy()

    const tokenResponse = await b.context.request.get(new URL('/api/auth/token', inviteLink).toString(),)
    expect(tokenResponse.ok()).toBeTruthy()

    const tokenPayload = (await tokenResponse.json()) as { token: string }

    const unauthorizedResponse = await b.context.request.post(
      new URL('/api/actions/generateDecisionSummary', inviteLink).toString(),
      {
        headers: {
          Authorization: `Bearer ${tokenPayload.token}`,
        },
        data: {
          roomId: invitedRoomId,
        },
      },
    )

    expect(unauthorizedResponse.ok()).toBeTruthy()
    await expect(unauthorizedResponse.json()).resolves.toMatchObject({
      success: false,
      error: 'You do not have access to this room',
    })
    await expect(b.page.getByTestId('join-room-prompt')).toBeVisible({ timeout: 15_000 })
    await b.page.getByRole('button', { name: 'Join room' }).click()
    await expect(b.page.getByTestId('decision-room')).toContainText(roomTitle, { timeout: 15_000 })

    await expect(a.page.getByTestId('room-presence')).toContainText('2 online', { timeout: 15_000 })
    await expect(b.page.getByTestId('room-presence')).toContainText('2 online', { timeout: 15_000 })

    const optionA = `${marker} Northstar`
    const optionB = `${marker} Bluebird`
    await a.page.getByLabel('Option title').fill(optionA)
    await a.page.getByRole('button', { name: 'Add option' }).click()
    await expect(b.page.getByRole('heading', { name: optionA })).toBeVisible()
    await expect(b.page.getByRole('button', { name: `Edit ${optionA}` })).toHaveCount(0)

    await b.page.getByLabel('Option title').fill(optionB)
    await b.page.getByRole('button', { name: 'Add option' }).click()
    await expect(a.page.getByRole('heading', { name: optionB })).toBeVisible()
    await expect(a.page.getByRole('button', { name: `Edit ${optionB}` })).toHaveCount(0)

    await a.page.getByLabel('Criterion name').fill('Quality')
    await a.page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(b.page.getByRole('heading', { name: 'Quality' })).toBeVisible()
    await expect(b.page.getByRole('button', { name: 'Increase Quality weight' })).toHaveCount(0)

    await a.page.getByLabel(`${optionA} score for Quality`).selectOption('5')
    await expect(b.page.getByTestId('team-rating-count')).toHaveText('1 team rating received live')
    await b.page.getByLabel(`${optionA} score for Quality`).selectOption('3')
    await expect(a.page.getByTestId('team-rating-count')).toHaveText('2 team ratings received live')
    await expect(a.page.getByTestId('weighted-ranking')).toContainText('2 contributors')

    await a.page.getByLabel('Room message').fill(`${marker} I prefer the safer rollout.`)
    await a.page.getByRole('button', { name: 'Send message' }).click()
    await expect(b.page.getByText(`${marker} I prefer the safer rollout.`)).toBeVisible()
    await b.page.getByLabel('Room message').fill(`${marker} Agreed; the risk is lower.`)
    await b.page.getByRole('button', { name: 'Send message' }).click()
    await expect(a.page.getByText(`${marker} Agreed; the risk is lower.`)).toBeVisible()

    await a.page.getByRole('button', { name: `Vote for ${optionA}` }).click()
    await expect(b.page.getByTestId('vote-total')).toHaveText('1 total vote')
    await b.page.getByRole('button', { name: `Vote for ${optionB}` }).click()
    await expect(a.page.getByTestId('vote-total')).toHaveText('2 total votes')

    // Changing A's choice updates its unique room/user row instead of creating a second vote.
    await a.page.getByRole('button', { name: `Vote for ${optionB}` }).click()
    await expect(b.page.getByTestId('vote-total')).toHaveText('2 total votes')
    await expect(b.page.getByRole('button', { name: `Vote for ${optionB}` })).toContainText('2')
  } finally {
    if (await a.page.getByRole('button', { name: 'Delete room' }).isVisible().catch(() => false)) {
      await a.page.getByRole('button', { name: 'Delete room' }).click()
      await a.page.getByRole('button', { name: 'Confirm delete' }).click()
      await expect(a.page).toHaveURL(/\/home$/)
    }
  }
})

test('API status page renders loading success and error states', async ({ users }) => {
  const [user] = await users(1)
  let shouldFail = false
  let requestCount = 0

  await user.page.route('**/api/integrations', async (route) => {
    requestCount += 1
    if (shouldFail) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Catalog unavailable' }),
      })
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { integrations: { openai: {}, wikipedia: {} } } }),
    })
  })

  await user.page.goto('/api-status')
  await expect(user.page.getByText('Loading integration catalog...')).toBeVisible()
  await expect(user.page.getByText('Integration catalog ready')).toBeVisible()
  await expect(user.page.getByText('2 integrations available.')).toBeVisible()

  shouldFail = true
  await user.page.getByRole('button', { name: 'Refresh' }).click()
  await expect(user.page.getByText('Catalog unavailable')).toBeVisible()
  await expect(user.page.getByText('Showing the last loaded catalog')).toBeVisible()
  await expect(user.page.getByText('Integration catalog ready')).toBeVisible()

  const urlAfterFailure = user.page.url()
  const requestsAfterFailure = requestCount
  await user.page.getByRole('button', { name: 'Refresh' }).click()
  await expect.poll(() => requestCount).toBeGreaterThan(requestsAfterFailure)
  expect(user.page.url()).toBe(urlAfterFailure)
})

test('API status page shows local retry after first-load API failure', async ({ users }) => {
  const [user] = await users(1)
  let requestCount = 0

  await user.page.route('**/api/integrations', async (route) => {
    requestCount += 1
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Catalog unavailable' }),
    })
  })

  await user.page.goto('/api-status')
  await expect(user.page.getByText('Loading integration catalog...')).toBeVisible()
  await expect(user.page.getByText('Could not load API data')).toBeVisible()
  await expect(user.page.getByText('Retried 1 time automatically.')).toBeVisible()

  const retryButton = user.page.getByRole('button', { name: 'Retry' })
  await expect(retryButton).toBeVisible()

  const urlAfterFailure = user.page.url()
  const requestsAfterFailure = requestCount
  await retryButton.click()
  await expect.poll(() => requestCount).toBeGreaterThan(requestsAfterFailure)
  expect(user.page.url()).toBe(urlAfterFailure)
})
