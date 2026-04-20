import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'

const BATCH_SIZE = 500

function sanitizeColName(h) {
  return String(h).replace(/^\/+/, '').replace(/\//g, '_').toLowerCase()
}

function coerceMara(col, val) {
  if (val === null || val === undefined || val === '') return null
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  const s = String(val).trim()
  return s === '' ? null : s
}

function parseXlsxMara(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        const [headerRow, ...dataRows] = raw
        const headers = headerRow.map(h => sanitizeColName(h))

        const records = dataRows
          .filter(row => row.some(v => v !== null && v !== ''))
          .map(row => {
            const rec = {}
            headers.forEach((col, i) => {
              const val = coerceMara(col, row[i])
              if (val !== null) rec[col] = val
            })
            return rec
          })

        resolve(records)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function parseXlsxMakt(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        const [headerRow, ...dataRows] = raw
        const headers = headerRow.map(h => String(h).toLowerCase())

        const records = dataRows
          .filter(row => row.some(v => v !== null && v !== ''))
          .map(row => {
            const rec = {}
            headers.forEach((col, i) => {
              const val = row[i]
              if (val !== null && val !== undefined && val !== '') {
                rec[col] = String(val).trim() || null
              }
            })
            return rec
          })
          .filter(r => r.matnr && r.spras)

        resolve(records)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

async function uploadBatches(records, endpoint, fetchWithAuth, onProgress) {
  const total = records.length
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const resp = await fetchWithAuth(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: batch }),
    })
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}))
      throw new Error(data.detail || 'Serverfehler')
    }
    onProgress(Math.min(i + BATCH_SIZE, total), total)
  }
}

function MaterialImportModal({ fetchWithAuth, onClose, onImportDone }) {
  const maraRef = useRef(null)
  const maktRef = useRef(null)
  const [maraFile, setMaraFile] = useState(null)
  const [maktFile, setMaktFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [step, setStep] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
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
    setProgress({ done: 0, total: 0 })

    try {
      // MARA parsen + hochladen
      setStep('MARA wird eingelesen…')
      const maraRecords = await parseXlsxMara(maraFile)
      setStep(`MARA wird importiert… (${maraRecords.length} Datensätze)`)
      await uploadBatches(maraRecords, '/api/admin/import-mara-batch', fetchWithAuth, (done, total) => {
        setProgress({ done, total })
      })

      // MAKT parsen + hochladen (optional)
      if (maktFile) {
        setStep('MAKT wird eingelesen…')
        const maktRecords = await parseXlsxMakt(maktFile)
        setStep(`MAKT wird importiert… (${maktRecords.length} Datensätze)`)
        setProgress({ done: 0, total: maktRecords.length })
        await uploadBatches(maktRecords, '/api/admin/import-makt-batch', fetchWithAuth, (done, total) => {
          setProgress({ done, total })
        })
      }

      setStatus('done')
      setStep('')
      if (onImportDone) onImportDone()
    } catch (e) {
      setStatus('error')
      setErrorMsg(String(e.message || e))
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

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
              Bestehende Datensätze werden aktualisiert (Upsert).
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
            <div>
              <div className="import-progress" style={{ marginBottom: '0.5rem' }}>
                <div className="loading-spinner" />
                <span>{step}</span>
              </div>
              {progress.total > 0 && (
                <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 6 }}>
                  <div style={{
                    background: 'var(--color-primary)',
                    width: `${pct}%`,
                    height: '100%',
                    borderRadius: 4,
                    transition: 'width 0.3s',
                  }} />
                </div>
              )}
            </div>
          )}

          {status === 'done' && (
            <div className="import-result import-result--success">
              <strong>Import abgeschlossen</strong>
              <div style={{ marginTop: '0.25rem' }}>MARA und MAKT erfolgreich importiert.</div>
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
            {status === 'running' ? `${pct}%` : 'Importieren'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
        </div>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

export default MaterialImportModal
