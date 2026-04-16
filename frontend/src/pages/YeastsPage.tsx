import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { YeastProfile } from '../types'
import { Dna, Thermometer, FlaskConical, Search, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react'
import styles from './YeastsPage.module.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  ale:   'var(--amber)',
  lager: 'var(--slate)',
  wine:  'var(--rust)',
  SCOBY: 'var(--moss)',
  wild:  'var(--moss-light)',
  bread: 'var(--brown-light)',
}

const TYPE_FILTERS = ['All', 'ale', 'lager', 'wine']

interface BrewCategory {
  label: string
  keywords: string[]
}

const BREW_CATEGORIES: BrewCategory[] = [
  { label: 'IPA',         keywords: ['ipa', 'india pale ale'] },
  { label: 'Pale Ale',    keywords: ['pale ale'] },
  { label: 'Stout',       keywords: ['stout'] },
  { label: 'Porter',      keywords: ['porter'] },
  { label: 'Wheat',       keywords: ['wheat', 'weizen', 'hefeweizen', 'wit'] },
  { label: 'Belgian',     keywords: ['belgian', 'saison', 'dubbel', 'tripel', 'quad', 'abbey'] },
  { label: 'Lager',       keywords: ['lager', 'pilsner', 'pils', 'bock'] },
  { label: 'English Ale', keywords: ['bitter', 'mild', 'esb', 'english'] },
  { label: 'Scottish',    keywords: ['scottish', 'wee heavy'] },
  { label: 'Sour / Wild', keywords: ['sour', 'wild', 'brett', 'lambic', 'gose', 'berliner'] },
  { label: 'Cider',       keywords: ['cider'] },
  { label: 'Wine',        keywords: ['wine'] },
  { label: 'Mead',        keywords: ['mead'] },
  { label: 'Barleywine',  keywords: ['barleywine', 'barley wine'] },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesBrewCategory(yeast: YeastProfile, category: BrewCategory | null): boolean {
  if (!category) return true
  const text = (yeast.best_for ?? yeast.description ?? '').toLowerCase()
  return category.keywords.some(kw => text.includes(kw))
}

function attenuationLabel(y: YeastProfile): string | null {
  if (y.attenuation_min == null) return null
  if (y.attenuation_max == null || y.attenuation_min === y.attenuation_max)
    return `${y.attenuation_min}%`
  return `${y.attenuation_min}–${y.attenuation_max}%`
}

function tempLabel(y: YeastProfile): string | null {
  if (y.temp_range_min_c == null) return null
  const toF = (c: number) => Math.round(c * 9 / 5 + 32)
  return `${toF(y.temp_range_min_c)}–${toF(y.temp_range_max_c!)}°F  (${y.temp_range_min_c}–${y.temp_range_max_c}°C)`
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function YeastsPage() {
  const [yeasts, setYeasts]           = useState<YeastProfile[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [selected, setSelected]       = useState<YeastProfile | null>(null)
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState('All')
  const [brewCategory, setBrewCategory] = useState<BrewCategory | null>(null)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    api.get('/yeasts/')
      .then(r => {
        setYeasts(r.data)
        const targetId = searchParams.get('yeast')
        if (targetId) {
          const match = r.data.find((y: YeastProfile) => y.id === parseInt(targetId))
          if (match) setSelected(match)
        }
      })
      .catch(() => setError('Could not load the yeast library. The server may be offline.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return yeasts.filter(y => {
      const matchesSearch = !q ||
        y.name.toLowerCase().includes(q) ||
        (y.strain_code?.toLowerCase().includes(q) ?? false) ||
        (y.brand?.toLowerCase().includes(q) ?? false) ||
        (y.best_for?.toLowerCase().includes(q) ?? false)
      const matchesType     = typeFilter === 'All' || y.yeast_type === typeFilter
      const matchesBrew     = matchesBrewCategory(y, brewCategory)
      return matchesSearch && matchesType && matchesBrew
    })
  }, [yeasts, search, typeFilter, brewCategory])

  const activeFilters = (search ? 1 : 0) + (typeFilter !== 'All' ? 1 : 0) + (brewCategory ? 1 : 0)
  const clearAll = () => { setSearch(''); setTypeFilter('All'); setBrewCategory(null) }

  return (
    <div className={styles.page}>

      {/* Page header */}
      <div className="fade-in" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Yeast Strain Library</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {yeasts.length > 0
            ? `${yeasts.length} strains from the BrewUnited database`
            : 'Explore strains, their characteristics, and your personal usage history.'}
        </p>
      </div>

      {/* ── What do you want to brew? ── */}
      <div className="fade-in" style={{
        background: 'var(--card-bg)', borderRadius: '14px',
        border: '1px solid var(--border-light)', padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
          What do you want to brew?
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
          {BREW_CATEGORIES.map(cat => {
            const active = brewCategory?.label === cat.label
            return (
              <button
                key={cat.label}
                onClick={() => setBrewCategory(active ? null : cat)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.4rem 0.875rem', borderRadius: '20px',
                  fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s',
                  background: active ? 'var(--amber)' : 'var(--parchment)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${active ? 'var(--amber)' : 'transparent'}`,
                  fontWeight: active ? 600 : 400,
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {cat.label}
              </button>
            )
          })}
        </div>
        {brewCategory && (
          <div style={{ marginTop: '0.875rem', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Showing strains good for <strong style={{ color: 'var(--amber)' }}>{brewCategory.label}</strong></span>
            <button
              onClick={() => setBrewCategory(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0' }}
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* ── Search + type filters ── */}
      <div className="fade-in" style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, strain code, brand, or use…"
              style={{
                width: '100%', boxSizing: 'border-box',
                paddingLeft: '2.25rem', paddingRight: search ? '2.25rem' : '1rem',
                paddingTop: '0.6rem', paddingBottom: '0.6rem',
                borderRadius: '8px', border: '1px solid var(--border-light)',
                background: 'var(--card-bg)', fontSize: '0.875rem', outline: 'none',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <X size={13} />
              </button>
            )}
          </div>

          {activeFilters > 0 && (
            <button onClick={clearAll} style={{ fontSize: '0.78rem', color: 'var(--amber)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', padding: '0.25rem 0' }}>
              Clear all filters ({activeFilters})
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Type:</span>
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

      {/* Results count */}
      {!loading && !error && yeasts.length > 0 && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          {filtered.length === yeasts.length
            ? `${yeasts.length} strains`
            : `${filtered.length} of ${yeasts.length} strains`}
        </div>
      )}

      {/* ── Main content ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧫</div>
          <p style={{ fontSize: '0.875rem' }}>Loading strains…</p>
        </div>
      ) : (
        <div className={`fade-in-delay-1 ${styles.layout}`}>

          {/* Left: strain list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {error ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.875rem 1.125rem', background: '#c8832a10', border: '1px solid #c8832a30', borderRadius: '10px', marginBottom: '0.25rem' }}>
                  <AlertCircle size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{error}</p>
                </div>
                {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
              </>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px dashed var(--border-light)', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🧫</div>
                <p style={{ fontSize: '0.875rem' }}>No strains match your filters.</p>
                <p style={{ fontSize: '0.78rem', marginTop: '0.375rem', opacity: 0.7 }}>Try adjusting your search or brew type selection.</p>
                {activeFilters > 0 && (
                  <button onClick={clearAll} style={{ marginTop: '1rem', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', background: 'var(--amber)', color: '#fff', border: 'none' }}>
                    Clear filters
                  </button>
                )}
              </div>
            ) : filtered.map(yeast => (
              <YeastCard
                key={yeast.id}
                yeast={yeast}
                selected={selected?.id === yeast.id}
                onClick={() => setSelected(selected?.id === yeast.id ? null : yeast)}
              />
            ))}
          </div>

          {/* Right: detail panel */}
          {selected ? (
            <DetailPanel yeast={selected} onClose={() => setSelected(null)} />
          ) : (
            <DetailPlaceholder />
          )}
        </div>
      )}
    </div>
  )
}

// ── Yeast Card ────────────────────────────────────────────────────────────────

function YeastCard({ yeast, selected, onClick }: { yeast: YeastProfile; selected: boolean; onClick: () => void }) {
  const typeColor = TYPE_COLOR[yeast.yeast_type ?? ''] || 'var(--amber)'
  const attenuation = attenuationLabel(yeast)

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--card-bg)', borderRadius: '12px', padding: '1.125rem 1.25rem',
        border: `1px solid ${selected ? 'var(--amber)' : 'var(--border-light)'}`,
        cursor: 'pointer', transition: 'all 0.18s',
        boxShadow: selected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + strain code */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '0.93rem' }}>{yeast.name}</h3>
            {yeast.strain_code && (
              <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', background: 'var(--parchment)', borderRadius: '4px', color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                {yeast.strain_code}
              </span>
            )}
          </div>

          {/* Brand */}
          {yeast.brand && (
            <p style={{ fontSize: '0.77rem', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>{yeast.brand}</p>
          )}

          {/* Description snippet */}
          {yeast.description && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: yeast.best_for ? '0.5rem' : 0 }}>
              {yeast.description.length > 120 ? yeast.description.slice(0, 120) + '…' : yeast.description}
            </p>
          )}

          {/* Best for tag */}
          {yeast.best_for && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', marginTop: '0.375rem' }}>
              <span style={{ fontSize: '0.67rem', fontWeight: 600, color: 'var(--moss)', whiteSpace: 'nowrap', paddingTop: '1px' }}>Best for:</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--moss)', lineHeight: 1.4 }}>
                {yeast.best_for.length > 80 ? yeast.best_for.slice(0, 80) + '…' : yeast.best_for}
              </span>
            </div>
          )}
        </div>

        {/* Right badges */}
        <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          {yeast.yeast_type && (
            <span style={{ fontSize: '0.68rem', padding: '0.18rem 0.55rem', borderRadius: '20px', background: `${typeColor}18`, color: typeColor }}>
              {yeast.yeast_type}
            </span>
          )}
          {attenuation && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{attenuation}</span>
          )}
          {(yeast.times_used ?? 0) > 0 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--moss)', fontWeight: 500 }}>
              Used {yeast.times_used}×
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ yeast, onClose }: { yeast: YeastProfile; onClose: () => void }) {
  const [notesExpanded, setNotesExpanded] = useState(false)
  const navigate = useNavigate()
  const typeColor = TYPE_COLOR[yeast.yeast_type ?? ''] || 'var(--amber)'
  const attenuation = attenuationLabel(yeast)
  const temp = tempLabel(yeast)
  const descNeedsExpand = (yeast.description?.length ?? 0) > 200

  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: '14px', padding: '1.5rem',
      border: '1px solid var(--amber)', position: 'sticky', top: '1.5rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🧫</div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.2rem', lineHeight: 1.3 }}>{yeast.name}</h2>
          {yeast.strain_code && <code style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{yeast.strain_code}</code>}
          {yeast.brand && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{yeast.brand}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
          {yeast.yeast_type && (
            <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '20px', background: `${typeColor}18`, color: typeColor }}>
              {yeast.yeast_type}
            </span>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0', marginTop: '0.25rem' }}>
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginBottom: '1.25rem' }}>
        {temp && <Stat icon={<Thermometer size={13} />} label="Temp Range" value={temp} />}
        {attenuation && <Stat icon={<FlaskConical size={13} />} label="Attenuation" value={attenuation} />}
        {yeast.alcohol_tolerance != null && (
          <Stat icon={<Dna size={13} />} label="Alcohol Tolerance" value={`Up to ${yeast.alcohol_tolerance}% ABV`} />
        )}
        {yeast.flocculation && (
          <Stat icon={<Dna size={13} />} label="Flocculation" value={yeast.flocculation.charAt(0).toUpperCase() + yeast.flocculation.slice(1)} />
        )}
      </div>

      {/* Best For — primary highlight */}
      {yeast.best_for && (
        <div style={{ marginBottom: '1.125rem', padding: '0.875rem 1rem', background: '#4a674112', borderRadius: '10px', border: '1px solid #4a674130' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--moss)', marginBottom: '0.375rem' }}>
            Best For
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--moss)', lineHeight: 1.55 }}>{yeast.best_for}</p>
        </div>
      )}

      {/* Recommended Styles */}
      {yeast.recommended_styles && yeast.recommended_styles.length > 0 && (
        <div style={{ marginBottom: '1.125rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Recommended Styles</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {yeast.recommended_styles.map(style => (
              <span key={style} style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '20px', background: 'var(--parchment)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
                {style}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lab Description */}
      {yeast.lab_description && (
        <div style={{ marginBottom: '1.125rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Lab Description</div>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{yeast.lab_description}</p>
        </div>
      )}

      {/* Notes / Description */}
      {yeast.description && (
        <div style={{ marginBottom: '1.125rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Notes</div>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {descNeedsExpand && !notesExpanded
              ? yeast.description.slice(0, 200) + '…'
              : yeast.description}
          </p>
          {descNeedsExpand && (
            <button
              onClick={() => setNotesExpanded(v => !v)}
              style={{ marginTop: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0' }}
            >
              {notesExpanded ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Show more</>}
            </button>
          )}
        </div>
      )}

      {/* Flavor notes */}
      {yeast.flavor_notes && (
        <div style={{ marginBottom: '1.125rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Flavor Notes</div>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{yeast.flavor_notes}</p>
        </div>
      )}

      {/* Linked recipes */}
      {(yeast.linked_recipes ?? []).length > 0 && (
        <div style={{ marginBottom: '1.125rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Featured In Recipes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {yeast.linked_recipes!.map(r => (
              <button
                key={r.id}
                onClick={() => navigate(`/recipes?recipe=${r.id}`)}
                style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--amber)', padding: '0', textDecoration: 'underline', textUnderlineOffset: '2px', opacity: 0.9 }}
              >
                → {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Your usage */}
      {(yeast.times_used ?? 0) > 0 && (
        <div style={{ padding: '0.875rem', background: '#4a674112', borderRadius: '8px', border: '1px solid #4a674130' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--moss)', marginBottom: yeast.user_projects?.length ? '0.5rem' : '0' }}>
            You've used this strain {yeast.times_used} time{yeast.times_used !== 1 ? 's' : ''}
          </div>
          {yeast.user_projects && yeast.user_projects.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {yeast.user_projects.map(p => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  style={{ fontSize: '0.75rem', color: 'var(--moss)', textDecoration: 'underline', textUnderlineOffset: '2px', opacity: 0.85 }}
                >
                  → {p.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Skeleton / Placeholder ────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.125rem 1.25rem', border: '1px dashed var(--border-light)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ height: '13px', width: '42%', background: 'var(--parchment)', borderRadius: '4px', marginBottom: '0.5rem' }} />
          <div style={{ height: '11px', width: '26%', background: 'var(--parchment)', borderRadius: '4px', marginBottom: '0.625rem', opacity: 0.6 }} />
          <div style={{ height: '10px', width: '88%', background: 'var(--parchment)', borderRadius: '4px', opacity: 0.45 }} />
          <div style={{ height: '10px', width: '65%', background: 'var(--parchment)', borderRadius: '4px', opacity: 0.35, marginTop: '0.35rem' }} />
        </div>
        <div style={{ height: '22px', width: '50px', background: 'var(--parchment)', borderRadius: '20px', opacity: 0.35 }} />
      </div>
    </div>
  )
}

function DetailPlaceholder() {
  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '14px', padding: '1.75rem 1.5rem', border: '1px dashed var(--border-light)', position: 'sticky', top: '1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧫</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Select a strain to view details</p>
      </div>

      {['Temp Range', 'Attenuation', 'Alcohol Tolerance', 'Flocculation'].map(label => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', opacity: 0.45 }}>{label}</span>
          <div style={{ height: '10px', width: '64px', background: 'var(--parchment)', borderRadius: '4px', opacity: 0.35 }} />
        </div>
      ))}

      <div style={{ marginTop: '1.25rem', padding: '0.875rem', background: 'var(--parchment)', borderRadius: '10px', opacity: 0.35 }}>
        <div style={{ height: '9px', width: '40%', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '0.5rem' }} />
        <div style={{ height: '10px', width: '90%', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '0.35rem' }} />
        <div style={{ height: '10px', width: '70%', background: 'var(--border-light)', borderRadius: '4px' }} />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <div style={{ height: '9px', width: '30%', background: 'var(--parchment)', borderRadius: '4px', opacity: 0.28, marginBottom: '0.5rem' }} />
        <div style={{ height: '10px', width: '92%', background: 'var(--parchment)', borderRadius: '4px', opacity: 0.28, marginBottom: '0.4rem' }} />
        <div style={{ height: '10px', width: '72%', background: 'var(--parchment)', borderRadius: '4px', opacity: 0.28 }} />
      </div>
    </div>
  )
}

// ── Stat Row ──────────────────────────────────────────────────────────────────

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {icon} {label}
      </div>
      <span style={{ fontSize: '0.78rem', fontWeight: 500, textAlign: 'right', maxWidth: '55%' }}>{value}</span>
    </div>
  )
}
