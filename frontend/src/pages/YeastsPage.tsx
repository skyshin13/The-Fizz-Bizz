import { useEffect, useState } from 'react'
import api from '../lib/api'
import { YeastProfile } from '../types'
import { Dna, Thermometer, FlaskConical } from 'lucide-react'

const TYPE_COLOR: Record<string, string> = {
  ale: 'var(--amber)', lager: 'var(--slate)', wine: 'var(--rust)',
  SCOBY: 'var(--moss)', wild: 'var(--moss-light)', bread: 'var(--brown-light)',
}

export default function YeastsPage() {
  const [yeasts, setYeasts] = useState<YeastProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<YeastProfile | null>(null)

  useEffect(() => {
    api.get('/yeasts').then(r => setYeasts(r.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div className="fade-in" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Yeast Strain Library</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Explore strains, their characteristics, and your usage history.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Loading strains...</div>
      ) : (
        <div className="fade-in-delay-1" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {yeasts.map(yeast => (
              <div
                key={yeast.id}
                onClick={() => setSelected(yeast)}
                style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem', border: `1px solid ${selected?.id === yeast.id ? 'var(--amber)' : 'var(--border-light)'}`, cursor: 'pointer', transition: 'all 0.2s', boxShadow: selected?.id === yeast.id ? 'var(--shadow-md)' : 'var(--shadow-sm)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
                      <h3 style={{ fontSize: '0.95rem' }}>{yeast.name}</h3>
                      {yeast.strain_code && <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', background: 'var(--parchment)', borderRadius: '4px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{yeast.strain_code}</span>}
                    </div>
                    {yeast.brand && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>by {yeast.brand}</p>}
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

          {/* Detail panel */}
          {selected ? (
            <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-light)', position: 'sticky', top: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧫</div>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{selected.name}</h2>
                {selected.strain_code && <code style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selected.strain_code}</code>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {selected.temp_range_min_c && (
                  <Stat icon={<Thermometer size={14} />} label="Temp Range" value={`${selected.temp_range_min_c}–${selected.temp_range_max_c}°C`} />
                )}
                {selected.attenuation_min && (
                  <Stat icon={<FlaskConical size={14} />} label="Attenuation" value={`${selected.attenuation_min}–${selected.attenuation_max}%`} />
                )}
                {selected.alcohol_tolerance && (
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
            <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '2rem', border: '1px solid var(--border-light)', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧫</div>
              <p>Select a strain to see details</p>
            </div>
          )}
        </div>
      )}
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
