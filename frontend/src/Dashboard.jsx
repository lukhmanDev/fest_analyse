import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from './auth'
import './Dashboard.css'

function Icon({ name, ...props }) {
  const paths = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-3.87',
    calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
    arrow: 'M5 12h14 M14 7l5 5-5 5',
    plus: 'M12 5v14 M5 12h14',
    check: 'm5 12 4 4L19 6',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.grid} /></svg>
}

const descriptions = {
  Admin: 'Manage festivals and control team access.',
  Staff: 'Create festivals and keep track of your workspace.',
  Viewer: 'Explore festival details with read-only access.',
}

export default function Dashboard({ onLogout, onSessionExpired }) {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('overview')
  const [team, setTeam] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [query, setQuery] = useState('')
  const [reload, setReload] = useState(0)

  const handleError = useCallback((err) => {
    if (err.status === 401) onSessionExpired()
    else setError(err instanceof TypeError ? 'Unable to connect. Please try again.' : err.message)
  }, [onSessionExpired])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      setTeam(null)
      try {
        const result = await apiRequest('/api/dashboard/')
        if (!active) return
        setData(result)
        if (tab === 'team' && result.user.permissions.manage_users) {
          const teamData = await apiRequest('/api/users/')
          if (active) setTeam(teamData.users)
        } else if (tab === 'team') {
          setTab('overview')
        }
      } catch (err) {
        if (active) handleError(err)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [tab, reload, handleError])

  async function createFestival(event) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = Object.fromEntries(new FormData(form))
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await apiRequest('/api/festivals/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
      })
      form.reset()
      setShowForm(false)
      setNotice('Festival created successfully.')
      setReload((value) => value + 1)
    } catch (err) { handleError(err) }
    finally { setSaving(false) }
  }

  async function changeRole(event, id) {
    event.preventDefault()
    const role = new FormData(event.currentTarget).get('role')
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest(`/api/users/${id}/role/`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
      })
      setTeam((users) => users.map((user) => user.id === id ? result.user : user))
      setNotice(`${result.user.username}'s role is now ${result.user.role}.`)
    } catch (err) { handleError(err) }
    finally { setSaving(false) }
  }

  async function logout() {
    setSaving(true)
    try { await onLogout() }
    catch (err) { handleError(err) }
    finally { setSaving(false) }
  }

  const user = data?.user
  const festivals = (data?.festivals || []).filter((festival) => `${festival.name} ${festival.location}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="brand" href="/dashboard"><span className="brand-mark">f.</span><span>Fest<span className="brand-light">Analyse</span></span></a>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Dashboard navigation">
          <button className={tab === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => { setTab('overview'); setNotice('') }} aria-current={tab === 'overview' ? 'page' : undefined}><Icon name="grid" />Overview</button>
          {user?.permissions.manage_users && <button className={tab === 'team' ? 'nav-item active' : 'nav-item'} onClick={() => { setTab('team'); setNotice('') }} aria-current={tab === 'team' ? 'page' : undefined}><Icon name="users" />Team &amp; roles</button>}
        </nav>
        <div className="sidebar-note"><span className="small-label">A LITTLE CLARITY</span><p>Every great festival starts with a clear plan.</p></div>
        <button className="nav-item logout" disabled={saving} onClick={logout}><Icon name="arrow" />{saving ? 'Please wait...' : 'Sign out'}</button>
      </aside>

      <div className="workspace-body">
        <header className="workspace-topbar"><span>Workspace <span className="breadcrumb-divider">/</span> <strong>{tab === 'team' ? 'Team & roles' : 'Overview'}</strong></span>{user && <div className="user-menu"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><div><strong>{user.username}</strong><span>{user.role}</span></div></div>}</header>
        <main className="dashboard-content">
          <div className="dashboard-heading"><div><span className="eyebrow">FEST ANALYSE</span><h1>{tab === 'team' ? 'Your team, connected.' : `Welcome back${user ? ', ' + user.username : ''}.`}</h1><p>{tab === 'team' ? 'Give each person the access they need.' : 'A clear view of your festivals, all in one place.'}</p></div><button className="secondary-button" disabled={loading || saving} onClick={() => setReload((value) => value + 1)}>Refresh</button></div>
          {error && <div className="error-message" role="alert">{error}</div>}
          {notice && <div className="success-message" role="status"><Icon name="check" />{notice}</div>}
          {loading ? <div className="dashboard-loading" role="status"><span className="spinner" />Loading your workspace...</div> : data && <>
            {tab === 'overview' ? <>
              <div className="stats-grid">{[['Total festivals', data.stats.total, 'All festivals in your workspace'], ['Upcoming', data.stats.upcoming, 'Today and the days ahead'], ['Past festivals', data.stats.past, 'Your completed calendar']].map(([title, value, detail]) => <article className="stat-card" key={title}><div><span>{title}</span><Icon name="calendar" /></div><strong>{value}</strong><p>{detail}</p></article>)}</div>
              <div className="access-banner"><span className="role-badge">{user.role}</span><div><strong>Your workspace access</strong><p>{descriptions[user.role]}</p></div></div>
              <section className="dashboard-panel">
                <div className="panel-heading"><div><h2>Festival overview</h2><p>Plan what comes next and revisit past events.</p></div>{user.permissions.create_festival && <button className="primary-button" onClick={() => setShowForm(!showForm)} aria-expanded={showForm}><Icon name="plus" />{showForm ? 'Close form' : 'New festival'}</button>}</div>
                {showForm && user.permissions.create_festival && <form className="festival-form" onSubmit={createFestival}><fieldset disabled={saving}><div><label htmlFor="festival-name">Festival name</label><input id="festival-name" name="name" placeholder="e.g. Spring Arts Festival" required maxLength={150} /></div><div><label htmlFor="festival-date">Date</label><input id="festival-date" name="date" type="date" required /></div><div><label htmlFor="festival-location">Location</label><input id="festival-location" name="location" placeholder="Venue or city" required maxLength={200} /></div><button className="primary-button" type="submit">{saving ? 'Saving...' : 'Create festival'}</button></fieldset></form>}
                <div className="table-toolbar"><label className="sr-only" htmlFor="festival-search">Search festivals</label><input id="festival-search" type="search" placeholder="Search festivals or locations..." value={query} onChange={(event) => setQuery(event.target.value)} /><span>{festivals.length} {festivals.length === 1 ? 'festival' : 'festivals'}</span></div>
                {festivals.length ? <div className="table-scroll"><table><thead><tr><th>Festival</th><th>Date</th><th>Location</th></tr></thead><tbody>{festivals.map((festival) => <tr key={festival.id}><td><span className="festival-name"><Icon name="calendar" />{festival.name}</span></td><td>{new Date(festival.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>{festival.location}</td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="empty-icon"><Icon name="calendar" /></span><h3>{query ? 'No matching festivals' : 'Your next great moment starts here'}</h3><p>{query ? 'Try a different name or location.' : user.permissions.create_festival ? 'Add your first festival to start building your calendar.' : 'Festivals will appear here when your team adds them.'}</p>{!query && user.permissions.create_festival && !showForm && <button className="secondary-button" onClick={() => setShowForm(true)}>Create your first festival</button>}</div>}
              </section>
            </> : user.permissions.manage_users && <section className="dashboard-panel"><div className="panel-heading"><div><h2>Team members</h2><p>Admins manage access. Staff create festivals. Viewers can read.</p></div><span className="role-badge">Admin only</span></div><p className="team-help">Create accounts in Django admin. Your own role and superuser roles are protected.</p>{team && <div className="table-scroll"><table><thead><tr><th>Member</th><th>Current role</th><th>Change access</th></tr></thead><tbody>{team.map((member) => <tr key={member.id}><td><strong>{member.username}</strong>{member.id === user.id && <span className="you-label">You</span>}</td><td><span className="role-badge">{member.role}</span></td><td>{member.is_superuser || member.id === user.id ? <span className="protected-label">Protected account</span> : <form className="role-form" onSubmit={(event) => changeRole(event, member.id)}><select key={member.role} name="role" defaultValue={member.role} aria-label={`Role for ${member.username}`} disabled={saving}>{['Admin', 'Staff', 'Viewer'].map((role) => <option key={role}>{role}</option>)}</select><button className="secondary-button" disabled={saving} type="submit">Save</button></form>}</td></tr>)}</tbody></table></div>}</section>}
          </>}
          <footer className="dashboard-footer">Fest Analyse <span>Your festival. A clearer picture.</span></footer>
        </main>
      </div>
    </div>
  )
}
