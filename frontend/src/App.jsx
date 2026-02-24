import { useState, useEffect } from 'react'
import { useAuth } from './auth.jsx'
import Login from './components/Login.jsx'
import DublettenList from './components/DublettenList.jsx'
import DublettenDetail from './components/DublettenDetail.jsx'
import FuzzyList from './components/FuzzyList.jsx'
import FuzzyDetail from './components/FuzzyDetail.jsx'

function App() {
  const { user, loading, logout, fetchWithAuth, isAuthenticated } = useAuth()

  // Mode: 'exact' | 'fuzzy'
  const [mode, setMode] = useState('exact')

  // Exact duplicates state
  const [groups, setGroups] = useState([])
  const [stats, setStats] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [filterExact, setFilterExact] = useState('offen')

  // Fuzzy state
  const [fuzzyPairs, setFuzzyPairs] = useState([])
  const [fuzzyStats, setFuzzyStats] = useState(null)
  const [selectedPair, setSelectedPair] = useState(null)
  const [loadingFuzzy, setLoadingFuzzy] = useState(false)
  const [filterFuzzy, setFilterFuzzy] = useState('offen')
  const [threshold, setThreshold] = useState(0.6)
  const [fuzzyLoaded, setFuzzyLoaded] = useState(false)

  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (isAuthenticated) loadGroups()
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && mode === 'fuzzy' && !fuzzyLoaded) {
      loadFuzzy(threshold)
    }
  }, [mode, isAuthenticated])

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

  async function loadFuzzy(t) {
    setLoadingFuzzy(true)
    try {
      const resp = await fetchWithAuth(`/api/fuzzy?threshold=${t}`)
      if (resp.ok) {
        const data = await resp.json()
        setFuzzyPairs(data)
        const counts = { offen: 0, bearbeitet: 0, ignoriert: 0 }
        data.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++ })
        setFuzzyStats({ gesamt: data.length, ...counts })
        setFuzzyLoaded(true)
      }
    } finally {
      setLoadingFuzzy(false)
    }
  }

  function handleThresholdChange(newVal) {
    setThreshold(newVal)
    setFuzzyLoaded(false)
    setSelectedPair(null)
    loadFuzzy(newVal)
  }

  function handleExactDecisionSaved(name1, ort01, newStatus) {
    setGroups(prev => prev.map(g =>
      g.name1 === name1 && g.ort01 === ort01 ? { ...g, status: newStatus } : g
    ))
    setStats(prev => {
      if (!prev) return prev
      const old = groups.find(g => g.name1 === name1 && g.ort01 === ort01)
      return updateStatusCounts(prev, old?.status || 'offen', newStatus)
    })
    setSelectedGroup(prev =>
      prev?.name1 === name1 && prev?.ort01 === ort01 ? { ...prev, status: newStatus } : prev
    )
  }

  function handleFuzzyDecisionSaved(lifnr_a, lifnr_b, newStatus) {
    setFuzzyPairs(prev => prev.map(p =>
      p.lifnr_a === lifnr_a && p.lifnr_b === lifnr_b ? { ...p, status: newStatus } : p
    ))
    setFuzzyStats(prev => {
      if (!prev) return prev
      const old = fuzzyPairs.find(p => p.lifnr_a === lifnr_a && p.lifnr_b === lifnr_b)
      return updateStatusCounts(prev, old?.status || 'offen', newStatus)
    })
    setSelectedPair(prev =>
      prev?.lifnr_a === lifnr_a && prev?.lifnr_b === lifnr_b ? { ...prev, status: newStatus } : prev
    )
  }

  function updateStatusCounts(prev, oldStatus, newStatus) {
    if (oldStatus === newStatus) return prev
    const next = { ...prev }
    if (oldStatus in next) next[oldStatus] = Math.max(0, next[oldStatus] - 1)
    if (newStatus in next) next[newStatus] += 1
    return next
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
        <div className="loading-spinner" /> Laden...
      </div>
    )
  }

  if (!isAuthenticated) return <Login />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <h1>Stammdaten — Dubletten-Bereinigung</h1>
          <div className="mode-tabs">
            <button
              className={`mode-tab ${mode === 'exact' ? 'active' : ''}`}
              onClick={() => setMode('exact')}
            >
              Exakt
            </button>
            <button
              className={`mode-tab ${mode === 'fuzzy' ? 'active' : ''}`}
              onClick={() => setMode('fuzzy')}
            >
              Ähnlich
            </button>
          </div>
        </div>
        <div className="header-user">
          <span>{user?.username}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exportiere...' : 'CSV Export'}
          </button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="main-content">
        {mode === 'exact' ? (
          <>
            <DublettenList
              groups={groups}
              selected={selectedGroup}
              onSelect={setSelectedGroup}
              loading={loadingGroups}
              filter={filterExact}
              onFilterChange={setFilterExact}
              stats={stats}
            />
            <DublettenDetail
              group={selectedGroup}
              fetchWithAuth={fetchWithAuth}
              onDecisionSaved={handleExactDecisionSaved}
            />
          </>
        ) : (
          <>
            <FuzzyList
              pairs={fuzzyPairs}
              selected={selectedPair}
              onSelect={setSelectedPair}
              loading={loadingFuzzy}
              filter={filterFuzzy}
              onFilterChange={setFilterFuzzy}
              threshold={threshold}
              onThresholdChange={handleThresholdChange}
              stats={fuzzyStats}
            />
            <FuzzyDetail
              pair={selectedPair}
              fetchWithAuth={fetchWithAuth}
              onDecisionSaved={handleFuzzyDecisionSaved}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default App
