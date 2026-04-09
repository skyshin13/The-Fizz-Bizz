import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { supabase } from '../lib/supabase'
import { Project, FermentationType } from '../types'
import { useFermentationTypes } from '../hooks/useLookups'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { Plus, Search, Clock, Trash2, ImagePlus, X, Globe, Lock, Dna } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showCreate, setShowCreate] = useState(false)
  const { types, getEmoji } = useFermentationTypes()

  const load = () => api.get('/projects/').then(r => setProjects(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const filtered = projects.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const deleteProject = async (id: number) => {
    if (!confirm('Delete this project?')) return
    await api.delete(`/projects/${id}`)
    toast.success('Project deleted')
    load()
  }

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Fermentation Projects</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{projects.length} total projects</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.625rem 1.25rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem' }}>
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Filters */}
      <div className="fade-in-delay-1" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." style={{ width: '100%', paddingLeft: '2rem', padding: '0.6rem 0.875rem 0.6rem 2.25rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--card-bg)', fontSize: '0.875rem' }} />
        </div>
        {['all', 'active', 'completed'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500, background: filterStatus === s ? 'var(--amber)' : 'var(--card-bg)', color: filterStatus === s ? 'var(--brown-dark)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading projects...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '2px dashed var(--border)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🫙</div>
          <p style={{ color: 'var(--text-muted)' }}>No projects found. Start a new fermentation!</p>
        </div>
      ) : (
        <div className="fade-in-delay-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filtered.map(project => (
            <ProjectRow key={project.id} project={project} onDelete={() => deleteProject(project.id)} getEmoji={getEmoji} />
          ))}
        </div>
      )}

      {showCreate && <CreateProjectModal types={types} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
    </div>
  )
}

