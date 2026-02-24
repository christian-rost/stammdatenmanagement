function SimilarityBadge({ score }) {
  const pct = Math.round(score * 100)
  const color = pct >= 85 ? 'var(--color-error)' : pct >= 70 ? 'var(--color-primary)' : 'var(--color-warning)'
  return (
    <span className="badge" style={{ background: `${color}22`, color }}>
      {pct}%
    </span>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      {status === 'offen' ? 'Offen' : status === 'bearbeitet' ? 'Erledigt' : 'Ignoriert'}
    </span>
  )
}

function FuzzyList({ pairs, selected, onSelect, loading, filter, onFilterChange, threshold, onThresholdChange, stats }) {
  const filtered = pairs.filter(p => filter === 'alle' ? true : p.status === filter)

  return (
    <div className="tree-view">
      <div className="tree-view-header">
        Ähnliche Namen (Fuzzy)
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-bar">
          <div className="stat-item"><strong>{stats.gesamt}</strong> Paare</div>
          <div className="stat-item offen"><strong>{stats.offen}</strong> Offen</div>
          <div className="stat-item bearbeitet"><strong>{stats.bearbeitet}</strong> Erledigt</div>
          <div className="stat-item ignoriert"><strong>{stats.ignoriert}</strong> Ignoriert</div>
        </div>
      )}

      {/* Threshold slider */}
      <div className="threshold-bar">
        <label>Schwellwert: <strong>{Math.round(threshold * 100)}%</strong></label>
        <input
          type="range" min="50" max="95" step="5"
          value={Math.round(threshold * 100)}
          onChange={e => onThresholdChange(e.target.value / 100)}
        />
      </div>

      {/* Filter */}
      <div className="filter-bar">
        {['alle', 'offen', 'bearbeitet', 'ignoriert'].map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => onFilterChange(f)}
          >
            {f === 'alle' ? 'Alle' : f === 'offen' ? 'Offen' : f === 'bearbeitet' ? 'Erledigt' : 'Ignoriert'}
          </button>
        ))}
      </div>

      <div className="tree-view-list">
        {loading && (
          <div className="loading">
            <div className="loading-spinner" /> Lade Paare...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="loading" style={{ color: 'var(--color-text-light)', flexDirection: 'column', gap: '0.5rem' }}>
            <span>Keine Einträge</span>
            {filter === 'offen' && pairs.length > 0 && (
              <span style={{ fontSize: '0.8rem' }}>Alle bearbeitet!</span>
            )}
          </div>
        )}

        {!loading && filtered.map(pair => {
          const key = `${pair.lifnr_a}||${pair.lifnr_b}`
          const isSelected = selected && `${selected.lifnr_a}||${selected.lifnr_b}` === key
          return (
            <div
              key={key}
              className={`tree-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(pair)}
            >
              <div className="tree-item-info">
                <div className="tree-item-name" title={pair.name1_a}>{pair.name1_a}</div>
                <div className="tree-item-ort fuzzy-vs">
                  <span>{pair.ort01_a || '—'}</span>
                  <span className="vs-label">vs</span>
                  <span style={{ color: 'var(--color-text)' }} title={pair.name1_b}>{pair.name1_b}</span>
                </div>
                <div className="tree-item-ort">{pair.ort01_b || '—'}</div>
              </div>
              <div className="tree-item-badges">
                <SimilarityBadge score={pair.aehnlichkeit} />
                <StatusBadge status={pair.status} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FuzzyList
