import { useState, useEffect } from 'react'

function DublettenDetail({ group, fetchWithAuth, onDecisionSaved }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [lifnrBehalten, setLifnrBehalten] = useState(null)
  const [notiz, setNotiz] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!group) { setRecords([]); return }
    loadRecords()
    // Pre-fill from existing decision
    setLifnrBehalten(group.lifnr_behalten || null)
    setNotiz(group.notiz || '')
    setSaved(false)
  }, [group])

  async function loadRecords() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ name1: group.name1, ort01: group.ort01 })
      const resp = await fetchWithAuth(`/api/duplicates/records?${params}`)
      if (resp.ok) setRecords(await resp.json())
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(statusValue) {
    setSaving(true); setSaved(false)
    const loeschen = records
      .map(r => r.lifnr)
      .filter(l => l !== lifnrBehalten)

    try {
      const resp = await fetchWithAuth('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name1: group.name1,
          ort01: group.ort01,
          lifnr_behalten: statusValue === 'ignoriert' ? null : lifnrBehalten,
          lifnr_loeschen: statusValue === 'ignoriert' ? [] : loeschen,
          notiz,
          status: statusValue,
        })
      })
      if (resp.ok) {
        setSaved(true)
        onDecisionSaved(group.name1, group.ort01, statusValue)
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!group) {
    return (
      <div className="detail-view">
        <div className="detail-header">
          <div>
            <div className="detail-header-title">Dubletten-Bereinigung</div>
            <div className="detail-header-sub">Gruppe aus der Liste auswählen</div>
          </div>
        </div>
        <div className="detail-placeholder">
          ← Bitte eine Dubletten-Gruppe auswählen
        </div>
      </div>
    )
  }

  const lifnrLoeschen = records.map(r => r.lifnr).filter(l => l !== lifnrBehalten)

  return (
    <div className="detail-view">
      <div className="detail-header">
        <div>
          <div className="detail-header-title">{group.name1}</div>
          <div className="detail-header-sub">
            {group.ort01 || '—'} · {group.anzahl} Datensätze
          </div>
        </div>
        <span className={`badge badge-${group.status}`}>
          {group.status === 'offen' ? 'Offen' : group.status === 'bearbeitet' ? 'Erledigt' : 'Ignoriert'}
        </span>
      </div>

      <div className="detail-content">

        {/* Records table */}
        {loading ? (
          <div className="loading">
            <div className="loading-spinner" /> Lade Datensätze...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="records-table">
              <thead>
                <tr>
                  <th>Behalten</th>
                  <th>LIFNR</th>
                  <th>NAME1</th>
                  <th>NAME2</th>
                  <th>ORT01</th>
                  <th>LAND1</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const isBehalten = r.lifnr === lifnrBehalten
                  return (
                    <tr key={r.lifnr} className={isBehalten ? 'row-behalten' : ''}>
                      <td>
                        <label className="radio-behalten">
                          <input
                            type="radio"
                            name="lifnr_behalten"
                            value={r.lifnr}
                            checked={isBehalten}
                            onChange={() => setLifnrBehalten(r.lifnr)}
                          />
                          Behalten
                        </label>
                      </td>
                      <td className="lifnr-cell">{r.lifnr}</td>
                      <td>{r.name1 || '—'}</td>
                      <td style={{ color: 'var(--color-text-light)' }}>{r.name2 || ''}</td>
                      <td>{r.ort01 || '—'}</td>
                      <td>{r.land1 || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        {lifnrBehalten && !loading && (
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', padding: '0.25rem 0' }}>
            Behalten: <strong style={{ color: 'var(--color-success)' }}>{lifnrBehalten}</strong>
            {lifnrLoeschen.length > 0 && (
              <> · Löschen: <strong style={{ color: 'var(--color-error)' }}>{lifnrLoeschen.join(', ')}</strong></>
            )}
          </div>
        )}

        {/* Decision form */}
        <div className="decision-form">
          <h3>Entscheidung</h3>
          <div className="form-group">
            <label>Notiz (optional)</label>
            <textarea
              value={notiz}
              onChange={e => setNotiz(e.target.value)}
              placeholder="Begründung, Hinweise zur Bereinigung..."
            />
          </div>
          <div className="decision-actions">
            <button
              className="btn btn-primary"
              onClick={() => handleSave('bearbeitet')}
              disabled={saving || !lifnrBehalten}
            >
              {saving ? 'Speichern...' : 'Entscheidung speichern'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleSave('ignoriert')}
              disabled={saving}
            >
              Ignorieren
            </button>
            {saved && (
              <span className="save-success">✓ Gespeichert</span>
            )}
          </div>
          {!lifnrBehalten && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
              Bitte zuerst einen Datensatz zum Behalten auswählen.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default DublettenDetail
