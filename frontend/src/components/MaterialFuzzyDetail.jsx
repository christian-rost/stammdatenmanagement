import { useState, useEffect } from 'react'

const FIELDS = [
  { key: 'matnr',  label: 'MATNR' },
  { key: 'maktx',  label: 'MAKTX' },
  { key: 'maktg',  label: 'MAKTG' },
  { key: 'mtart',  label: 'MTART' },
  { key: 'matkl',  label: 'MATKL' },
  { key: 'meins',  label: 'MEINS' },
  { key: 'mstae',  label: 'MSTAE' },
  { key: 'ersda',  label: 'Angelegt' },
  { key: 'lvorm',  label: 'Löschvm.' },
]

function getValue(rec, key) {
  if (!rec) return ''
  if (key === 'ersda') return rec.ersda ? rec.ersda.slice(0, 10) : ''
  return rec[key] || ''
}

function MaterialFuzzyDetail({ pair, fetchWithAuth, onDecisionSaved }) {
  const [recA, setRecA] = useState(null)
  const [recB, setRecB] = useState(null)
  const [loading, setLoading] = useState(false)
  const [matnrBehalten, setMatnrBehalten] = useState(null)
  const [notiz, setNotiz] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!pair) { setRecA(null); setRecB(null); return }
    loadRecords()
    setMatnrBehalten(pair.matnr_behalten || null)
    setNotiz(pair.notiz || '')
    setSaved(false)
  }, [pair?.matnr_a, pair?.matnr_b])

  async function loadRecords() {
    setLoading(true)
    try {
      const [rA, rB] = await Promise.all([
        fetchWithAuth(`/api/materials/record?matnr=${encodeURIComponent(pair.matnr_a)}`),
        fetchWithAuth(`/api/materials/record?matnr=${encodeURIComponent(pair.matnr_b)}`),
      ])
      setRecA(rA.ok ? await rA.json() : null)
      setRecB(rB.ok ? await rB.json() : null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(statusValue) {
    setSaving(true); setSaved(false)
    try {
      const resp = await fetchWithAuth('/api/materials/fuzzy/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matnr_a: pair.matnr_a,
          matnr_b: pair.matnr_b,
          matnr_behalten: statusValue === 'ignoriert' ? null : matnrBehalten,
          notiz,
          status: statusValue,
        }),
      })
      if (resp.ok) {
        setSaved(true)
        onDecisionSaved(pair.matnr_a, pair.matnr_b, statusValue)
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
            <div className="detail-header-title">Fuzzy-Vergleich (Materialien)</div>
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
            {pair.maktx_a} <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>vs</span> {pair.maktx_b}
          </div>
          <div className="detail-header-sub">Ähnlichkeit: {pct}%</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`badge badge-${pair.status}`}>
            {pair.status === 'offen' ? 'Offen' : pair.status === 'bearbeitet' ? 'Erledigt' : 'Ignoriert'}
          </span>
          {pair.bearbeitet_von && (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem' }}>
              {pair.bearbeitet_von}
            </div>
          )}
        </div>
      </div>

      <div className="detail-content">
        {loading ? (
          <div className="loading"><div className="loading-spinner" /> Lade Datensätze...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="records-table fuzzy-compare-table">
              <thead>
                <tr>
                  <th>Feld</th>
                  <th>
                    <label className="radio-behalten">
                      <input type="radio" name="mat_fuzzy_behalten" value={pair.matnr_a}
                        checked={matnrBehalten === pair.matnr_a}
                        onChange={() => setMatnrBehalten(pair.matnr_a)} />
                      {pair.matnr_a} behalten
                    </label>
                  </th>
                  <th>
                    <label className="radio-behalten">
                      <input type="radio" name="mat_fuzzy_behalten" value={pair.matnr_b}
                        checked={matnrBehalten === pair.matnr_b}
                        onChange={() => setMatnrBehalten(pair.matnr_b)} />
                      {pair.matnr_b} behalten
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map(({ key, label }) => {
                  const vA = getValue(recA, key)
                  const vB = getValue(recB, key)
                  const differs = vA !== vB
                  const lvormStyle = key === 'lvorm'
                    ? (val) => val ? { color: 'var(--color-error)' } : { color: 'var(--color-text-light)' }
                    : () => ({})
                  return (
                    <tr key={key}>
                      <td style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--color-text-light)', textTransform: 'uppercase' }}>
                        {label}
                      </td>
                      <td className={`${matnrBehalten === pair.matnr_a ? 'cell-behalten' : ''} ${differs ? 'cell-differs' : ''}`}
                          style={lvormStyle(vA)}>
                        {vA || <span style={{ color: 'var(--color-gray)' }}>—</span>}
                      </td>
                      <td className={`${matnrBehalten === pair.matnr_b ? 'cell-behalten' : ''} ${differs ? 'cell-differs' : ''}`}
                          style={lvormStyle(vB)}>
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

        <div className="decision-form">
          <h3>Entscheidung</h3>
          <div className="form-group">
            <label>Notiz (optional)</label>
            <textarea value={notiz} onChange={e => setNotiz(e.target.value)}
              placeholder="Sind das Dubletten? Begründung..." />
          </div>
          <div className="decision-actions">
            <button className="btn btn-primary" onClick={() => handleSave('bearbeitet')}
              disabled={saving || !matnrBehalten}>
              {saving ? 'Speichern...' : 'Entscheidung speichern'}
            </button>
            <button className="btn btn-secondary" onClick={() => handleSave('ignoriert')} disabled={saving}>
              Keine Dublette
            </button>
            {saved && <span className="save-success">✓ Gespeichert</span>}
          </div>
          {!matnrBehalten && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
              Bitte ein Material zum Behalten auswählen.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MaterialFuzzyDetail
