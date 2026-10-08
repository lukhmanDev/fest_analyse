import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState({ state: 'loading', message: 'Connecting to Django...' })

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health/', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('API request failed')
        return response.json()
      })
      .then((data) => setStatus({ state: 'connected', message: data.message }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setStatus({ state: 'error', message: 'Cannot reach Django. Start the backend on port 8000, then refresh.' })
        }
      })
    return () => controller.abort()
  }, [])

  return (
    <main>
      <p className="eyebrow">FEST ANALYSE</p>
      <h1>Your project starts here.</h1>
      <p className="intro">React frontend. Django backend. Ready to build.</p>
      <section className={'status ' + status.state} role="status" aria-live="polite">
        <span className="dot" aria-hidden="true" />
        {status.message}
      </section>
      <div className="cards">
        <article><h2>Frontend</h2><p>React + Vite</p><code>frontend/src/App.jsx</code></article>
        <article><h2>Backend</h2><p>Django + SQLite</p><code>backend/api/views.py</code></article>
      </div>
    </main>
  )
}

export default App
