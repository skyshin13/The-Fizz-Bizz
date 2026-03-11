import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { Project, FermentationType } from '../types'
import toast from 'react-hot-toast'
import { Plus, Search, Filter, FlaskConical, Clock, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const TYPE_EMOJI: Record<string, string> = {
  kombucha: '🍵', probiotic_soda: '🫙', lacto_fermentation: '🥒',
  alcohol_brewing: '🍺', kimchi: '🌶️', water_kefir: '💧',
  milk_kefir: '🥛', mead: '🍯', cider: '🍎', beer: '🍻', wine: '🍷', general: '🧪'
}

const TYPES: { value: FermentationType; label: string }[] = [
  { value: 'kombucha', label: 'Kombucha' },
  { value: 'probiotic_soda', label: 'Probiotic Soda' },
  { value: 'beer', label: 'Beer' },
  { value: 'wine', label: 'Wine' },
  { value: 'mead', label: 'Mead' },
  { value: 'cider', label: 'Cider' },
  { value: 'kimchi', label: 'Kimchi' },
  { value: 'lacto_fermentation', label: 'Lacto-Fermentation' },
  { value: 'water_kefir', label: 'Water Kefir' },
  { value: 'milk_kefir', label: 'Milk Kefir' },
  { value: 'general', label: 'General' },
]

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showCreate, setShowCreate] = useState(false)

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
        {['all', 'active', 'completed', 'paused'].map(s => (
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
            <ProjectRow key={project.id} project={project} onDelete={() => deleteProject(project.id)} />
          ))}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
    </div>
  )
}

function ProjectRow({ project, onDelete }: { project: Project; onDelete: () => void }) {
  const latestPh = project.measurements.filter(m => m.ph).at(-1)?.ph
  const latestAbv = project.measurements.filter(m => m.alcohol_by_volume).at(-1)?.alcohol_by_volume

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden', position: 'relative' }}>
      <Link to={`/projects/${project.id}`} style={{ display: 'block', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '2.25rem', lineHeight: 1, flexShrink: 0 }}>{TYPE_EMOJI[project.fermentation_type] || '🧪'}</span>
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
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> {project.start_date ? formatDistanceToNow(new Date(project.start_date), { addSuffix: true }) : 'No start date'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '20px', background: project.status === 'active' ? '#4a674118' : '#3d4e5c18', color: project.status === 'active' ? 'var(--moss)' : 'var(--slate)' }}>
            {project.status}
          </span>
          <button onClick={e => { e.preventDefault(); onDelete() }} style={{ padding: 4, background: 'transparent', color: 'var(--text-muted)', borderRadius: 4 }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', fermentation_type: 'kombucha' as FermentationType,
    description: '', batch_size_liters: '', initial_gravity: '', initial_ph: '',
    fermentation_temp_celsius: '', vessel_type: ''
  })
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/projects', {
        ...form,
        start_date: new Date().toISOString(),
        batch_size_liters: form.batch_size_liters ? parseFloat(form.batch_size_liters) : undefined,
        initial_gravity: form.initial_gravity ? parseFloat(form.initial_gravity) : undefined,
        initial_ph: form.initial_ph ? parseFloat(form.initial_ph) : undefined,
        fermentation_temp_celsius: form.fermentation_temp_celsius ? parseFloat(form.fermentation_temp_celsius) : undefined,
      })
      toast.success('Project created! 🫧')
      onCreated()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create project')
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
            <Field label="Project Name *">
              <input required value={form.name} onChange={set('name')} placeholder="My Summer Kombucha" style={iStyle} />
            </Field>
            <Field label="Fermentation Type *">
              <select required value={form.fermentation_type} onChange={set('fermentation_type')} style={iStyle}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Description">
              <textarea value={form.description} onChange={set('description')} placeholder="Notes about this batch..." style={{ ...iStyle, resize: 'vertical', minHeight: '60px' }} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Batch Size (L)">
                <input type="number" step="0.1" value={form.batch_size_liters} onChange={set('batch_size_liters')} placeholder="3.8" style={iStyle} />
              </Field>
              <Field label="Initial Gravity (OG)">
                <input type="number" step="0.001" value={form.initial_gravity} onChange={set('initial_gravity')} placeholder="1.054" style={iStyle} />
              </Field>
              <Field label="Initial pH">
                <input type="number" step="0.1" value={form.initial_ph} onChange={set('initial_ph')} placeholder="7.2" style={iStyle} />
              </Field>
              <Field label="Temp (°C)">
                <input type="number" step="0.5" value={form.fermentation_temp_celsius} onChange={set('fermentation_temp_celsius')} placeholder="20" style={iStyle} />
              </Field>
            </div>
            <Field label="Vessel Type">
              <input value={form.vessel_type} onChange={set('vessel_type')} placeholder="Mason jar, Carboy, Bucket..." style={iStyle} />
            </Field>
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
