function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      {status === 'offen' ? 'Offen' : status === 'bearbeitet' ? 'Erledigt' : 'Ignoriert'}
    </span>
  )
}

function MaterialList({ groups, selected, onSelect, loading, filter, onFilterChange, stats }) {
  const filtered = groups.filter(g => filter === 'alle' ? true : g.status === filter)

  return (
    <div className="tree-view">
      <div className="tree-view-header">
        Material-Dubletten (Exakt)
      </div>

      {stats && (
        <div className="stats-bar">
          <div className="stat-item"><strong>{stats.gesamt}</strong> Gesamt</div>
          <div className="stat-item offen"><strong>{stats.offen}</strong> Offen</div>
          <div className="stat-item bearbeitet"><strong>{stats.bearbeitet}</strong> Erledigt</div>
          <div className="stat-item ignoriert"><strong>{stats.ignoriert}</strong> Ignoriert</div>
        </div>
      )}

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
            <div className="loading-spinner" /> Lade Gruppen...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="loading" style={{ color: 'var(--color-text-light)' }}>
            Keine Einträge
          </div>
        )}

        {!loading && filtered.map(group => {
          const isSelected = selected?.maktg === group.maktg
          return (
            <div
              key={group.maktg}
              className={`tree-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(group)}
            >
              <div className="tree-item-info">
                <div className="tree-item-name" title={group.maktx}>{group.maktx || group.maktg}</div>
                <div className="tree-item-ort" style={{ fontSize: '0.72rem' }}>{group.maktg}</div>
              </div>
              <div className="tree-item-badges">
                <span className="badge badge-count">{group.anzahl}×</span>
                <StatusBadge status={group.status} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MaterialList