function ProjectRow({ project, onDelete, getEmoji }: { project: Project; onDelete: () => void; getEmoji: (type: string) => string }) {
  const latestPh = project.measurements.filter(m => m.ph).at(-1)?.ph
  const latestAbv = project.measurements.filter(m => m.alcohol_by_volume).at(-1)?.alcohol_by_volume

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden', position: 'relative' }}>
      {project.cover_photo_url && (
        <img src={project.cover_photo_url} alt={project.name} style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }} />
      )}
      <Link to={`/projects/${project.id}`} style={{ display: 'block', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '2.25rem', lineHeight: 1, flexShrink: 0 }}>{getEmoji(project.fermentation_type)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.name}</h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.description || project.fermentation_type.replace(/_/g, ' ')}
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {latestPh && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>pH {latestPh.toFixed(1)}</span>}
              {latestAbv && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{latestAbv.toFixed(1)}% ABV</span>}
              {project.measurements.length > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{project.measurements.length} readings</span>}
            </div>
          </div>
        </div>
      </Link>
      <div style={{ padding: '0.625rem 1.25rem', background: 'var(--parchment)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> {project.start_date ? formatDistanceToNow(new Date(project.start_date), { addSuffix: true }) : 'No start date'}
          </span>
          {project.yeast_strain && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Dna size={11} />
              {project.yeast_strain.name}{project.yeast_strain.brand ? ` · ${project.yeast_strain.brand}` : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '20px', background: project.status === 'active' ? '#4a674118' : '#3d4e5c18', color: project.status === 'active' ? 'var(--moss)' : 'var(--slate)' }}>
            {project.status}
          </span>
          <span title={project.is_public ? 'Public' : 'Private'} style={{ display: 'flex', alignItems: 'center', color: project.is_public ? 'var(--moss)' : 'var(--text-muted)' }}>
            {project.is_public ? <Globe size={12} /> : <Lock size={12} />}
          </span>
          <button onClick={e => { e.preventDefault(); onDelete() }} style={{ padding: 4, background: 'transparent', color: 'var(--text-muted)', borderRadius: 4 }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateProjectModal({ types, onClose, onCreated }: { types: { value: string; label: string; emoji?: string }[]; onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: '', fermentation_type: 'kombucha' as FermentationType,
    description: '', batch_size_liters: '', initial_gravity: '', initial_ph: '',
    fermentation_temp_celsius: '', vessel_type: '', target_end_date: '', notes: '',
    is_public: false,
  })
  const [yeastId, setYeastId] = useState<string>('')
  const [yeastSearch, setYeastSearch] = useState('')
  const [yeastDropdownOpen, setYeastDropdownOpen] = useState(false)
  const [yeasts, setYeasts] = useState<{ id: number; name: string; strain_code?: string; brand?: string; yeast_type?: string; best_for?: string }[]>([])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const ALCOHOL_TYPES = new Set(['beer', 'wine', 'mead', 'cider', 'alcohol_brewing'])
  const isAlcohol = ALCOHOL_TYPES.has(form.fermentation_type)

  useEffect(() => {
    api.get('/yeasts/').then(r => setYeasts(r.data)).catch(() => {})
  }, [])

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const removePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let cover_photo_url: string | undefined

      if (photoFile && user) {
        const ext = photoFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('project-photos')
          .upload(path, photoFile, { upsert: true })
        if (uploadError) {
          toast.error('Photo upload failed — project will be created without a cover photo.')
        } else {
          const { data: urlData } = supabase.storage.from('project-photos').getPublicUrl(path)
          cover_photo_url = urlData.publicUrl
        }
      }

      await api.post('/projects/', {
        ...form,
        cover_photo_url,
        start_date: new Date().toISOString(),
        batch_size_liters: form.batch_size_liters ? parseFloat(form.batch_size_liters) : undefined,
        initial_gravity: form.initial_gravity ? parseFloat(form.initial_gravity) : undefined,
        initial_ph: form.initial_ph ? parseFloat(form.initial_ph) : undefined,
        fermentation_temp_celsius: form.fermentation_temp_celsius ? parseFloat(form.fermentation_temp_celsius) : undefined,
        target_end_date: form.target_end_date || undefined,
        notes: form.notes || undefined,
        yeast_id: isAlcohol && yeastId ? parseInt(yeastId) : undefined,
      })
      toast.success('Project created! 🫧')
      onCreated()
    } catch (err: any) {
      toast.error(err?.message || err?.response?.data?.detail || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>New Fermentation Project</h2>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gap: '1rem' }}>

            {/* Cover photo */}
            <Field label="Cover Photo">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
              {photoPreview ? (
                <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', height: '140px' }}>
                  <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button type="button" onClick={removePhoto} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '1.25rem', border: '2px dashed var(--border)', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
                  <ImagePlus size={16} /> Add a cover photo
                </button>
              )}
            </Field>

            <Field label="Project Name *">
              <input required value={form.name} onChange={set('name')} placeholder="My Summer Kombucha" style={iStyle} />
            </Field>

            <Field label="Fermentation Type *">
              <select required value={form.fermentation_type} onChange={set('fermentation_type')} style={iStyle}>
                {types.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.emoji ? `${t.emoji} ${t.label}` : t.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Description">
              <textarea value={form.description} onChange={set('description')} placeholder="What are you making? Any special ingredients?" style={{ ...iStyle, resize: 'vertical', minHeight: '60px' }} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Batch Size (L)">
                <input type="number" step="0.1" min="0" value={form.batch_size_liters} onChange={set('batch_size_liters')} placeholder="3.8" style={iStyle} />
              </Field>
              <Field label="Vessel Type">
                <input value={form.vessel_type} onChange={set('vessel_type')} placeholder="Mason jar, Carboy..." style={iStyle} />
              </Field>
              {isAlcohol && (
                <Field label="Initial Gravity (OG)">
                  <input type="number" step="0.001" value={form.initial_gravity} onChange={set('initial_gravity')} placeholder="1.054" style={iStyle} />
                </Field>
              )}
              {isAlcohol && (
                <Field label="Yeast Strain">
                  <YeastTypeahead
                    yeasts={yeasts}
                    yeastId={yeastId}
                    yeastSearch={yeastSearch}
                    dropdownOpen={yeastDropdownOpen}
                    onSearchChange={q => { setYeastSearch(q); setYeastDropdownOpen(true); if (!q) { setYeastId('') } }}
                    onSelect={y => { setYeastId(String(y.id)); setYeastSearch(`${y.name}${y.brand ? ` · ${y.brand}` : ''}`); setYeastDropdownOpen(false) }}
                    onClear={() => { setYeastId(''); setYeastSearch(''); setYeastDropdownOpen(false) }}
                    onFocus={() => setYeastDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setYeastDropdownOpen(false), 150)}
                  />
                </Field>
              )}
              <Field label="Initial pH">
                <input type="number" step="0.1" min="0" max="14" value={form.initial_ph} onChange={set('initial_ph')} placeholder="7.2" style={iStyle} />
              </Field>
              <Field label="Temp (°C)">
                <input type="number" step="0.5" value={form.fermentation_temp_celsius} onChange={set('fermentation_temp_celsius')} placeholder="20" style={iStyle} />
              </Field>
              <Field label="Target End Date">
                <input type="date" value={form.target_end_date} onChange={set('target_end_date')} style={iStyle} />
              </Field>
            </div>

            <Field label="Notes">
              <textarea value={form.notes} onChange={set('notes')} placeholder="Reminders, sourcing info, anything else..." style={{ ...iStyle, resize: 'vertical', minHeight: '60px' }} />
            </Field>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', padding: '0.75rem', background: form.is_public ? '#4a674112' : 'transparent', borderRadius: '8px', border: `1px solid ${form.is_public ? 'var(--moss-light)' : 'var(--border)'}`, transition: 'all 0.2s' }}>
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={e => setForm(prev => ({ ...prev, is_public: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: 'var(--moss)', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Make this project public</div>
                <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Public projects appear in the Explore feed for others to discover</div>
              </div>
            </label>

          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ flex: 2, padding: '0.75rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontWeight: 600 }}>
              {loading ? 'Creating...' : 'Start Fermenting 🫧'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function YeastTypeahead({
  yeasts, yeastId, yeastSearch, dropdownOpen,
  onSearchChange, onSelect, onClear, onFocus, onBlur,
}: {
  yeasts: { id: number; name: string; strain_code?: string; brand?: string; yeast_type?: string; best_for?: string }[]
  yeastId: string
  yeastSearch: string
  dropdownOpen: boolean
  onSearchChange: (q: string) => void
  onSelect: (y: { id: number; name: string; strain_code?: string; brand?: string; yeast_type?: string }) => void
  onClear: () => void
  onFocus: () => void
  onBlur: () => void
}) {
  const q = yeastSearch.toLowerCase()
  const filtered = yeasts
    .filter(y => ['ale', 'lager', 'wine'].includes(y.yeast_type || ''))
    .filter(y =>
      !q ||
      y.name.toLowerCase().includes(q) ||
      (y.brand?.toLowerCase().includes(q) ?? false) ||
      (y.strain_code?.toLowerCase().includes(q) ?? false) ||
      (y.best_for?.toLowerCase().includes(q) ?? false)
    )
    .slice(0, 10)

  const selected = yeastId ? yeasts.find(y => String(y.id) === yeastId) : null

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          value={yeastSearch}
          onChange={e => onSearchChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Search by name, brand, or style (e.g. English Ale)…"
          style={{ ...iStyle, paddingLeft: '2.1rem', paddingRight: yeastId ? '2rem' : '0.875rem' }}
        />
        {yeastId && (
          <button type="button" onClick={onClear} style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {selected && (
        <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--moss)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Dna size={11} />
          <span>{selected.name}{selected.brand ? ` · ${selected.brand}` : ''}{selected.yeast_type ? ` · ${selected.yeast_type}` : ''}</span>
        </div>
      )}

      {dropdownOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: '8px', boxShadow: 'var(--shadow-md)', marginTop: '2px',
          maxHeight: '260px', overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No strains match "{yeastSearch}"
            </div>
          ) : filtered.map(y => (
            <button
              key={y.id}
              type="button"
              onMouseDown={() => onSelect(y)}
              style={{
                width: '100%', textAlign: 'left', padding: '0.625rem 1rem',
                background: String(y.id) === yeastId ? '#c8832a12' : 'transparent',
                border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border-light)',
              }}
            >
              <div style={{ fontSize: '0.83rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {y.name}{y.strain_code ? <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.375rem' }}>({y.strain_code})</span> : null}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                {[y.brand, y.yeast_type].filter(Boolean).join(' · ')}
              </div>
              {y.best_for && (
                <div style={{ fontSize: '0.7rem', color: 'var(--moss)', marginTop: '0.15rem', opacity: 0.85 }}>
                  Best for: {y.best_for.length > 60 ? y.best_for.slice(0, 60) + '…' : y.best_for}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>{label}</label>
      {children}
    </div>
  )
}

const iStyle: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.875rem', border: '1px solid var(--border)',
  borderRadius: '8px', background: 'var(--warm-white)', fontSize: '0.875rem', color: 'var(--text-primary)'
}
