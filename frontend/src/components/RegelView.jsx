import { useState, useEffect, useCallback } from 'react'

const DISPLAY_COLUMNS = [
  { key: 'lifnr',  label: 'LIFNR' },
  { key: 'name1',  label: 'Name 1' },
  { key: 'name2',  label: 'Name 2' },
  { key: 'ort01',  label: 'Ort' },
  { key: 'stras',  label: 'Straße' },
  { key: 'pstlz',  label: 'PLZ' },
  { key: 'land1',  label: 'Land' },
  { key: 'stceg',  label: 'USt-IdNr' },
  { key: 'telf1',  label: 'Telefon' },
  { key: 'loevm',  label: 'Löschvm.' },
]

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return iso }
}

function AktionBadge({ aktion }) {
  const isIgn = aktion === 'ignorieren'
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.15rem 0.5rem',
      borderRadius: 4,
      fontSize: '0.75rem',
      fontWeight: 600,
      background: isIgn ? 'rgba(33,52,82,0.1)' : 'rgba(238,127,0,0.12)',
      color: isIgn ? 'var(--color-navy)' : 'var(--color-primary)',
    }}>
      {isIgn ? 'Ignorieren' : 'Prüfen'}
    </span>
  )
}

function RegelView({ fetchWithAuth, onGoToDuplicate }) {
  const [activeTab, setActiveTab] = useState('neu')

  // --- "Neue Regel" Tab state ---
  const [regel, setRegel]           = useState('')
  const [sql, setSql]               = useState('')
  const [erklaerung, setErklaerung] = useState('')
  const [aktion, setAktion]         = useState('ignorieren')
  const [aktionErkl, setAktionErkl] = useState('')

  const [running, setRunning]       = useState(false)
  const [runPhase, setRunPhase]     = useState('') // 'generating' | 'executing'
  const [genError, setGenError]     = useState('')
  const [execError, setExecError]   = useState('')

  const [showSql, setShowSql]       = useState(false)
  const [sqlEdited, setSqlEdited]   = useState(false)

  const [rows, setRows]             = useState(null)
  const [groupsTotal, setGroupsTotal] = useState(0)
  const [groupsOffen, setGroupsOffen] = useState(0)

  const [applying, setApplying]     = useState(false)
  const [applyMsg, setApplyMsg]     = useState('')

  const [selected, setSelected]     = useState(null)
  const [duplicates, setDuplicates] = useState(null)
  const [loadingDups, setLoadingDups] = useState(false)

  // Save-rule inline form
  const [showSaveForm, setShowSaveForm]   = useState(false)
  const [saveName, setSaveName]           = useState('')
  const [saving, setSaving]               = useState(false)
  const [saveMsg, setSaveMsg]             = useState('')

  // Currently loaded saved rule
  const [loadedRuleId, setLoadedRuleId]   = useState(null)

  // --- "Gespeicherte Regeln" Tab state ---
  const [savedRules, setSavedRules]       = useState([])
  const [loadingRules, setLoadingRules]   = useState(false)
  const [rulesError, setRulesError]       = useState('')
  const [deletingId, setDeletingId]       = useState(null)

  useEffect(() => {
    if (activeTab === 'saved') loadSavedRules()
  }, [activeTab])

  const loadSavedRules = useCallback(async () => {
    setLoadingRules(true)
    setRulesError('')
    try {
      const resp = await fetchWithAuth('/api/rules/saved')
      if (!resp.ok) { setRulesError('Fehler beim Laden'); return }
      setSavedRules(await resp.json())
    } catch { setRulesError('Verbindungsfehler') }
    finally { setLoadingRules(false) }
  }, [fetchWithAuth])

  useEffect(() => {
    if (!selected) { setDuplicates(null); return }
    setLoadingDups(true)
    setDuplicates(null)
    const params = new URLSearchParams({ name1: selected.name1 || '', ort01: selected.ort01 || '' })
    fetchWithAuth(`/api/duplicates/records?${params}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setDuplicates(data))
      .catch(() => setDuplicates([]))
      .finally(() => setLoadingDups(false))
  }, [selected?.lifnr])

  // Core execute function — runs given SQL and updates results
  async function executeSQL(sqlToRun, ruleId) {
    setRunPhase('executing')
    try {
      const resp = await fetchWithAuth('/api/rules/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlToRun }),
      })
      if (!resp.ok) {
        const d = await resp.json()
        setExecError(d.detail || 'SQL-Fehler')
        setShowSql(true) // Auto-aufklappen bei Fehler
        return false
      }
      const d = await resp.json()
      setRows(d.rows)
      setGroupsTotal(d.groups_total ?? 0)
      setGroupsOffen(d.groups_offen ?? 0)

      if (ruleId) {
        fetchWithAuth(`/api/rules/saved/${ruleId}/stats`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            letzte_ausfuehrung: new Date().toISOString(),
            letztes_ergebnis_anzahl: d.groups_total ?? 0,
            letztes_ergebnis_offen: d.groups_offen ?? 0,
          }),
        }).catch(() => {})
      }
      return true
    } catch {
      setExecError('Verbindungsfehler')
      setShowSql(true)
      return false
    }
  }

  // Haupt-Handler: generiert SQL falls nötig, führt dann aus
  async function handleRunRule() {
    setGenError('')
    setExecError('')
    setRows(null)
    setSelected(null)
    setApplyMsg('')
    setShowSaveForm(false)
    setSaveMsg('')
    setRunning(true)

    let currentSql = sql.trim()

    // SQL generieren wenn noch keines vorhanden oder manuell editiert
    if (!currentSql || sqlEdited) {
      setRunPhase('generating')
      try {
        const resp = await fetchWithAuth('/api/rules/generate-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regel }),
        })
        if (!resp.ok) {
          const d = await resp.json()
          setGenError(d.detail || 'Fehler beim Generieren')
          setRunning(false)
          setRunPhase('')
          return
        }
        const d = await resp.json()
        currentSql = d.sql
        setSql(d.sql)
        setErklaerung(d.erklaerung)
        setAktion(d.aktion)
        setAktionErkl(d.aktion_erklaerung)
        setSqlEdited(false)
      } catch {
        setGenError('Verbindungsfehler')
        setRunning(false)
        setRunPhase('')
        return
      }
    }

    await executeSQL(currentSql, loadedRuleId)
    setRunning(false)
    setRunPhase('')
  }

  // Handler für "SQL neu ausführen" nach manueller Bearbeitung
  async function handleRerunSql() {
    setExecError('')
    setRows(null)
    setSelected(null)
    setApplyMsg('')
    setRunning(true)
    await executeSQL(sql, loadedRuleId)
    setSqlEdited(false)
    setRunning(false)
    setRunPhase('')
  }

  function getGroups() {
    if (!rows) return []
    const seen = new Set()
    const groups = []
    for (const r of rows) {
      const key = `${r.name1}||${r.ort01 ?? ''}`
      if (!seen.has(key)) {
        seen.add(key)
        groups.push({ name1: r.name1, ort01: r.ort01 ?? '' })
      }
    }
    return groups
  }

  async function handleApply() {
    const groups = getGroups()
    if (!groups.length) return
    setApplyMsg('')
    setApplying(true)
    try {
      const resp = await fetchWithAuth('/api/rules/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups, status: aktion === 'ignorieren' ? 'ignoriert' : 'bearbeitet' }),
      })
      if (!resp.ok) {
        const d = await resp.json()
        setApplyMsg(`Fehler: ${d.detail}`)
        return
      }
      const d = await resp.json()
      setApplyMsg(`${d.applied} Gruppen wurden als „${aktion === 'ignorieren' ? 'ignoriert' : 'bearbeitet'}" markiert.`)
    } catch {
      setApplyMsg('Verbindungsfehler beim Anwenden')
    } finally {
      setApplying(false)
    }
  }

  async function handleSaveRule() {
    if (!saveName.trim()) return
    setSaving(true)
    setSaveMsg('')
    try {
      const resp = await fetchWithAuth('/api/rules/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          regel,
          sql_text: sql,
          erklaerung,
          aktion,
          aktion_erklaerung: aktionErkl,
        }),
      })
      if (!resp.ok) {
        const d = await resp.json()
        setSaveMsg(`Fehler: ${d.detail}`)
        return
      }
      const saved = await resp.json()
      setLoadedRuleId(saved.id)
      setSaveMsg('Regel gespeichert.')
      setShowSaveForm(false)
    } catch {
      setSaveMsg('Verbindungsfehler')
    } finally {
      setSaving(false)
    }
  }

  async function handleLoadRule(rule) {
    // Zustand zurücksetzen und Regel laden
    setRegel(rule.regel)
    setSql(rule.sql_text)
    setErklaerung(rule.erklaerung || '')
    setAktion(rule.aktion || 'ignorieren')
    setAktionErkl(rule.aktion_erklaerung || '')
    setRows(null)
    setSelected(null)
    setApplyMsg('')
    setGenError('')
    setExecError('')
    setSaveMsg('')
    setShowSaveForm(false)
    setShowSql(false)
    setSqlEdited(false)
    setLoadedRuleId(rule.id)
    setActiveTab('neu')

    // Direkt ausführen mit dem gespeicherten SQL (kein LLM nötig)
    setRunning(true)
    await executeSQL(rule.sql_text, rule.id)
    setRunning(false)
    setRunPhase('')
  }

  async function handleDeleteRule(id) {
    setDeletingId(id)
    try {
      await fetchWithAuth(`/api/rules/saved/${id}`, { method: 'DELETE' })
      setSavedRules(prev => prev.filter(r => r.id !== id))
    } catch { /* silent */ }
    finally { setDeletingId(null) }
  }

  function handleReset() {
    setSql(''); setErklaerung(''); setAktion('ignorieren'); setAktionErkl('')
    setRows(null); setSelected(null); setGenError(''); setExecError(''); setApplyMsg('')
    setShowSaveForm(false); setSaveMsg(''); setLoadedRuleId(null)
    setShowSql(false); setSqlEdited(false)
  }

  const groups        = getGroups()
  const hasSql        = sql.trim().length > 0
  const hasDuplicates = duplicates && duplicates.length > 1

  const runLabel = runPhase === 'generating' ? 'Generiere SQL…'
    : runPhase === 'executing' ? 'Führe aus…'
    : 'Regel ausführen'

  const resultCols = rows && rows.length > 0
    ? DISPLAY_COLUMNS.filter(c => rows.some(r => r[c.key] !== undefined && r[c.key] !== null && r[c.key] !== ''))
    : DISPLAY_COLUMNS

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Header + Tab-Toggle */}
      <div style={{ padding: '1.5rem 1.5rem 0' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '1rem' }}>
          Regel-Assistent
        </h2>

        <div style={{ display: 'flex', gap: 0, marginBottom: '1.25rem', borderBottom: '2px solid var(--color-border)' }}>
          {[
            { key: 'neu', label: 'Neue Regel' },
            { key: 'saved', label: `Gespeicherte Regeln${savedRules.length > 0 ? ` (${savedRules.length})` : ''}` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '0.5rem 1.1rem',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: -2,
                background: 'none',
                cursor: 'pointer',
                fontWeight: activeTab === tab.key ? 700 : 400,
                color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-light)',
                fontSize: '0.9rem',
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===================== TAB: NEUE REGEL ===================== */}
      {activeTab === 'neu' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '0 1.5rem' }}>

            {/* Regel-Eingabe */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                Regel in Klartext beschreiben:
              </label>
              <textarea
                className="search-input"
                style={{ width: '100%', minHeight: 72, resize: 'vertical', fontFamily: 'inherit', padding: '0.6rem 0.8rem' }}
                placeholder="z. B.: Kreditoren mit gleicher Anschrift aber unterschiedlicher USt-IdNr → alle behalten"
                value={regel}
                onChange={e => {
                  setRegel(e.target.value)
                  // SQL invalidieren wenn Regeltext geändert wird (außer bei geladener Regel)
                  if (hasSql && !loadedRuleId) { setSql(''); setSqlEdited(false) }
                }}
                disabled={running}
              />

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem', alignItems: 'center' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleRunRule}
                  disabled={running || regel.trim().length < 5}
                >
                  {runLabel}
                </button>
                {(hasSql || rows) && (
                  <button className="btn btn-secondary" onClick={handleReset} disabled={running}>
                    Zurücksetzen
                  </button>
                )}
                {loadedRuleId && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 500 }}>
                    Gespeicherte Regel geladen
                  </span>
                )}
              </div>

              {genError && <div className="import-result import-result--error" style={{ marginTop: '0.75rem' }}>{genError}</div>}
            </div>

            {/* Erklärung (immer sichtbar nach Ausführung) */}
            {erklaerung && (
              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 6, padding: '0.6rem 1rem',
                fontSize: '0.85rem', marginBottom: '0.75rem',
                color: 'var(--color-text-light)',
              }}>
                <strong style={{ color: 'var(--color-navy)' }}>Erklärung: </strong>{erklaerung}
                {aktionErkl && (
                  <div style={{ marginTop: '0.3rem' }}>
                    <strong style={{ color: 'var(--color-navy)' }}>Vorgeschlagene Aktion: </strong>{aktionErkl}
                  </div>
                )}
              </div>
            )}

            {/* SQL-Panel (aufklappbar) */}
            {hasSql && (
              <div style={{ marginBottom: '1rem' }}>
                <button
                  onClick={() => setShowSql(v => !v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-light)', fontSize: '0.82rem',
                    padding: '0.2rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem',
                  }}
                >
                  <span style={{ fontSize: '0.7rem' }}>{showSql ? '▾' : '▸'}</span>
                  SQL {showSql ? 'ausblenden' : 'anzeigen / bearbeiten'}
                </button>

                {showSql && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <textarea
                      style={{
                        width: '100%', minHeight: 120, resize: 'vertical',
                        fontFamily: 'monospace', fontSize: '0.82rem',
                        padding: '0.6rem 0.8rem',
                        background: 'var(--color-surface)',
                        border: `1px solid ${sqlEdited ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 6, color: 'var(--color-text)',
                      }}
                      value={sql}
                      onChange={e => { setSql(e.target.value); setSqlEdited(true); setRows(null); setSelected(null); setApplyMsg('') }}
                    />
                    {sqlEdited && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <button
                          className="btn btn-primary"
                          onClick={handleRerunSql}
                          disabled={running || !sql.trim()}
                        >
                          {running ? 'Führe aus…' : 'SQL neu ausführen'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {execError && <div className="import-result import-result--error" style={{ marginTop: '0.75rem' }}>{execError}</div>}

                {/* Regel speichern */}
                {hasSql && !loadedRuleId && !showSaveForm && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setShowSaveForm(true); setSaveName('') }}
                      style={{ fontSize: '0.82rem' }}
                    >
                      Regel speichern…
                    </button>
                  </div>
                )}

                {showSaveForm && (
                  <div style={{
                    marginTop: '0.75rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6, padding: '0.75rem 1rem',
                    display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap',
                  }}>
                    <input
                      className="search-input"
                      style={{ flex: 1, minWidth: 200, padding: '0.4rem 0.7rem', fontSize: '0.9rem' }}
                      placeholder="Name der Regel…"
                      value={saveName}
                      onChange={e => setSaveName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveRule()}
                      autoFocus
                    />
                    <button className="btn btn-primary" onClick={handleSaveRule} disabled={saving || !saveName.trim()}>
                      {saving ? 'Speichern…' : 'Speichern'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowSaveForm(false)}>
                      Abbrechen
                    </button>
                  </div>
                )}

                {saveMsg && (
                  <div className={`import-result import-result--${saveMsg.startsWith('Fehler') ? 'error' : 'success'}`} style={{ marginTop: '0.5rem' }}>
                    {saveMsg}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ergebnisbereich */}
          {rows !== null && (
            <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem 1.5rem 1.5rem', display: 'flex', gap: '1rem', minHeight: 0 }}>

              {/* Linke Seite: Trefferliste */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
                    {rows.length === 0
                      ? 'Keine Datensätze gefunden — die Regel trifft auf keine Dubletten-Gruppen zu.'
                      : `${rows.length} Datensätze in ${groupsTotal} Gruppe${groupsTotal !== 1 ? 'n' : ''}`}
                  </span>

                  {rows.length > 0 && (
                    <span style={{
                      fontSize: '0.8rem',
                      padding: '0.15rem 0.6rem',
                      borderRadius: 12,
                      background: groupsOffen === 0 ? 'rgba(34,197,94,0.12)' : 'rgba(238,127,0,0.12)',
                      color: groupsOffen === 0 ? 'var(--color-success)' : 'var(--color-primary)',
                      fontWeight: 600,
                    }}>
                      {groupsOffen === 0 ? 'Alle bereinigt' : `${groupsOffen} offen`}
                    </span>
                  )}

                  {groups.length > 0 && (
                    <>
                      {/* Aktion-Selektor bei den Ergebnissen */}
                      <span style={{ fontSize: '0.82rem', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        Aktion:
                        <select
                          value={aktion}
                          onChange={e => setAktion(e.target.value)}
                          style={{
                            padding: '0.2rem 0.4rem',
                            border: '1px solid var(--color-border)',
                            borderRadius: 4, fontSize: '0.82rem',
                            background: 'var(--color-surface)',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="ignorieren">Ignorieren (alle behalten)</option>
                          <option value="pruefen">Zur Prüfung markieren</option>
                        </select>
                      </span>

                      <button
                        className="btn btn-primary"
                        onClick={handleApply}
                        disabled={applying || !!applyMsg}
                      >
                        {applying ? 'Anwenden…' : `Auf ${groups.length} Gruppe${groups.length !== 1 ? 'n' : ''} anwenden`}
                      </button>
                    </>
                  )}
                </div>

                {applyMsg && (
                  <div className={`import-result import-result--${applyMsg.startsWith('Fehler') ? 'error' : 'success'}`} style={{ marginBottom: '0.75rem' }}>
                    {applyMsg}
                  </div>
                )}

                {rows.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="records-table">
                      <thead>
                        <tr>{resultCols.map(c => <th key={c.key}>{c.label}</th>)}</tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr
                            key={i}
                            onClick={() => setSelected(selected?.lifnr === r.lifnr ? null : r)}
                            style={{
                              cursor: 'pointer',
                              background: selected?.lifnr === r.lifnr ? 'rgba(238,127,0,0.08)' : undefined,
                            }}
                          >
                            {resultCols.map(c => (
                              <td
                                key={c.key}
                                style={{
                                  color: c.key === 'loevm' && r[c.key] ? 'var(--color-error)'
                                    : c.key !== 'lifnr' && c.key !== 'name1' ? 'var(--color-text-light)'
                                    : undefined,
                                  fontWeight: c.key === 'lifnr' ? 600 : undefined,
                                }}
                              >
                                {r[c.key] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Rechte Seite: Detail + Dubletten */}
              {selected && (
                <div style={{
                  width: 320, flexShrink: 0,
                  display: 'flex', flexDirection: 'column', gap: '1rem',
                  overflowY: 'auto',
                }}>
                  <div style={{
                    background: 'var(--color-surface)',
                    border: `1px solid ${hasDuplicates ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: 8, padding: '1rem',
                    fontSize: '0.85rem',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-navy)' }}>
                      Dubletten-Prüfung
                    </div>
                    {loadingDups && (
                      <div className="import-progress">
                        <div className="loading-spinner" /><span>Prüfe…</span>
                      </div>
                    )}
                    {!loadingDups && duplicates && !hasDuplicates && (
                      <div style={{ color: 'var(--color-success)' }}>Keine exakten Dubletten gefunden.</div>
                    )}
                    {!loadingDups && hasDuplicates && (
                      <>
                        <div style={{ color: 'var(--color-primary)', fontWeight: 500, marginBottom: '0.5rem' }}>
                          {duplicates.length} Datensätze mit gleichem Namen + Ort
                        </div>
                        {duplicates.map(d => (
                          <div key={d.lifnr} style={{
                            padding: '0.3rem 0',
                            borderBottom: '1px solid var(--color-border)',
                            color: d.lifnr === selected.lifnr ? 'var(--color-primary)' : undefined,
                            fontWeight: d.lifnr === selected.lifnr ? 600 : undefined,
                          }}>
                            {d.lifnr} {d.name2 ? `· ${d.name2}` : ''}
                          </div>
                        ))}
                        {onGoToDuplicate && (
                          <button
                            className="btn btn-primary"
                            style={{ marginTop: '0.75rem', width: '100%' }}
                            onClick={() => onGoToDuplicate({ name1: selected.name1, ort01: selected.ort01 || '' })}
                          >
                            Zur Dubletten-Bereinigung →
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8, padding: '1rem',
                    fontSize: '0.85rem',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-navy)' }}>
                      {selected.name1}
                      {selected.loevm && (
                        <span style={{ marginLeft: '0.5rem', color: 'var(--color-error)', fontSize: '0.75rem' }}>
                          Löschvormerkung
                        </span>
                      )}
                    </div>
                    {Object.entries(selected)
                      .filter(([, v]) => v !== null && v !== '')
                      .map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ color: 'var(--color-text-light)', minWidth: 90, flexShrink: 0 }}>
                            {k.toUpperCase()}
                          </span>
                          <span style={{ wordBreak: 'break-all' }}>{String(v)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: GESPEICHERTE REGELN ===================== */}
      {activeTab === 'saved' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 1.5rem 1.5rem' }}>
          {loadingRules && (
            <div className="import-progress" style={{ marginTop: '1rem' }}>
              <div className="loading-spinner" /><span>Lade gespeicherte Regeln…</span>
            </div>
          )}
          {rulesError && (
            <div className="import-result import-result--error" style={{ marginTop: '1rem' }}>{rulesError}</div>
          )}
          {!loadingRules && !rulesError && savedRules.length === 0 && (
            <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--color-text-light)', fontSize: '0.9rem' }}>
              Noch keine Regeln gespeichert.<br />
              Wechsle zu „Neue Regel", um eine Regel zu erstellen und zu speichern.
            </div>
          )}
          {!loadingRules && savedRules.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              {savedRules.map(rule => {
                const allDone = rule.letztes_ergebnis_anzahl != null && rule.letztes_ergebnis_offen === 0
                const hasStats = rule.letztes_ergebnis_anzahl != null
                return (
                  <div key={rule.id} style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    padding: '1rem 1.25rem',
                    display: 'flex', flexDirection: 'column', gap: '0.5rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-navy)', flex: 1, minWidth: 120 }}>
                        {rule.name}
                      </span>
                      <AktionBadge aktion={rule.aktion} />
                    </div>

                    {rule.erklaerung && (
                      <div style={{ fontSize: '0.83rem', color: 'var(--color-text-light)' }}>
                        {rule.erklaerung}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                      <span>Erstellt von <strong>{rule.erstellt_von || '—'}</strong></span>
                      {rule.letzte_ausfuehrung && (
                        <span>Letzte Ausführung: <strong>{formatDate(rule.letzte_ausfuehrung)}</strong></span>
                      )}
                      {hasStats && (
                        <span style={{
                          padding: '0.15rem 0.6rem',
                          borderRadius: 12,
                          background: allDone ? 'rgba(34,197,94,0.12)' : 'rgba(238,127,0,0.12)',
                          color: allDone ? 'var(--color-success)' : 'var(--color-primary)',
                          fontWeight: 600,
                        }}>
                          {allDone
                            ? `${rule.letztes_ergebnis_anzahl} Gruppen — alle bereinigt`
                            : `${rule.letztes_ergebnis_anzahl} Gruppen, ${rule.letztes_ergebnis_offen} offen`}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.82rem', padding: '0.3rem 0.8rem' }}
                        onClick={() => handleLoadRule(rule)}
                      >
                        Ausführen
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.82rem', padding: '0.3rem 0.8rem' }}
                        onClick={() => handleDeleteRule(rule.id)}
                        disabled={deletingId === rule.id}
                      >
                        {deletingId === rule.id ? 'Löschen…' : 'Löschen'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RegelView
