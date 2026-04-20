import { useState, useRef } from 'react'

const COLUMNS = [
  { key: 'matnr', label: 'MATNR' },
  { key: 'maktx', label: 'MAKTX' },
  { key: 'mtart', label: 'MTART' },
  { key: 'matkl', label: 'MATKL' },
  { key: 'meins', label: 'MEINS' },
  { key: 'mstae', label: 'MSTAE' },
  { key: 'lvorm', label: 'Löschvm.' },
]

function MaterialSearchView({ fetchWithAuth, onGoToDuplicate }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [duplicates, setDuplicates] = useState(null)
  const [loadingDups, setLoadingDups] = useState(false)
  const inputRef = useRef(null)

  async function checkDuplicates(record) {
    if (!record?.maktg) { setDuplicates([]); return }
    setLoadingDups(true)
    setDuplicates(null)
    try {
      const params = new URLSearchParams({ maktg: record.maktg })
      const resp = await fetchWithAuth(`/api/materials/duplicates/records?${params}`)
      setDuplicates(resp.ok ? await resp.json() : [])
    } catch {
      setDuplicates([])
    } finally {
      setLoadingDups(false)
    }
  }

  function handleSelect(record) {
    const next = selected?.matnr === record.matnr ? null : record
    setSelected(next)
    if (next) checkDuplicates(next)
    else setDuplicates(null)
  }

  async function handleSearch(e) {
    e?.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError('')
    setSelected(null)
    setDuplicates(null)
    try {
      const resp = await fetchWithAuth(`/api/materials/search?q=${encodeURIComponent(q)}`)
      if (!resp.ok) { setError('Suche fehlgeschlagen'); return }
      setResults(await resp.json())
    } catch {
      setError('Verbindungsfehler')
    } finally {
      setLoading(false)
    }
  }

  const hasDuplicates = duplicates && duplicates.length > 1

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', padding: '1.5rem 1.5rem 0' }}>
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder="MATNR, Bezeichnung, Materialart, Warengruppe…"
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

      <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.5rem 1.5rem', display: 'flex', gap: '1rem', minHeight: 0 }}>

        <div style={{ flex: 1, minWidth: 0 }}>
          {error && <div className="import-result import-result--error">{error}</div>}

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
              <div style={{ overflowX: 'auto' }}>
                <table className="records-table">
                  <thead>
                    <tr>{COLUMNS.map(c => <th key={c.key}>{c.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr
                        key={r.matnr}
                        onClick={() => handleSelect(r)}
                        style={{
                          cursor: 'pointer',
                          background: selected?.matnr === r.matnr ? 'rgba(238,127,0,0.08)' : undefined,
                        }}
                      >
                        {COLUMNS.map(c => (
                          <td
                            key={c.key}
                            style={{
                              color: c.key === 'lvorm' && r[c.key] ? 'var(--color-error)'
                                : c.key !== 'matnr' && c.key !== 'maktx' ? 'var(--color-text-light)'
                                : undefined,
                              fontWeight: c.key === 'matnr' ? 600 : undefined,
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
            </>
          )}
        </div>

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
                    {duplicates.length} Materialien mit gleicher Bezeichnung
                  </div>
                  {duplicates.map(d => (
                    <div key={d.matnr} style={{
                      padding: '0.3rem 0',
                      borderBottom: '1px solid var(--color-border)',
                      color: d.matnr === selected.matnr ? 'var(--color-primary)' : undefined,
                      fontWeight: d.matnr === selected.matnr ? 600 : undefined,
                    }}>
                      {d.matnr}
                    </div>
                  ))}
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '0.75rem', width: '100%' }}
                    onClick={() => onGoToDuplicate({ maktg: selected.maktg })}
                  >
                    Zur Dubletten-Bereinigung →
                  </button>
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
                {selected.maktx}
                {selected.lvorm && (
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
    </div>
  )
}

export default MaterialSearchView
