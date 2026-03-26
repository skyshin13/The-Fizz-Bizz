import { useEffect, useState } from 'react'
import api from '../lib/api'
import { YeastProfile } from '../types'
import { Dna, Thermometer, FlaskConical, Search, AlertCircle } from 'lucide-react'

const TYPE_COLOR: Record<string, string> = {
  ale: 'var(--amber)', lager: 'var(--slate)', wine: 'var(--rust)',
  SCOBY: 'var(--moss)', wild: 'var(--moss-light)', bread: 'var(--brown-light)',
}

const TYPE_FILTERS = ['All', 'ale', 'lager', 'wine']

export default function YeastsPage() {
  const [yeasts, setYeasts] = useState<YeastProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<YeastProfile | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')

  useEffect(() => {
    api.get('/yeasts')
      .then(r => setYeasts(r.data))
      .catch(() => setError('Could not load the yeast library. The server may be offline.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = yeasts.filter(y => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      y.name.toLowerCase().includes(q) ||
      (y.strain_code?.toLowerCase().includes(q) ?? false) ||
      (y.brand?.toLowerCase().includes(q) ?? false)
    const matchesType = typeFilter === 'All' || y.yeast_type === typeFilter
    return matchesSearch && matchesType
  })

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Page header */}
      <div className="fade-in" style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Yeast Strain Library</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Explore strains, their characteristics, and your personal usage history.
        </p>
      </div>

      {/* Search + type filters */}
      <div className="fade-in" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ position: 'relative', maxWidth: '420px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, strain code, or brand…"
            style={{
              width: '100%', boxSizing: 'border-box',
              paddingLeft: '2.25rem', paddingRight: '1rem', paddingTop: '0.6rem', paddingBottom: '0.6rem',
              borderRadius: '8px', border: '1px solid var(--border-light)',
              background: 'var(--card-bg)', fontSize: '0.875rem', outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {TYPE_FILTERS.map(t => {
            const active = typeFilter === t
            const color = t === 'All' ? 'var(--amber)' : TYPE_COLOR[t] || 'var(--amber)'
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{
                  padding: '0.3rem 0.875rem', borderRadius: '20px', fontSize: '0.78rem',
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: active ? color : 'var(--card-bg)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${active ? 'transparent' : 'var(--border-light)'}`,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧫</div>
          <p style={{ fontSize: '0.875rem' }}>Loading strains…</p>
        </div>
      ) : (
        <div className="fade-in-delay-1" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>

          {/* Left: strain list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {error ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.875rem 1.125rem', background: '#c8832a10', border: '1px solid #c8832a30', borderRadius: '10px', marginBottom: '0.25rem' }}>
                  <AlertCircle size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{error}</p>
                </div>
                {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
              </>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px dashed var(--border-light)', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🧫</div>
                <p style={{ fontSize: '0.875rem' }}>
                  {search || typeFilter !== 'All' ? 'No strains match your search.' : 'No yeast strains in the library yet.'}
                </p>
                <p style={{ fontSize: '0.78rem', marginTop: '0.375rem', opacity: 0.7 }}>
                  Strains added to the library will appear here.
                </p>
              </div>
            ) : filtered.map(yeast => (
              <div
                key={yeast.id}
                onClick={() => setSelected(selected?.id === yeast.id ? null : yeast)}
                style={{
                  background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem',
                  border: `1px solid ${selected?.id === yeast.id ? 'var(--amber)' : 'var(--border-light)'}`,
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: selected?.id === yeast.id ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '0.95rem' }}>{yeast.name}</h3>
                      {yeast.strain_code && (
                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', background: 'var(--parchment)', borderRadius: '4px', color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                          {yeast.strain_code}
                        </span>
                      )}
                    </div>
                    {yeast.brand && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>by {yeast.brand}</p>}
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{yeast.description}</p>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {yeast.yeast_type && (
                      <span style={{ display: 'block', fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '20px', background: `${TYPE_COLOR[yeast.yeast_type] || 'var(--amber)'}18`, color: TYPE_COLOR[yeast.yeast_type] || 'var(--amber)', marginBottom: '0.5rem' }}>
                        {yeast.yeast_type}
                      </span>
                    )}
                    {(yeast.times_used ?? 0) > 0 && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--moss)', fontWeight: 500 }}>
                        Used {yeast.times_used}× by you
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: detail panel */}
          {selected ? (
            <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--amber)', position: 'sticky', top: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧫</div>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{selected.name}</h2>
                {selected.strain_code && <code style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selected.strain_code}</code>}
                {selected.brand && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>by {selected.brand}</p>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginBottom: '1.25rem' }}>
                {selected.temp_range_min_c != null && (
                  <Stat icon={<Thermometer size={14} />} label="Temp Range" value={`${selected.temp_range_min_c}–${selected.temp_range_max_c}°C`} />
                )}
                {selected.attenuation_min != null && (
                  <Stat icon={<FlaskConical size={14} />} label="Attenuation" value={`${selected.attenuation_min}–${selected.attenuation_max}%`} />
                )}
                {selected.alcohol_tolerance != null && (
                  <Stat icon={<Dna size={14} />} label="Alcohol Tolerance" value={`Up to ${selected.alcohol_tolerance}% ABV`} />
                )}
                {selected.flocculation && (
                  <Stat icon={<Dna size={14} />} label="Flocculation" value={selected.flocculation.charAt(0).toUpperCase() + selected.flocculation.slice(1)} />
                )}
              </div>

              {selected.flavor_notes && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Flavor Notes</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selected.flavor_notes}</p>
                </div>
              )}

              {(selected.times_used ?? 0) > 0 && (
                <div style={{ padding: '0.875rem', background: '#4a674112', borderRadius: '8px', border: '1px solid #4a674130' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--moss)', marginBottom: '0.375rem' }}>
                    You've used this strain {selected.times_used} time{selected.times_used !== 1 ? 's' : ''}
                  </div>
                  {selected.user_projects && selected.user_projects.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--moss)' }}>
                      In: {selected.user_projects.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <DetailPlaceholder />
          )}
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem', border: '1px dashed var(--border-light)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ height: '13px', width: '42%', background: 'var(--parchment)', borderRadius: '4px', marginBottom: '0.5rem' }} />
          <div style={{ height: '11px', width: '26%', background: 'var(--parchment)', borderRadius: '4px', marginBottom: '0.625rem', opacity: 0.6 }} />
          <div style={{ height: '10px', width: '88%', background: 'var(--parchment)', borderRadius: '4px', opacity: 0.45 }} />
        </div>
        <div style={{ height: '22px', width: '50px', background: 'var(--parchment)', borderRadius: '20px', opacity: 0.35 }} />
      </div>
    </div>
  )
}

function DetailPlaceholder() {
  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.75rem 1.5rem', border: '1px dashed var(--border-light)', position: 'sticky', top: '1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧫</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Select a strain to view details</p>
      </div>

      {/* Placeholder stat rows */}
      {['Temp Range', 'Attenuation', 'Alcohol Tolerance', 'Flocculation'].map(label => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', opacity: 0.45 }}>{label}</span>
          <div style={{ height: '10px', width: '64px', background: 'var(--parchment)', borderRadius: '4px', opacity: 0.35 }} />
        </div>
      ))}

      <div style={{ marginTop: '1.25rem' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', opacity: 0.4 }}>Flavor Notes</div>
        <div style={{ height: '10px', width: '92%', background: 'var(--parchment)', borderRadius: '4px', opacity: 0.28, marginBottom: '0.4rem' }} />
        <div style={{ height: '10px', width: '72%', background: 'var(--parchment)', borderRadius: '4px', opacity: 0.28 }} />
      </div>

      <div style={{ marginTop: '1.5rem', padding: '0.875rem', background: 'var(--parchment)', borderRadius: '8px', opacity: 0.35 }}>
        <div style={{ height: '10px', width: '55%', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '0.375rem' }} />
        <div style={{ height: '10px', width: '40%', background: 'var(--border-light)', borderRadius: '4px' }} />
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {icon} {label}
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
