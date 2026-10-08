import { test } from 'node:test'
import assert from 'node:assert/strict'

async function setup(t, responses) {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options })
    assert.ok(responses.length, `Unexpected request: ${path}`)
    const { status = 200, data } = responses.shift()
    return { ok: status < 400, status, json: async () => data }
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const auth = await import(`./auth.js?test=${encodeURIComponent(t.name)}`)
  return { auth, calls }
}

test('restoration shares a refresh request and uses Bearer access tokens', async (t) => {
  const { auth, calls } = await setup(t, [
    { data: { csrfToken: 'csrf' } },
    { data: { access: 'access-one' } },
    { data: { user: { username: 'tester' } } },
    { data: { user: { username: 'tester' } } },
  ])
  const users = await Promise.all([auth.restoreUser(), auth.restoreUser()])
  assert.equal(users[0].username, 'tester')
  assert.equal(users[1].username, 'tester')
  assert.equal(calls.filter((call) => call.path === '/api/auth/refresh/').length, 1)
  assert.equal(calls[1].options.headers['X-CSRFToken'], 'csrf')
  assert.equal(calls[2].options.headers.get('Authorization'), 'Bearer access-one')
})

test('expired access is refreshed and a protected request retried once', async (t) => {
  const { auth, calls } = await setup(t, [
    { data: { csrfToken: 'csrf' } },
    { data: { access: 'old' } },
    { status: 401, data: {} },
    { data: { csrfToken: 'csrf' } },
    { data: { access: 'new' } },
    { data: { user: { username: 'tester' } } },
  ])
  assert.equal((await auth.apiRequest('/api/auth/me/')).user.username, 'tester')
  assert.equal(calls[2].options.headers.get('Authorization'), 'Bearer old')
  assert.equal(calls[5].options.headers.get('Authorization'), 'Bearer new')
})

test('missing or expired refresh returns to the login page', async (t) => {
  const { auth } = await setup(t, [
    { data: { csrfToken: 'csrf' } },
    { status: 401, data: { message: 'Please sign in.' } },
  ])
  assert.equal(await auth.restoreUser(), null)
})

test('login and logout update the in-memory authentication state', async (t) => {
  const { auth, calls } = await setup(t, [
    { data: { csrfToken: 'csrf' } },
    { data: { access: 'access' } },
    { data: { user: { username: 'tester' } } },
    { data: { csrfToken: 'rotated-csrf' } },
    { data: { message: 'Signed out.' } },
    { data: { csrfToken: 'csrf' } },
    { status: 401, data: {} },
  ])
  assert.equal((await auth.signIn('tester', 'password')).username, 'tester')
  assert.deepEqual(JSON.parse(calls[1].options.body), { username: 'tester', password: 'password' })
  await auth.signOut()
  assert.equal(calls[4].path, '/api/auth/logout/')
  assert.equal(calls[4].options.headers['X-CSRFToken'], 'rotated-csrf')
  assert.equal(await auth.restoreUser(), null)
})
