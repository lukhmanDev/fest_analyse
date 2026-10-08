let accessToken = null
let refreshPromise = null

async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || data.detail || 'Unable to complete the request. Please try again.')
    error.status = response.status
    throw error
  }
  return data
}

async function post(action, body = {}) {
  const { csrfToken } = await request('/api/auth/csrf/')
  return request(`/api/auth/${action}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify(body),
  })
}

function refreshAccess() {
  if (!refreshPromise) {
    refreshPromise = post('refresh')
      .then((data) => { accessToken = data.access })
      .catch((error) => { accessToken = null; throw error })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

// Use this helper for protected API calls. Tokens are never stored in localStorage.
export async function apiRequest(path, options = {}) {
  if (!path.startsWith('/api/')) throw new Error('API requests must use a local /api/ path.')
  if (!accessToken) await refreshAccess()
  const send = () => {
    const headers = new Headers(options.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)
    return request(path, { ...options, headers })
  }
  try {
    return await send()
  } catch (error) {
    if (error.status !== 401) throw error
    await refreshAccess()
    return send()
  }
}

export async function restoreUser() {
  try {
    return (await apiRequest('/api/auth/me/')).user
  } catch (error) {
    if (error.status === 401) return null
    throw error
  }
}

export async function signIn(username, password) {
  if (refreshPromise) await refreshPromise.catch(() => {})
  const data = await post('login', { username, password })
  accessToken = data.access
  return (await apiRequest('/api/auth/me/')).user
}

export async function signOut() {
  if (refreshPromise) await refreshPromise.catch(() => {})
  await post('logout')
  accessToken = null
}
