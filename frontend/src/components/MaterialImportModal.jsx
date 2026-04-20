import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

async function uploadFile(file, endpoint, fetchWithAuth) {
  const formData = new FormData()
  formData.append('file', file)
  const resp = await fetchWithAuth(endpoint, { method: 'POST', body: formData })
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}))
    throw new Error(data.detail || 'Serverfehler')
  }
  return await resp.json()
}

function MaterialImportModal({ fetchWithAuth, onClose, onImportDone }) {
  const maraRef = useRef(null)
  const maktRef = useRef(null)
  const [maraFile, setMaraFile] = useState(null)
  const [maktFile, setMaktFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [step, setStep] = useState('')
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [migrated, setMigrated] = useState(null)

  useEffect(() => {
    fetchWithAuth('/api/admin/check-material-schema')
      .then(r => r.json())
      .then(d => setMigrated(d.migrated))
      .catch(() => setMigrated(false))
  }, [])

  async function handleImport() {
    if (!maraFile) return
    setStatus('running')
    setErrorMsg('')
    setResult(null)

    try {
      setStep('MARA wird hochgeladen und verarbeitet… (kann einige Minuten dauern)')
      const maraResult = await uploadFile(maraFile, '/api/admin/upload-mara-xlsx', fetchWithAuth)

      let maktResult = null
      if (maktFile) {
        setStep('MAKT wird hochgeladen und verarbeitet…')
        maktResult = await uploadFile(maktFile, '/api/admin/upload-makt-xlsx', fetchWithAuth)
      }

      setStatus('done')
      setStep('')
      setResult({ mara: maraResult.imported, makt: maktResult?.imported ?? null })
      if (onImportDone) onImportDone()
    } catch (e) {
      setStatus('error')
      setErrorMsg(String(e.message || e))
    }
  }

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        width: 'min(520px, 92vw)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>

        <div className="modal-header">
          <h2>Materialien importieren</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">

          {migrated === null && (
            <div className="import-progress" style={{ marginBottom: '1rem' }}>
              <div className="loading-spinner" />
              <span>Datenbankstruktur wird geprüft…</span>
            </div>
          )}

          {migrated === false && (
            <div className="import-result import-result--error" style={{ marginBottom: '1rem' }}>
              <strong>Tabellen fehlen</strong>
              <p style={{ margin: '0.4rem 0 0' }}>
                Bitte führe <code>scripts/create_material_tables.sql</code> im Supabase SQL-Editor aus,
                dann lade diese Seite neu.
              </p>
            </div>
          )}

          {migrated === true && status === 'idle' && (
            <p style={{ color: 'var(--color-text-light)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Wähle <strong>MARA_komplett.XLSX</strong> (Pflicht) und optional <strong>MAKT.XLSX</strong>.
              Die Dateien werden serverseitig verarbeitet — bitte warten.
            </p>
          )}

          {/* MARA-Datei */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--color-text-light)' }}>
              MARA_komplett.XLSX <span style={{ color: 'var(--color-error)' }}>*</span>
            </div>
            <div className="import-file-row">
              <input ref={maraRef} type="file" accept=".xlsx" onChange={e => setMaraFile(e.target.files[0] || null)} style={{ display: 'none' }} />
              <button className="btn btn-secondary" onClick={() => maraRef.current.click()} disabled={status === 'running'}>
                Datei auswählen
              </button>
              <span style={{ color: 'var(--color-text-light)', fontSize: '0.9rem' }}>
                {maraFile ? maraFile.name : 'Keine Datei'}
              </span>
            </div>
          </div>

          {/* MAKT-Datei */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--color-text-light)' }}>
              MAKT.XLSX <span style={{ color: 'var(--color-text-light)' }}>(optional)</span>
            </div>
            <div className="import-file-row">
              <input ref={maktRef} type="file" accept=".xlsx" onChange={e => setMaktFile(e.target.files[0] || null)} style={{ display: 'none' }} />
              <button className="btn btn-secondary" onClick={() => maktRef.current.click()} disabled={status === 'running'}>
                Datei auswählen
              </button>
              <span style={{ color: 'var(--color-text-light)', fontSize: '0.9rem' }}>
                {maktFile ? maktFile.name : 'Keine Datei'}
              </span>
            </div>
          </div>

          {status === 'running' && (
            <div className="import-progress">
              <div className="loading-spinner" />
              <span>{step}</span>
            </div>
          )}

          {status === 'done' && result && (
            <div className="import-result import-result--success">
              <strong>Import abgeschlossen</strong>
              <div style={{ marginTop: '0.25rem' }}>
                MARA: {result.mara} Datensätze
                {result.makt !== null && ` · MAKT: ${result.makt} Datensätze`}
              </div>
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
            disabled={!maraFile || status === 'running' || !migrated}
          >
            {status === 'running' ? 'Verarbeite…' : 'Importieren'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
        </div>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

export default MaterialImportModal
