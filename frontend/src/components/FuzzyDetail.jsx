import { useState, useEffect } from 'react'

const FIELDS = [
  { key: 'lifnr', label: 'LIFNR' },
  { key: 'name1', label: 'NAME1' },
  { key: 'name2', label: 'NAME2' },
  { key: 'name3', label: 'NAME3' },
  { key: 'ort01', label: 'ORT01' },
  { key: 'ort02', label: 'ORT02' },
  { key: 'land1', label: 'LAND1' },
]

function FuzzyDetail({ pair, fetchWithAuth, onDecisionSaved }) {
  const [recA, setRecA] = useState(null)
  const [recB, setRecB] = useState(null)
  const [loading, setLoading] = useState(false)
  const [lifnrBehalten, setLifnrBehalten] = useState(null)
  const [notiz, setNotiz] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!pair) { setRecA(null); setRecB(null); return }
    loadRecords()
    setLifnrBehalten(pair.lifnr_behalten || null)
    setNotiz(pair.notiz || '')
    setSaved(false)
  }, [pair])

  async function loadRecords() {
    setLoading(true)
    try {
      const [rA, rB] = await Promise.all([
        fetchWithAuth(`/api/duplicates/records?name1=${encodeURIComponent(pair.name1_a)}&ort01=${encodeURIComponent(pair.ort01_a)}`),
        fetchWithAuth(`/api/duplicates/records?name1=${encodeURIComponent(pair.name1_b)}&ort01=${encodeURIComponent(pair.ort01_b)}`),
      ])
      const dataA = rA.ok ? await rA.json() : []
      const dataB = rB.ok ? await rB.json() : []
      setRecA(dataA.find(r => r.lifnr === pair.lifnr_a) || null)
      setRecB(dataB.find(r => r.lifnr === pair.lifnr_b) || null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(statusValue) {
    setSaving(true); setSaved(false)
    try {
      const resp = await fetchWithAuth('/api/fuzzy/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lifnr_a: pair.lifnr_a,
          lifnr_b: pair.lifnr_b,
          lifnr_behalten: statusValue === 'ignoriert' ? null : lifnrBehalten,
          notiz,
          status: statusValue,
        })
      })
      if (resp.ok) {
        setSaved(true)
        onDecisionSaved(pair.lifnr_a, pair.lifnr_b, statusValue)
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!pair) {
    return (
      <div className="detail-view">
        <div className="detail-header">
          <div>
            <div className="detail-header-title">Fuzzy-Vergleich</div>
            <div className="detail-header-sub">Paar aus der Liste auswählen</div>
          </div>
        </div>
        <div className="detail-placeholder">← Bitte ein Ähnlichkeits-Paar auswählen</div>
      </div>
    )
  }

  const pct = Math.round(pair.aehnlichkeit * 100)
  const simColor = pct >= 85 ? 'var(--color-error)' : pct >= 70 ? 'var(--color-primary)' : 'var(--color-warning)'

  return (
    <div className="detail-view">
      <div className="detail-header">
        <div>
          <div className="detail-header-title">
            {pair.name1_a} <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>vs</span> {pair.name1_b}
          </div>
          <div className="detail-header-sub">Ähnlichkeit: {pct}%</div>
        </div>
        <span className={`badge badge-${pair.status}`}>
          {pair.status === 'offen' ? 'Offen' : pair.status === 'bearbeitet' ? 'Erledigt' : 'Ignoriert'}
        </span>
      </div>

      <div className="detail-content">

        {loading ? (
          <div className="loading"><div className="loading-spinner" /> Lade Datensätze...</div>
        ) : (
          /* Side-by-side comparison table */
          <div style={{ overflowX: 'auto' }}>
            <table className="records-table fuzzy-compare-table">
              <thead>
                <tr>
                  <th>Feld</th>
                  <th>
                    <label className="radio-behalten">
                      <input type="radio" name="fuzzy_behalten" value={pair.lifnr_a}
                        checked={lifnrBehalten === pair.lifnr_a}
                        onChange={() => setLifnrBehalten(pair.lifnr_a)} />
                      {pair.lifnr_a} behalten
                    </label>
                  </th>
                  <th>
                    <label className="radio-behalten">
                      <input type="radio" name="fuzzy_behalten" value={pair.lifnr_b}
                        checked={lifnrBehalten === pair.lifnr_b}
                        onChange={() => setLifnrBehalten(pair.lifnr_b)} />
                      {pair.lifnr_b} behalten
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map(({ key, label }) => {
                  const vA = recA?.[key] || ''
                  const vB = recB?.[key] || ''
                  const differs = vA !== vB
                  return (
                    <tr key={key}>
                      <td style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--color-text-light)', textTransform: 'uppercase' }}>
                        {label}
                      </td>
                      <td className={`${lifnrBehalten === pair.lifnr_a ? 'cell-behalten' : ''} ${differs ? 'cell-differs' : ''}`}>
                        {vA || <span style={{ color: 'var(--color-gray)' }}>—</span>}
                      </td>
                      <td className={`${lifnrBehalten === pair.lifnr_b ? 'cell-behalten' : ''} ${differs ? 'cell-differs' : ''}`}>
                        {vB || <span style={{ color: 'var(--color-gray)' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
                <tr>
                  <td style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--color-text-light)', textTransform: 'uppercase' }}>
                    Ähnlichkeit
                  </td>
                  <td colSpan={2}>
                    <div className="similarity-bar-wrap">
                      <div className="similarity-bar" style={{ width: `${pct}%`, background: simColor }} />
                      <span style={{ color: simColor, fontWeight: 600 }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Decision form */}
        <div className="decision-form">
          <h3>Entscheidung</h3>
          <div className="form-group">
            <label>Notiz (optional)</label>
            <textarea value={notiz} onChange={e => setNotiz(e.target.value)}
              placeholder="Sind das Dubletten? Begründung..." />
          </div>
          <div className="decision-actions">
            <button className="btn btn-primary" onClick={() => handleSave('bearbeitet')}
              disabled={saving || !lifnrBehalten}>
              {saving ? 'Speichern...' : 'Entscheidung speichern'}
            </button>
            <button className="btn btn-secondary" onClick={() => handleSave('ignoriert')} disabled={saving}>
              Keine Dublette
            </button>
            {saved && <span className="save-success">✓ Gespeichert</span>}
          </div>
          {!lifnrBehalten && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
              Bitte einen Datensatz zum Behalten auswählen.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FuzzyDetail
