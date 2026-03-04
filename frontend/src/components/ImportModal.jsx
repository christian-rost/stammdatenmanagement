import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'

const BATCH_SIZE = 500

// Konvertiert Excel-Zellwert zu DB-kompatiblem Wert
function coerce(col, val) {
  if (val === null || val === undefined || val === '') return null
  // SheetJS liefert bei cellDates:true bereits JS Date-Objekte
  if (val instanceof Date) {
    // Nur Zeit-Spalte
    if (col === 'uptim') {
      return val.toTimeString().slice(0, 8) // HH:MM:SS
    }
    return val.toISOString().slice(0, 10) // YYYY-MM-DD
  }
  if (col === 'j_sc_capital') return typeof val === 'number' ? val : null
  if (col === 'staging_time') return typeof val === 'number' ? Math.round(val) : null
  const s = String(val).trim()
  return s === '' ? null : s
}

function parseXlsx(file) {
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
              const val = coerce(col, row[i])
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

function ImportModal({ fetchWithAuth, onClose, onImportDone }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | parsing | uploading | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [errorMsg, setErrorMsg] = useState('')
  const [migrated, setMigrated] = useState(null)

  useEffect(() => {
    fetchWithAuth('/api/admin/check-schema')
      .then(r => r.json())
      .then(d => setMigrated(d.migrated))
      .catch(() => setMigrated(false))
  }, [])

  function handleFileChange(e) {
    setFile(e.target.files[0] || null)
    setStatus('idle')
    setProgress({ done: 0, total: 0 })
    setErrorMsg('')
  }

  async function handleImport() {
    if (!file) return
    setStatus('parsing')
    setErrorMsg('')

    let records
    try {
      records = await parseXlsx(file)
    } catch (e) {
      setStatus('error')
      setErrorMsg(`Datei konnte nicht gelesen werden: ${e.message}`)
      return
    }

    const total = records.length
    setStatus('uploading')
    setProgress({ done: 0, total })

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      try {
        const resp = await fetchWithAuth('/api/admin/import-lfa1-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: batch }),
        })
        if (!resp.ok) {
          const data = await resp.json()
          setStatus('error')
          setErrorMsg(data.detail || 'Serverfehler')
          return
        }
        setProgress({ done: Math.min(i + BATCH_SIZE, total), total })
      } catch (e) {
        setStatus('error')
        setErrorMsg(String(e))
        return
      }
    }

    setStatus('done')
    if (onImportDone) onImportDone()
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  const modal = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <h2>LFA1-Daten importieren</h2>
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
              <strong>Migration erforderlich</strong>
              <p style={{ margin: '0.4rem 0 0' }}>
                Bitte führe zuerst <code>scripts/migrate_lfa1_add_columns.sql</code> im{' '}
                Supabase SQL-Editor aus, dann lade diese Seite neu.
              </p>
            </div>
          )}

          {migrated === true && status === 'idle' && (
            <p style={{ color: 'var(--color-text-light)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Wähle die <strong>LFA1_komplett.XLSX</strong>. Die Datei wird im Browser eingelesen
              und in Batches importiert. Bestehende Datensätze werden aktualisiert.
            </p>
          )}

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
              disabled={status === 'parsing' || status === 'uploading'}
            >
              Datei auswählen
            </button>
            <span style={{ color: 'var(--color-text-light)', fontSize: '0.9rem' }}>
              {file ? file.name : 'Keine Datei gewählt'}
            </span>
          </div>

          {status === 'parsing' && (
            <div className="import-progress">
              <div className="loading-spinner" />
              <span>Excel-Datei wird eingelesen…</span>
            </div>
          )}

          {status === 'uploading' && (
            <div>
              <div className="import-progress" style={{ marginBottom: '0.5rem' }}>
                <div className="loading-spinner" />
                <span>Importiere… {progress.done} / {progress.total} Datensätze</span>
              </div>
              <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 6 }}>
                <div style={{
                  background: 'var(--color-primary)',
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="import-result import-result--success">
              <strong>Import abgeschlossen</strong>
              <div style={{ marginTop: '0.25rem' }}>
                {progress.total} Datensätze erfolgreich importiert.
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
            disabled={!file || status === 'parsing' || status === 'uploading' || !migrated}
          >
            {status === 'parsing' ? 'Lese Datei…' : status === 'uploading' ? `${pct}%` : 'Importieren'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Schließen
          </button>
        </div>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

export default ImportModal
