import { useState, useRef } from 'react'

const COLUMNS = [
  { key: 'lifnr',  label: 'LIFNR' },
  { key: 'name1',  label: 'Name 1' },
  { key: 'name2',  label: 'Name 2' },
  { key: 'stras',  label: 'Straße' },
  { key: 'pstlz',  label: 'PLZ' },
  { key: 'ort01',  label: 'Ort' },
  { key: 'land1',  label: 'Land' },
  { key: 'telf1',  label: 'Telefon' },
  { key: 'stceg',  label: 'USt-IdNr' },
  { key: 'brsch',  label: 'Branche' },
  { key: 'loevm',  label: 'Löschvm.' },
]

function SearchView({ fetchWithAuth }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)  // null = noch nicht gesucht
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const inputRef = useRef(null)

  async function handleSearch(e) {
    e?.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError('')
    setSelected(null)
    try {
      const resp = await fetchWithAuth(`/api/search?q=${encodeURIComponent(q)}`)
      if (!resp.ok) { setError('Suche fehlgeschlagen'); return }
      setResults(await resp.json())
    } catch {
      setError('Verbindungsfehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Suchleiste */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', padding: '1.5rem 1.5rem 0' }}>
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder="Suchbegriff eingeben, z. B. §11, Müller, Hamburg, DE12345678…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        <button className="btn btn-primary" type="submit" disabled={loading || !query.trim()}>
          {loading ? 'Suche…' : 'Suchen'}
        </button>
        {results !== null && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setResults(null); setQuery(''); setSelected(null); inputRef.current?.focus() }}
          >
            Zurücksetzen
          </button>
        )}
      </form>

      {/* Ergebnisse */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.5rem 1.5rem' }}>

        {error && (
          <div className="import-result import-result--error">{error}</div>
        )}

        {results === null && !loading && (
          <div style={{ color: 'var(--color-text-light)', marginTop: '2rem', textAlign: 'center' }}>
            Suchbegriff eingeben und Enter drücken
          </div>
        )}

        {results !== null && !loading && results.length === 0 && (
          <div style={{ color: 'var(--color-text-light)', marginTop: '2rem', textAlign: 'center' }}>
            Keine Treffer für „{query}"
          </div>
        )}

        {results !== null && results.length > 0 && (
          <>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: '0.75rem' }}>
              {results.length === 500
                ? 'Mehr als 500 Treffer — Suche verfeinern'
                : `${results.length} Treffer`}
            </div>

            <div style={{ display: 'flex', gap: '1rem', minHeight: 0 }}>

              {/* Trefferliste */}
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table className="records-table">
                  <thead>
                    <tr>
                      {COLUMNS.map(c => <th key={c.key}>{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr
                        key={r.lifnr}
                        onClick={() => setSelected(selected?.lifnr === r.lifnr ? null : r)}
                        style={{
                          cursor: 'pointer',
                          background: selected?.lifnr === r.lifnr ? 'rgba(238,127,0,0.08)' : undefined,
                        }}
                      >
                        {COLUMNS.map(c => (
                          <td
                            key={c.key}
                            style={{
                              color: c.key === 'loevm' && r[c.key]
                                ? 'var(--color-error)'
                                : c.key !== 'lifnr' && c.key !== 'name1'
                                  ? 'var(--color-text-light)'
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

              {/* Detail-Panel */}
              {selected && (
                <div style={{
                  width: 300, flexShrink: 0,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8, padding: '1rem',
                  overflowY: 'auto', fontSize: '0.85rem',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-navy)' }}>
                    {selected.name1}
                  </div>
                  {Object.entries(selected)
                    .filter(([, v]) => v !== null && v !== '')
                    .map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--color-text-light)', minWidth: 90, flexShrink: 0 }}>
                          {k.toUpperCase()}
                        </span>
                        <span style={{ wordBreak: 'break-all' }}>{String(v)}</span>
                      </div>
                    ))}
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SearchView
