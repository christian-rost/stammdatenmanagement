import { useRef, useState, useEffect } from 'react'

function ImportModal({ fetchWithAuth, onClose, onImportDone }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | uploading | done | error
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [migrated, setMigrated] = useState(null) // null = loading, true/false

  useEffect(() => {
    fetchWithAuth('/api/admin/check-schema')
      .then(r => r.json())
      .then(d => setMigrated(d.migrated))
      .catch(() => setMigrated(false))
  }, [])

  function handleFileChange(e) {
    setFile(e.target.files[0] || null)
    setStatus('idle')
    setResult(null)
    setErrorMsg('')
  }

  async function handleImport() {
    if (!file) return
    setStatus('uploading')
    setResult(null)
    setErrorMsg('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const resp = await fetchWithAuth('/api/admin/import-lfa1', {
        method: 'POST',
        body: formData,
      })
      const data = await resp.json()
      if (!resp.ok) {
        setStatus('error')
        setErrorMsg(data.detail || 'Unbekannter Fehler')
        return
      }
      setResult(data)
      setStatus('done')
      setMigrated(true)
      if (onImportDone) onImportDone()
    } catch (e) {
      setStatus('error')
      setErrorMsg(String(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>LFA1-Daten importieren</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">

          {/* Schema-Status */}
          {migrated === null && (
            <div className="import-progress" style={{ marginBottom: '1rem' }}>
              <div className="loading-spinner" />
              <span>Datenbankstruktur wird geprüft…</span>
            </div>
          )}

          {migrated === false && (
            <div className="import-result import-result--error" style={{ marginBottom: '1rem' }}>
              <strong>Migration erforderlich</strong>
              <p style={{ margin: '0.4rem 0 0' }}>
                Die Datenbank hat noch nicht alle Spalten für den vollständigen Import.
                Bitte führe zuerst das folgende SQL im{' '}
                <strong>Supabase SQL-Editor</strong> aus:
              </p>
              <pre style={{ fontSize: '0.75rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
                {`-- Inhalt von scripts/migrate_lfa1_add_columns.sql\nALTER TABLE lfa1 ADD COLUMN IF NOT EXISTS stras TEXT, ...`}
              </pre>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
                Datei: <code>scripts/migrate_lfa1_add_columns.sql</code>
              </p>
            </div>
          )}

          {migrated === true && (
            <p style={{ color: 'var(--color-text-light)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Wähle eine <strong>.xlsx</strong>-Datei aus dem SAP-Export.
              Bestehende Datensätze werden aktualisiert, neue hinzugefügt.
            </p>
          )}

          {/* File picker — immer sichtbar */}
          <div className="import-file-row">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-secondary"
              onClick={() => inputRef.current.click()}
              disabled={status === 'uploading'}
            >
              Datei auswählen
            </button>
            <span style={{ color: 'var(--color-text-light)', fontSize: '0.9rem' }}>
              {file ? file.name : 'Keine Datei gewählt'}
            </span>
          </div>

          {status === 'uploading' && (
            <div className="import-progress">
              <div className="loading-spinner" />
              <span>Datei wird verarbeitet und importiert…</span>
            </div>
          )}

          {status === 'done' && result && (
            <div className="import-result import-result--success">
              <strong>Import abgeschlossen</strong>
              <div style={{ marginTop: '0.25rem' }}>
                {result.imported} von {result.total} Datensätzen importiert.
              </div>
              {result.errors?.length > 0 && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{ cursor: 'pointer' }}>{result.errors.length} Batch-Fehler</summary>
                  <pre style={{ fontSize: '0.75rem', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                    {result.errors.join('\n')}
                  </pre>
                </details>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="import-result import-result--error">
              <strong>Fehler:</strong> {errorMsg}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!file || status === 'uploading' || migrated === false || migrated === null}
          >
            {status === 'uploading' ? 'Importiere…' : 'Importieren'}
          </button>
          <button className="btn btn-outline" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImportModal
