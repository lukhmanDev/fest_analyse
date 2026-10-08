import { useCallback, useEffect, useState } from 'react'
import Dashboard from './Dashboard'
import { restoreUser, signIn, signOut } from './auth'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(false)
  const [year] = useState(() => new Date().getFullYear())

  const sessionExpired = useCallback(() => {
    setUser(null)
    setError('Your login has expired. Please sign in again.')
  }, [])

  useEffect(() => {
    if (ready) window.history.replaceState(null, '', user ? '/dashboard' : '/login')
  }, [ready, user])

  async function logout() {
    await signOut()
    setUser(null)
    setError('')
  }

  useEffect(() => {
    let active = true
    restoreUser()
      .then((restoredUser) => { if (active) { setUser(restoredUser); setReady(true) } })
      .catch(() => {
        if (active) {
          setError('Unable to connect. Check that the backend is running, then try signing in.')
          setReady(true)
        }
      })
    return () => { active = false }
  }, [])

  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    setBusy(true)
    setError('')
    try {
      if (user) {
        await signOut()
        setUser(null)
      } else {
        setUser(await signIn(fields.get('username'), fields.get('password')))
      }
      form.reset()
      setVisible(false)
    } catch (err) {
      setError(err instanceof TypeError ? 'Unable to connect. Check that the backend is running and try again.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  if (ready && user) return <Dashboard onLogout={logout} onSessionExpired={sessionExpired} />

  return (
    <div className="page">
      <header className="page-header">
        <a className="brand" href="/" aria-label="Fest Analyse home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 17V9m7 8V5m7 12v-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          </span>
          <span>Fest<span className="brand-light">Analyse</span></span>
        </a>
        <span className="header-note">Your festival. A clearer picture.</span>
      </header>

      <main className="login-main">
        <div className="login-intro">
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>{user ? 'Good to have you here.' : 'Welcome back.'}</h1>
          <p>{user ? 'Everything starts with a little clarity.' : 'Sign in and pick up where you left off.'}</p>
        </div>

        <section className="login-card" aria-labelledby="form-title">
          <div className={'card-icon' + (user ? ' success-icon' : '')} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {user ? <path d="m6 12 4 4 8-8" /> : <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>}
            </svg>
          </div>
          <h2 id="form-title">{user ? 'You are signed in' : 'Sign in to your account'}</h2>
          <p className="card-description">{user ? 'Welcome, ' + user.username + '.' : 'Enter your details to access Fest Analyse.'}</p>

          <form onSubmit={submit} aria-busy={busy || !ready}>
            {!user && <fieldset disabled={busy || !ready}>
              <div className="field-group">
                <label htmlFor="username">Username</label>
                <input id="username" name="username" autoComplete="username" placeholder="Enter your username" required maxLength={150} spellCheck="false" autoCapitalize="none" />
              </div>
              <div className="field-group">
                <label htmlFor="password">Password</label>
                <div className="password-field">
                  <input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required maxLength={4096} />
                  <button className="visibility-toggle" type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                      {visible && <path d="m3 3 18 18" />}
                    </svg>
                  </button>
                </div>
              </div>
            </fieldset>}
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="submit-button" type="submit" disabled={busy || !ready}>
              <span>{!ready ? 'Connecting...' : busy ? (user ? 'Signing out...' : 'Signing in...') : user ? 'Sign out' : 'Sign in'}</span>
              {busy || !ready ? <span className="spinner" aria-hidden="true" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>}
            </button>
          </form>

          {!user && <div className="account-note"><span>Need help accessing your account?</span><p>Contact your workspace administrator.</p></div>}
          {user && <p className="signed-in-note" role="status"><span /> Your account is connected.</p>}
        </section>
        <p className="below-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 3 7 3v6c0 4-7 9-7 9s-7-5-7-9V6l7-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>A little clarity goes a long way.</p>
      </main>

      <footer className="page-footer"><span>&copy; {year} Fest Analyse</span><span>Made for the moments that matter.</span></footer>
    </div>
  )
}

export default App
