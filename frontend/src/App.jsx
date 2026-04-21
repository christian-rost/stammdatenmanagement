import { useState, useEffect } from 'react'
import { useAuth } from './auth.jsx'
import Login from './components/Login.jsx'
import DublettenList from './components/DublettenList.jsx'
import DublettenDetail from './components/DublettenDetail.jsx'
import FuzzyList from './components/FuzzyList.jsx'
import FuzzyDetail from './components/FuzzyDetail.jsx'
import ImportModal from './components/ImportModal.jsx'
import SearchView from './components/SearchView.jsx'
import RegelView from './components/RegelView.jsx'
import MaterialList from './components/MaterialList.jsx'
import MaterialDetail from './components/MaterialDetail.jsx'
import MaterialFuzzyList from './components/MaterialFuzzyList.jsx'
import MaterialFuzzyDetail from './components/MaterialFuzzyDetail.jsx'
import MaterialSearchView from './components/MaterialSearchView.jsx'
import MaterialImportModal from './components/MaterialImportModal.jsx'

function App() {
  const { user, loading, logout, fetchWithAuth, isAuthenticated } = useAuth()

  // Bereich: 'lieferanten' | 'materialien'
  const [domain, setDomain] = useState('lieferanten')

  // Lieferanten-Tabs
  const [mode, setMode] = useState('exact')

  // Lieferanten – exakt
  const [groups, setGroups] = useState([])
  const [stats, setStats] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [filterExact, setFilterExact] = useState('offen')

  // Lieferanten – fuzzy
  const [fuzzyPairs, setFuzzyPairs] = useState([])
  const [fuzzyStats, setFuzzyStats] = useState(null)
  const [selectedPair, setSelectedPair] = useState(null)
  const [loadingFuzzy, setLoadingFuzzy] = useState(false)
  const [filterFuzzy, setFilterFuzzy] = useState('offen')
  const [threshold, setThreshold] = useState(0.75)
  const [fuzzyLoaded, setFuzzyLoaded] = useState(false)

  const [exporting, setExporting] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // Materialien-Tabs
  const [matMode, setMatMode] = useState('exact')

  // Materialien – exakt
  const [matGroups, setMatGroups] = useState([])
  const [matStats, setMatStats] = useState(null)
  const [matSelectedGroup, setMatSelectedGroup] = useState(null)
  const [loadingMatGroups, setLoadingMatGroups] = useState(false)
  const [filterMatExact, setFilterMatExact] = useState('offen')

  // Materialien – fuzzy
  const [matFuzzyPairs, setMatFuzzyPairs] = useState([])
  const [matFuzzyStats, setMatFuzzyStats] = useState(null)
  const [matSelectedPair, setMatSelectedPair] = useState(null)
  const [loadingMatFuzzy, setLoadingMatFuzzy] = useState(false)
  const [filterMatFuzzy, setFilterMatFuzzy] = useState('offen')
  const [matThreshold, setMatThreshold] = useState(0.75)
  const [matFuzzyLoaded, setMatFuzzyLoaded] = useState(false)

  const [matFuzzyError, setMatFuzzyError] = useState('')
  const [matExporting, setMatExporting] = useState(false)
  const [showMatImport, setShowMatImport] = useState(false)

  useEffect(() => {
    if (isAuthenticated) loadGroups()
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && mode === 'fuzzy' && !fuzzyLoaded) {
      loadFuzzy(threshold)
    }
  }, [mode, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && domain === 'materialien' && matMode === 'exact' && matGroups.length === 0 && !loadingMatGroups) {
      loadMatGroups()
    }
  }, [domain, matMode, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && domain === 'materialien' && matMode === 'fuzzy' && !matFuzzyLoaded) {
      loadMatFuzzy(matThreshold)
    }
  }, [matMode, domain, isAuthenticated])

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

  async function loadMatGroups() {
    setLoadingMatGroups(true)
    try {
      const [groupsResp, statsResp] = await Promise.all([
        fetchWithAuth('/api/materials/duplicates'),
        fetchWithAuth('/api/materials/stats'),
      ])
      if (groupsResp.ok) setMatGroups(await groupsResp.json())
      if (statsResp.ok) setMatStats(await statsResp.json())
    } finally {
      setLoadingMatGroups(false)
    }
  }

  async function loadMatFuzzy(t) {
    setLoadingMatFuzzy(true)
    setMatFuzzyError('')
    try {
      const resp = await fetchWithAuth(`/api/materials/fuzzy?threshold=${t}`)
      if (resp.ok) {
        const data = await resp.json()
        setMatFuzzyPairs(data)
        const counts = { offen: 0, bearbeitet: 0, ignoriert: 0 }
        data.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++ })
        setMatFuzzyStats({ gesamt: data.length, ...counts })
        setMatFuzzyLoaded(true)
      } else {
        const err = await resp.json().catch(() => ({}))
        setMatFuzzyError(err.detail || `Fehler ${resp.status}`)
      }
    } catch (e) {
      setMatFuzzyError(String(e))
    } finally {
      setLoadingMatFuzzy(false)
    }
  }

  function handleThresholdChange(newVal) {
    setThreshold(newVal)
    setFuzzyLoaded(false)
    setSelectedPair(null)
    loadFuzzy(newVal)
  }

  function handleMatThresholdChange(newVal) {
    setMatThreshold(newVal)
    setMatFuzzyLoaded(false)
    setMatSelectedPair(null)
    loadMatFuzzy(newVal)
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

  function handleMatExactDecisionSaved(maktg, newStatus) {
    setMatGroups(prev => prev.map(g =>
      g.maktg === maktg ? { ...g, status: newStatus } : g
    ))
    setMatStats(prev => {
      if (!prev) return prev
      const old = matGroups.find(g => g.maktg === maktg)
      return updateStatusCounts(prev, old?.status || 'offen', newStatus)
    })
    setMatSelectedGroup(prev =>
      prev?.maktg === maktg ? { ...prev, status: newStatus } : prev
    )
  }

  function handleMatFuzzyDecisionSaved(matnr_a, matnr_b, newStatus) {
    setMatFuzzyPairs(prev => prev.map(p =>
      p.matnr_a === matnr_a && p.matnr_b === matnr_b ? { ...p, status: newStatus } : p
    ))
    setMatFuzzyStats(prev => {
      if (!prev) return prev
      const old = matFuzzyPairs.find(p => p.matnr_a === matnr_a && p.matnr_b === matnr_b)
      return updateStatusCounts(prev, old?.status || 'offen', newStatus)
    })
    setMatSelectedPair(prev =>
      prev?.matnr_a === matnr_a && prev?.matnr_b === matnr_b ? { ...prev, status: newStatus } : prev
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

  async function handleMatExport() {
    setMatExporting(true)
    try {
      const resp = await fetchWithAuth('/api/materials/export')
      if (resp.ok) {
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'material_entscheidungen.csv'
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setMatExporting(false)
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

  const isMatDomain = domain === 'materialien'
  const currentMode = isMatDomain ? matMode : mode

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <h1>Stammdaten — Dubletten-Bereinigung</h1>

          {/* Bereich-Umschalter */}
          <div className="mode-tabs" style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6 }}>
            <button
              className={`mode-tab ${!isMatDomain ? 'active' : ''}`}
              onClick={() => setDomain('lieferanten')}
            >
              Lieferanten
            </button>
            <button
              className={`mode-tab ${isMatDomain ? 'active' : ''}`}
              onClick={() => setDomain('materialien')}
            >
              Materialien
            </button>
          </div>

          {/* Sub-Tabs */}
          <div className="mode-tabs">
            {!isMatDomain ? (
              <>
                <button className={`mode-tab ${mode === 'exact' ? 'active' : ''}`} onClick={() => setMode('exact')}>Exakt</button>
                <button className={`mode-tab ${mode === 'fuzzy' ? 'active' : ''}`} onClick={() => setMode('fuzzy')}>Ähnlich</button>
                <button className={`mode-tab ${mode === 'search' ? 'active' : ''}`} onClick={() => setMode('search')}>Suche</button>
                <button className={`mode-tab ${mode === 'regeln' ? 'active' : ''}`} onClick={() => setMode('regeln')}>Regeln</button>
              </>
            ) : (
              <>
                <button className={`mode-tab ${matMode === 'exact' ? 'active' : ''}`} onClick={() => setMatMode('exact')}>Exakt</button>
                <button className="mode-tab" disabled title="Ähnlichkeitssuche derzeit nicht verfügbar">Ähnlich</button>
                <button className={`mode-tab ${matMode === 'search' ? 'active' : ''}`} onClick={() => setMatMode('search')}>Suche</button>
              </>
            )}
          </div>
        </div>

        <div className="header-user">
          <span>{user?.username}</span>
          {user?.is_admin && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => isMatDomain ? setShowMatImport(true) : setShowImport(true)}
            >
              Daten importieren
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={isMatDomain ? handleMatExport : handleExport}
            disabled={isMatDomain ? matExporting : exporting}
          >
            {(isMatDomain ? matExporting : exporting) ? 'Exportiere...' : 'CSV Export'}
          </button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="main-content" style={
        (!isMatDomain && (mode === 'search' || mode === 'regeln')) ||
        (isMatDomain && matMode === 'search')
          ? { padding: 0 }
          : undefined
      }>
        {isMatDomain ? (
          matMode === 'search' ? (
            <MaterialSearchView
              fetchWithAuth={fetchWithAuth}
              onGoToDuplicate={group => {
                const found = matGroups.find(g => g.maktg === group.maktg)
                setMatSelectedGroup(found || { ...group, anzahl: 0, matnr_liste: [], status: 'offen' })
                setMatMode('exact')
              }}
            />
          ) : matMode === 'exact' ? (
            <>
              <MaterialList
                groups={matGroups}
                selected={matSelectedGroup}
                onSelect={setMatSelectedGroup}
                loading={loadingMatGroups}
                filter={filterMatExact}
                onFilterChange={setFilterMatExact}
                stats={matStats}
              />
              <MaterialDetail
                group={matSelectedGroup}
                fetchWithAuth={fetchWithAuth}
                onDecisionSaved={handleMatExactDecisionSaved}
              />
            </>
          ) : (
            <>
              <MaterialFuzzyList
                pairs={matFuzzyPairs}
                selected={matSelectedPair}
                onSelect={setMatSelectedPair}
                loading={loadingMatFuzzy}
                filter={filterMatFuzzy}
                onFilterChange={setFilterMatFuzzy}
                threshold={matThreshold}
                onThresholdChange={handleMatThresholdChange}
                stats={matFuzzyStats}
                error={matFuzzyError}
              />
              <MaterialFuzzyDetail
                pair={matSelectedPair}
                fetchWithAuth={fetchWithAuth}
                onDecisionSaved={handleMatFuzzyDecisionSaved}
              />
            </>
          )
        ) : mode === 'regeln' ? (
          <RegelView
            fetchWithAuth={fetchWithAuth}
            onGoToDuplicate={group => {
              setSelectedGroup(groups.find(g => g.name1 === group.name1 && g.ort01 === group.ort01) || { ...group, anzahl: 0, lifnr_liste: [], status: 'offen' })
              setMode('exact')
            }}
          />
        ) : mode === 'search' ? (
          <SearchView
            fetchWithAuth={fetchWithAuth}
            onGoToDuplicate={group => {
              setSelectedGroup(groups.find(g => g.name1 === group.name1 && g.ort01 === group.ort01) || { ...group, anzahl: 0, lifnr_liste: [], status: 'offen' })
              setMode('exact')
            }}
          />
        ) : mode === 'exact' ? (
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

      {showImport && (
        <ImportModal
          fetchWithAuth={fetchWithAuth}
          onClose={() => setShowImport(false)}
          onImportDone={loadGroups}
        />
      )}

      {showMatImport && (
        <MaterialImportModal
          fetchWithAuth={fetchWithAuth}
          onClose={() => setShowMatImport(false)}
          onImportDone={loadMatGroups}
        />
      )}
    </div>
  )
}

export default App
