import { useState, useEffect } from 'react'

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

function RegelView({ fetchWithAuth, onGoToDuplicate }) {
  const [regel, setRegel]           = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState('')

  const [sql, setSql]           = useState('')
  const [erklaerung, setErklaerung] = useState('')
  const [aktion, setAktion]     = useState('ignorieren')
  const [aktionErkl, setAktionErkl] = useState('')

  const [executing, setExecuting] = useState(false)
  const [execError, setExecError] = useState('')
  const [rows, setRows]           = useState(null)

  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState('')

  const [selected, setSelected]       = useState(null)
  const [duplicates, setDuplicates]   = useState(null)
  const [loadingDups, setLoadingDups] = useState(false)

  // Dubletten laden wenn ein Datensatz selektiert wird
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

  async function handleGenerate() {
    setGenError('')
    setRows(null)
    setSelected(null)
    setApplyMsg('')
    setGenerating(true)
    try {
      const resp = await fetchWithAuth('/api/rules/generate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regel }),
      })
      if (!resp.ok) {
        const d = await resp.json()
        setGenError(d.detail || 'Fehler beim Generieren')
        return
      }
      const d = await resp.json()
      setSql(d.sql)
      setErklaerung(d.erklaerung)
      setAktion(d.aktion)
      setAktionErkl(d.aktion_erklaerung)
    } catch {
      setGenError('Verbindungsfehler')
    } finally {
      setGenerating(false)
    }
  }

  async function handleExecute() {
    setExecError('')
    setApplyMsg('')
    setSelected(null)
    setExecuting(true)
    try {
      const resp = await fetchWithAuth('/api/rules/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      })
      if (!resp.ok) {
        const d = await resp.json()
        setExecError(d.detail || 'SQL-Fehler')
        return
      }
      const d = await resp.json()
      setRows(d.rows)
    } catch {
      setExecError('Verbindungsfehler')
    } finally {
      setExecuting(false)
    }
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

  const groups = getGroups()
  const hasSql = sql.trim().length > 0
  const hasDuplicates = duplicates && duplicates.length > 1

  const resultCols = rows && rows.length > 0
    ? DISPLAY_COLUMNS.filter(c => rows.some(r => r[c.key] !== undefined && r[c.key] !== null && r[c.key] !== ''))
    : DISPLAY_COLUMNS

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Oberer Bereich: Regel-Eingabe + SQL */}
      <div style={{ padding: '1.5rem 1.5rem 0' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '1.25rem' }}>
          Regel-Assistent
        </h2>

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
            onChange={e => setRegel(e.target.value)}
            disabled={generating}
          />
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={generating || regel.trim().length < 5}
            >
              {generating ? 'Generiere…' : 'SQL generieren'}
            </button>
            {(sql || rows) && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSql(''); setErklaerung(''); setAktion('ignorieren'); setAktionErkl('')
                  setRows(null); setSelected(null); setGenError(''); setExecError(''); setApplyMsg('')
                }}
              >
                Zurücksetzen
              </button>
            )}
          </div>
          {genError && <div className="import-result import-result--error" style={{ marginTop: '0.75rem' }}>{genError}</div>}
        </div>

        {/* SQL-Vorschau */}
        {hasSql && (
          <div style={{ marginBottom: '1rem' }}>
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

            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
              Generiertes SQL <span style={{ fontWeight: 400, color: 'var(--color-text-light)' }}>(bearbeitbar)</span>:
            </label>
            <textarea
              style={{
                width: '100%', minHeight: 120, resize: 'vertical',
                fontFamily: 'monospace', fontSize: '0.82rem',
                padding: '0.6rem 0.8rem',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 6, color: 'var(--color-text)',
              }}
              value={sql}
              onChange={e => { setSql(e.target.value); setRows(null); setSelected(null); setApplyMsg('') }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem', alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={handleExecute}
                disabled={executing || !sql.trim()}
              >
                {executing ? 'Ausführen…' : 'SQL ausführen'}
              </button>
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
            </div>
            {execError && <div className="import-result import-result--error" style={{ marginTop: '0.75rem' }}>{execError}</div>}
          </div>
        )}
      </div>

      {/* Ergebnisbereich: Tabelle links, Detail rechts */}
      {rows !== null && (
        <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem 1.5rem 1.5rem', display: 'flex', gap: '1rem', minHeight: 0 }}>

          {/* Linke Seite: Trefferliste */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
                {rows.length === 0
                  ? 'Keine Datensätze gefunden — die Regel trifft auf keine Dubletten-Gruppen zu.'
                  : `${rows.length} Datensätze in ${groups.length} Gruppe${groups.length !== 1 ? 'n' : ''}`}
              </span>
              {groups.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={handleApply}
                  disabled={applying || !!applyMsg}
                >
                  {applying ? 'Anwenden…' : `Auf ${groups.length} Gruppe${groups.length !== 1 ? 'n' : ''} anwenden`}
                </button>
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

              {/* Dubletten-Prüfung */}
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
                  <div style={{ color: 'var(--color-success)' }}>
                    Keine exakten Dubletten gefunden.
                  </div>
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

              {/* Datensatz-Details */}
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
  )
}

export default RegelView
