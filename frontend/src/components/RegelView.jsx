import { useState } from 'react'

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

function RegelView({ fetchWithAuth }) {
  const [regel, setRegel]           = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState('')

  const [sql, setSql]                     = useState('')
  const [erklaerung, setErklaerung]       = useState('')
  const [aktion, setAktion]               = useState('ignorieren')
  const [aktionErkl, setAktionErkl]       = useState('')

  const [executing, setExecuting] = useState(false)
  const [execError, setExecError] = useState('')
  const [rows, setRows]           = useState(null)   // null = nicht ausgeführt

  const [applying, setApplying]   = useState(false)
  const [applyMsg, setApplyMsg]   = useState('')

  async function handleGenerate() {
    setGenError('')
    setRows(null)
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

  // Distinct (name1, ort01) Paare aus den Ergebnissen
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

  // Spalten für die Ergebnistabelle (nur vorhandene)
  const resultCols = rows && rows.length > 0
    ? DISPLAY_COLUMNS.filter(c => rows.some(r => r[c.key] !== undefined && r[c.key] !== null && r[c.key] !== ''))
    : DISPLAY_COLUMNS

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto', padding: '1.5rem' }}>

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
          style={{ width: '100%', minHeight: 80, resize: 'vertical', fontFamily: 'inherit', padding: '0.6rem 0.8rem' }}
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
                setRows(null); setGenError(''); setExecError(''); setApplyMsg('')
              }}
            >
              Zurücksetzen
            </button>
          )}
        </div>
        {genError && <div className="import-result import-result--error" style={{ marginTop: '0.75rem' }}>{genError}</div>}
      </div>

      {/* SQL-Vorschau + Ausführen */}
      {hasSql && (
        <div style={{ marginBottom: '1rem' }}>
          {erklaerung && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 6, padding: '0.75rem 1rem',
              fontSize: '0.85rem', marginBottom: '0.75rem',
              color: 'var(--color-text-light)',
            }}>
              <strong style={{ color: 'var(--color-navy)' }}>Erklärung: </strong>{erklaerung}
              {aktionErkl && (
                <div style={{ marginTop: '0.4rem' }}>
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
              width: '100%', minHeight: 140, resize: 'vertical',
              fontFamily: 'monospace', fontSize: '0.82rem',
              padding: '0.6rem 0.8rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 6, color: 'var(--color-text)',
            }}
            value={sql}
            onChange={e => { setSql(e.target.value); setRows(null); setApplyMsg('') }}
          />

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleExecute}
              disabled={executing || !sql.trim()}
            >
              {executing ? 'Ausführen…' : 'SQL ausführen'}
            </button>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-light)' }}>
              Aktion: <strong>{aktion === 'ignorieren' ? 'Ignorieren (alle behalten)' : 'Zur Prüfung markieren'}</strong>
              <select
                value={aktion}
                onChange={e => setAktion(e.target.value)}
                style={{
                  marginLeft: '0.5rem', padding: '0.2rem 0.4rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4, fontSize: '0.82rem',
                  background: 'var(--color-surface)',
                  cursor: 'pointer',
                }}
              >
                <option value="ignorieren">Ignorieren</option>
                <option value="pruefen">Zur Prüfung markieren</option>
              </select>
            </span>
          </div>
          {execError && <div className="import-result import-result--error" style={{ marginTop: '0.75rem' }}>{execError}</div>}
        </div>
      )}

      {/* Ergebnisse */}
      {rows !== null && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
              {rows.length === 0
                ? 'Keine Datensätze gefunden — die Regel trifft auf keine Dubletten-Gruppen zu.'
                : `${rows.length} Datensätze in ${groups.length} Gruppen`}
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
                    <tr key={i}>
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
      )}
    </div>
  )
}

export default RegelView
