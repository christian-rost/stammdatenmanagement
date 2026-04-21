import { useState, useEffect } from 'react'

function DecisionBanner({ decision, allMatnrs }) {
  if (!decision || decision.status === 'offen') return null

  let typ, typColor
  if (decision.status === 'ignoriert') {
    typ = 'Ignoriert'
    typColor = 'var(--color-text-light)'
  } else if (decision.matnr_behalten) {
    typ = null
  } else if (!decision.matnr_loeschen || decision.matnr_loeschen.length === 0) {
    typ = 'Alle behalten'
    typColor = 'var(--color-success)'
  } else {
    typ = 'Alle löschen'
    typColor = 'var(--color-error)'
  }

  const datum = decision.bearbeitet_am
    ? new Date(decision.bearbeitet_am).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
    : null

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '6px',
      padding: '0.75rem 1rem',
      marginBottom: '0.75rem',
      fontSize: '0.85rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <span style={{ color: 'var(--color-text-light)', marginRight: '0.5rem' }}>Gespeicherte Entscheidung:</span>
          {typ ? (
            <strong style={{ color: typColor }}>{typ}</strong>
          ) : (
            <>
              <span style={{ color: 'var(--color-text-light)' }}>Behalten: </span>
              <strong style={{ color: 'var(--color-success)' }}>{decision.matnr_behalten}</strong>
              {decision.matnr_loeschen?.length > 0 && (
                <>
                  <span style={{ color: 'var(--color-text-light)', margin: '0 0.4rem' }}>· Löschen: </span>
                  <strong style={{ color: 'var(--color-error)' }}>{decision.matnr_loeschen.join(', ')}</strong>
                </>
              )}
            </>
          )}
          {decision.notiz && (
            <div style={{ marginTop: '0.3rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>
              „{decision.notiz}"
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--color-text-light)', flexShrink: 0 }}>
          {decision.bearbeitet_von && <div>{decision.bearbeitet_von}</div>}
          {datum && <div>{datum}</div>}
        </div>
      </div>
    </div>
  )
}

function MaterialDetail({ group, fetchWithAuth, onDecisionSaved }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [decision, setDecision] = useState(null)
  const [matnrBehalten, setMatnrBehalten] = useState(null)
  const [notiz, setNotiz] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!group) { setRecords([]); setDecision(null); return }
    loadRecords()
    loadDecision()
    setMatnrBehalten(group.matnr_behalten || null)
    setNotiz(group.notiz || '')
    setSaved(false)
  }, [group?.maktg])

  async function loadRecords() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ maktg: group.maktg })
      const resp = await fetchWithAuth(`/api/materials/duplicates/records?${params}`)
      if (resp.ok) setRecords(await resp.json())
    } finally {
      setLoading(false)
    }
  }

  async function loadDecision() {
    const resp = await fetchWithAuth(`/api/materials/decisions/${encodeURIComponent(group.maktg)}`)
    if (resp.ok) setDecision(await resp.json())
    else setDecision(null)
  }

  async function handleSave(statusValue, behalten = matnrBehalten, loeschenList = null) {
    setSaving(true); setSaved(false)
    const defaultLoeschen = records.map(r => r.matnr).filter(m => m !== behalten)
    const loeschen = loeschenList !== null ? loeschenList : defaultLoeschen
    try {
      const resp = await fetchWithAuth('/api/materials/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maktg: group.maktg,
          matnr_behalten: statusValue === 'ignoriert' ? null : behalten,
          matnr_loeschen: statusValue === 'ignoriert' ? [] : loeschen,
          notiz,
          status: statusValue,
        }),
      })
      if (resp.ok) {
        setSaved(true)
        onDecisionSaved(group.maktg, statusValue)
        loadDecision()
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
            <div className="detail-header-title">Material-Dubletten</div>
            <div className="detail-header-sub">Gruppe aus der Liste auswählen</div>
          </div>
        </div>
        <div className="detail-placeholder">← Bitte eine Dubletten-Gruppe auswählen</div>
      </div>
    )
  }

  const matnrLoeschen = records.map(r => r.matnr).filter(m => m !== matnrBehalten)

  return (
    <div className="detail-view">
      <div className="detail-header">
        <div>
          <div className="detail-header-title">{group.maktx || group.maktg}</div>
          <div className="detail-header-sub">{group.anzahl} Datensätze · MAKTG: {group.maktg}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`badge badge-${group.status}`}>
            {group.status === 'offen' ? 'Offen' : group.status === 'bearbeitet' ? 'Erledigt' : 'Ignoriert'}
          </span>
          {group.bearbeitet_von && (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem' }}>
              {group.bearbeitet_von}
            </div>
          )}
        </div>
      </div>

      <div className="detail-content">
        <DecisionBanner decision={decision} />

        {loading ? (
          <div className="loading"><div className="loading-spinner" /> Lade Datensätze...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="records-table">
              <thead>
                <tr>
                  <th>Behalten</th>
                  <th>MATNR</th>
                  <th>MAKTX</th>
                  <th>MAKTG</th>
                  <th>MTART</th>
                  <th>MATKL</th>
                  <th>MEINS</th>
                  <th>MSTAE</th>
                  <th>MFRPN</th>
                  <th>Angelegt</th>
                  <th>Löschvm.</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const isBehalten = r.matnr === matnrBehalten
                  return (
                    <tr key={r.matnr} className={isBehalten ? 'row-behalten' : ''}>
                      <td>
                        <label className="radio-behalten">
                          <input
                            type="radio"
                            name="matnr_behalten"
                            value={r.matnr}
                            checked={isBehalten}
                            onChange={() => setMatnrBehalten(r.matnr)}
                          />
                          Behalten
                        </label>
                      </td>
                      <td className="lifnr-cell">{r.matnr}</td>
                      <td>{r.maktx || '—'}</td>
                      <td style={{ color: 'var(--color-text-light)' }}>{r.maktg || '—'}</td>
                      <td style={{ color: 'var(--color-text-light)' }}>{r.mtart || '—'}</td>
                      <td style={{ color: 'var(--color-text-light)' }}>{r.matkl || '—'}</td>
                      <td style={{ color: 'var(--color-text-light)' }}>{r.meins || '—'}</td>
                      <td style={{ color: 'var(--color-text-light)' }}>{r.mstae || '—'}</td>
                      <td style={{ color: 'var(--color-text-light)' }}>{r.mfrpn || '—'}</td>
                      <td style={{ color: 'var(--color-text-light)' }}>
                        {r.ersda ? r.ersda.slice(0, 10) : ''}
                      </td>
                      <td style={{ color: r.lvorm ? 'var(--color-error)' : 'var(--color-text-light)' }}>
                        {r.lvorm || ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {matnrBehalten && !loading && (
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', padding: '0.25rem 0' }}>
            Behalten: <strong style={{ color: 'var(--color-success)' }}>{matnrBehalten}</strong>
            {matnrLoeschen.length > 0 && (
              <> · Löschen: <strong style={{ color: 'var(--color-error)' }}>{matnrLoeschen.join(', ')}</strong></>
            )}
          </div>
        )}

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
              disabled={saving || !matnrBehalten}
            >
              {saving ? 'Speichern...' : 'Entscheidung speichern'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleSave('bearbeitet', null, [])}
              disabled={saving}
              title="Alle Materialien dieser Gruppe behalten, keines löschen"
            >
              Alle behalten
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleSave('bearbeitet', null, records.map(r => r.matnr))}
              disabled={saving}
              title="Alle Materialien dieser Gruppe löschen"
            >
              Alle löschen
            </button>
            <button className="btn btn-secondary" onClick={() => handleSave('ignoriert')} disabled={saving}>
              Ignorieren
            </button>
            {saved && <span className="save-success">✓ Gespeichert</span>}
          </div>
          {!matnrBehalten && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
              Bitte ein Material zum Behalten auswählen — oder „Alle behalten" / „Alle löschen" verwenden.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MaterialDetail
