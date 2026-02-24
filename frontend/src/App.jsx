import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './auth.jsx'
import Login from './components/Login.jsx'
import DublettenList from './components/DublettenList.jsx'
import DublettenDetail from './components/DublettenDetail.jsx'

function App() {
  const { user, loading, logout, fetchWithAuth, isAuthenticated } = useAuth()
  const [groups, setGroups] = useState([])
  const [stats, setStats] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [filter, setFilter] = useState('offen')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      loadGroups()
    }
  }, [isAuthenticated])

  async function loadGroups() {
    setLoadingGroups(true)
    try {
      const [groupsResp, statsResp] = await Promise.all([
        fetchWithAuth('/api/duplicates'),
        fetchWithAuth('/api/stats'),
      ])
      if (groupsResp.ok) setGroups(await groupsResp.json())
      if (statsResp.ok) setStats(await statsResp.json())
    } finally {
      setLoadingGroups(false)
    }
  }

  function handleDecisionSaved(name1, ort01, newStatus) {
    setGroups(prev => prev.map(g =>
      g.name1 === name1 && g.ort01 === ort01
        ? { ...g, status: newStatus }
        : g
    ))
    setStats(prev => {
      if (!prev) return prev
      const oldGroup = groups.find(g => g.name1 === name1 && g.ort01 === ort01)
      const oldStatus = oldGroup?.status || 'offen'
      if (oldStatus === newStatus) return prev
      const next = { ...prev }
      if (oldStatus === 'offen') next.offen = Math.max(0, next.offen - 1)
      else if (oldStatus === 'bearbeitet') next.bearbeitet = Math.max(0, next.bearbeitet - 1)
      else if (oldStatus === 'ignoriert') next.ignoriert = Math.max(0, next.ignoriert - 1)
      if (newStatus === 'offen') next.offen += 1
      else if (newStatus === 'bearbeitet') next.bearbeitet += 1
      else if (newStatus === 'ignoriert') next.ignoriert += 1
      return next
    })
    // update selected group status
    setSelected(prev => prev && prev.name1 === name1 && prev.ort01 === ort01
      ? { ...prev, status: newStatus }
      : prev
    )
  }

  async function handleExport() {
    setExporting(true)
    try {
      const resp = await fetchWithAuth('/api/export')
      if (resp.ok) {
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'dubletten_entscheidungen.csv'
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="loading" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
        Laden...
      </div>
    )
  }

  if (!isAuthenticated) return <Login />

  return (
    <div className="app" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="header">
        <h1>Stammdaten — Dubletten-Bereinigung</h1>
        <div className="header-user">
          <span>{user?.username}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exportiere...' : 'CSV Export'}
          </button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="main-content">
        <DublettenList
          groups={groups}
          selected={selected}
          onSelect={setSelected}
          loading={loadingGroups}
          filter={filter}
          onFilterChange={setFilter}
          stats={stats}
        />

        <DublettenDetail
          group={selected}
          fetchWithAuth={fetchWithAuth}
          onDecisionSaved={handleDecisionSaved}
        />
      </main>
    </div>
  )
}

export default App
