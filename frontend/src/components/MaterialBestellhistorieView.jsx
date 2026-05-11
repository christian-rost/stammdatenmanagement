import { useState, useEffect, useRef } from 'react'

const FILTERS = [
  { key: 'nicht_bestellt', label: 'Nicht bestellt' },
  { key: 'bestellt',       label: 'Bestellt' },
  { key: 'alle',           label: 'Alle' },
]

const FILENAMES = {
  nicht_bestellt: 'nicht_bestellt_seit_2020.csv',
  bestellt:       'bestellt_seit_2020.csv',
  alle:           'alle_materialien.csv',
}

const thStyle = {
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.8rem',
  color: 'var(--color-text-light)',
  whiteSpace: 'nowrap',
  background: 'var(--color-surface)',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  borderBottom: '2px solid var(--color-border)',
}

const tdStyle = {
  padding: '0.4rem 0.75rem',
  verticalAlign: 'middle',
  borderBottom: '1px solid var(--color-border)',
}

function MaterialBestellhistorieView({ fetchWithAuth, isAdmin }) {
  const [filter, setFilter] = useState('nicht_bestellt')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => { loadData(filter) }, [filter])

  async function loadData(f) {
    setLoading(true)
    setError('')
    try {
      const resp = await fetchWithAuth(`/api/materials/bestellhistorie?filter=${f}`)
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        setError(err.detail || `Fehler ${resp.status}`)
        return
      }
      setData(await resp.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const resp = await fetchWithAuth(`/api/materials/bestellhistorie/export?filter=${filter}`)
      if (resp.ok) {
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = FILENAMES[filter]
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setExporting(false)
    }
  }

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    setUploadError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resp = await fetchWithAuth('/api/admin/upload-ekpo-xlsx', { method: 'POST', body: formData })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        setUploadError(err.detail || `Fehler ${resp.status}`)
        return
      }
      const result = await resp.json()
      setUploadResult(result)
      loadData(filter)
    } catch (e) {
      setUploadError(String(e))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const stats = data?.stats
  const records = data?.records || []

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Toolbar */}
      <div style={{
        padding: '0.85rem 1.5rem',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        alignItems: 'center',
      }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {stats ? (
            <>
              <div className="stat-item">
                <strong>{stats.gesamt.toLocaleString('de-DE')}</strong> Gesamt
              </div>
              <div className="stat-item bearbeitet">
                <strong>{stats.bestellt.toLocaleString('de-DE')}</strong> Bestellt
              </div>
              <div className="stat-item" style={{ color: 'var(--color-error)' }}>
                <strong style={{ color: 'var(--color-error)' }}>{stats.nicht_bestellt.toLocaleString('de-DE')}</strong> Nicht bestellt
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
              Lade Statistik…
            </div>
          )}
        </div>

        {/* Filter */}
        <div className="filter-bar" style={{ marginLeft: 'auto' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`filter-btn ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {stats && f.key !== 'alle' && (
                <span style={{ marginLeft: '0.3rem', opacity: 0.75 }}>
                  ({(f.key === 'bestellt' ? stats.bestellt : stats.nicht_bestellt).toLocaleString('de-DE')})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Export */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleExport}
          disabled={exporting || loading || records.length === 0}
        >
          {exporting ? 'Exportiere…' : 'CSV Export'}
        </button>
      </div>

      {/* Admin Upload */}
      {isAdmin && (
        <div style={{
          padding: '0.6rem 1.5rem',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          fontSize: '0.85rem',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>EKPO-Daten:</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            onChange={e => handleUpload(e.target.files[0])}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Importiere…' : 'EKPO-Datei hochladen'}
          </button>
          {uploadResult && (
            <span style={{ color: 'var(--color-success)' }}>
              {uploadResult.imported.toLocaleString('de-DE')} Datensätze importiert
              {uploadResult.sheet && ` (Blatt: ${uploadResult.sheet})`}
            </span>
          )}
          {uploadError && (
            <span style={{ color: 'var(--color-error)' }}>{uploadError}</span>
          )}
          <span style={{ marginLeft: 'auto', color: 'var(--color-text-light)', fontSize: '0.75rem' }}>
            Blatt „nur nach Artikelnummern" aus EKPO-XLSX
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '1rem 1.5rem', color: 'var(--color-error)', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div className="loading" style={{ padding: '3rem' }}>
            <div className="loading-spinner" /> Lade Daten…
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={thStyle}>MATNR</th>
                <th style={thStyle}>Bezeichnung (MAKTX)</th>
                <th style={thStyle}>Materialart</th>
                <th style={thStyle}>Warengruppe</th>
                <th style={thStyle}>Letztes Bestelldatum</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-light)' }}>
                    {data === null
                      ? 'Noch keine EKPO-Daten importiert.'
                      : 'Keine Einträge für diesen Filter.'}
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.matnr}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#213452', fontWeight: 500 }}>
                      {Number(r.matnr) || r.matnr}
                    </td>
                    <td style={tdStyle}>{r.maktx || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--color-text-light)' }}>{r.mtart || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--color-text-light)' }}>{r.matkl || '—'}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      {r.letztes_bestelldatum
                        ? new Date(r.letztes_bestelldatum).toLocaleDateString('de-DE')
                        : <span style={{ color: 'var(--color-text-light)' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: r.bestellt ? 'rgba(40,167,69,0.1)' : 'rgba(180,180,180,0.15)',
                        color: r.bestellt ? 'var(--color-success)' : 'var(--color-text-light)',
                      }}>
                        {r.bestellt ? 'Bestellt' : 'Nicht bestellt'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.4rem 1.5rem',
        borderTop: '1px solid var(--color-border)',
        fontSize: '0.75rem',
        color: 'var(--color-text-light)',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Bestellzeitraum: ab 01.01.2020 · AEDAT = letztes Änderungsdatum der Bestellposition</span>
        {!loading && <span>{records.length.toLocaleString('de-DE')} Einträge</span>}
      </div>
    </div>
  )
}

export default MaterialBestellhistorieView
