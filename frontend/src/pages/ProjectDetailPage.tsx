import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'
import { supabase } from '../lib/supabase'
import { Project } from '../types'
import { useFermentationTypes } from '../hooks/useLookups'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, FlaskConical, Thermometer, Droplets, Activity, BookOpen, Camera, X, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, parseISO } from 'date-fns'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMeasure, setShowMeasure] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [activeChart, setActiveChart] = useState<'ph' | 'gravity' | 'co2'>('ph')
  const [activeTab, setActiveTab] = useState<'log' | 'album'>('log')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const { getEmoji } = useFermentationTypes()

  const load = () => api.get(`/projects/${id}`).then(r => setProject(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [id])

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading...</div>
  if (!project) return <div style={{ padding: '3rem', textAlign: 'center' }}>Project not found.</div>

  const photos = project.observations.filter(o => o.photo_url).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const chartData = project.measurements.map(m => ({
    date: format(parseISO(m.logged_at), 'MMM d'),
    ph: m.ph ?? null,
    sg: m.specific_gravity ?? null,
    abv: m.alcohol_by_volume ?? null,
    co2: m.co2_psi ?? null,
    temp: m.temperature_celsius ?? null,
  }))

  const latestM = project.measurements.at(-1)
  const daysSince = project.start_date
    ? Math.floor((Date.now() - new Date(project.start_date).getTime()) / 86400000)
    : null

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div className="fade-in" style={{ marginBottom: '2rem' }}>
        <Link to="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          <ArrowLeft size={14} /> Back to Projects
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '3rem' }}>{getEmoji(project.fermentation_type)}</span>
            <div>
              <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{project.name}</h1>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{project.fermentation_type.replace(/_/g, ' ')}</span>
                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.625rem', background: '#4a674118', color: 'var(--moss)', borderRadius: '20px' }}>{project.status}</span>
                {daysSince != null && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Day {daysSince}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => setShowNote(true)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--card-bg)' }}>
              <BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add Note
            </button>
            <button onClick={() => setShowMeasure(true)} style={{ padding: '0.5rem 1rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
              <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Log Measurement
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="fade-in-delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Current pH', value: latestM?.ph?.toFixed(1), icon: Droplets, color: 'var(--moss)' },
          { label: 'Gravity (SG)', value: latestM?.specific_gravity?.toFixed(3), icon: FlaskConical, color: 'var(--amber)' },
          { label: 'Est. ABV', value: latestM?.alcohol_by_volume ? `${latestM.alcohol_by_volume.toFixed(1)}%` : undefined, icon: Activity, color: 'var(--rust)' },
          { label: 'Temp (°C)', value: latestM?.temperature_celsius?.toFixed(1), icon: Thermometer, color: 'var(--slate)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              <Icon size={14} color={color} />
            </div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.5rem', color: value ? 'var(--brown-dark)' : 'var(--border)' }}>
              {value || '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length >= 1 && (
        <div className="fade-in-delay-2" style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-light)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.1rem' }}>Fermentation Trends</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {([
                ['ph',  'pH',  '#4a6741'],
                ['gravity', 'SG', '#c8832a'],
                ['co2', 'CO₂', '#3d4e5c'],
              ] as const).map(([key, label, color]) => (
                <button
                  key={key}
                  onClick={() => setActiveChart(key)}
                  style={{
                    padding: '0.3rem 0.875rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500,
                    background: activeChart === key ? color : 'transparent',
                    color: activeChart === key ? '#fff' : 'var(--text-muted)',
                    border: `1px solid ${activeChart === key ? color : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                domain={
                  activeChart === 'ph' ? [0, 14] :
                  activeChart === 'gravity' ? ['auto', 'auto'] :
                  ['auto', 'auto']
                }
                tickFormatter={v =>
                  activeChart === 'gravity' ? v.toFixed(3) : v
                }
              />
              <Tooltip
                contentStyle={{ fontFamily: 'DM Sans', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(value: number) =>
                  activeChart === 'ph' ? [`${value} pH`, 'pH'] :
                  activeChart === 'gravity' ? [value.toFixed(3), 'Specific Gravity'] :
                  [`${value} psi`, 'CO₂']
                }
              />
              {activeChart === 'ph' && (
                <Line type="monotone" dataKey="ph" name="pH" stroke="#4a6741" strokeWidth={2.5}
                  dot={{ fill: '#4a6741', r: 5, strokeWidth: 0 }}
                  activeDot={{ r: 7 }} connectNulls />
              )}
              {activeChart === 'gravity' && (
                <Line type="monotone" dataKey="sg" name="SG" stroke="#c8832a" strokeWidth={2.5}
                  dot={{ fill: '#c8832a', r: 5, strokeWidth: 0 }}
                  activeDot={{ r: 7 }} connectNulls />
              )}
              {activeChart === 'co2' && (
                <Line type="monotone" dataKey="co2" name="CO₂" stroke="#3d4e5c" strokeWidth={2.5}
                  dot={{ fill: '#3d4e5c', r: 5, strokeWidth: 0 }}
                  activeDot={{ r: 7 }} connectNulls />
              )}
            </LineChart>
          </ResponsiveContainer>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
            {project.measurements.length} reading{project.measurements.length !== 1 ? 's' : ''} logged
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="fade-in-delay-2" style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)' }}>
          {([['log', 'Notes & Log'], ['album', `Album (${photos.length})`]] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '0.875rem', fontSize: '0.875rem', fontWeight: 500, background: 'transparent', color: activeTab === tab ? 'var(--amber)' : 'var(--text-muted)', borderBottom: activeTab === tab ? '2px solid var(--amber)' : '2px solid transparent', transition: 'color 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'log' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {/* Observations */}
            <div style={{ padding: '1.5rem', borderRight: '1px solid var(--border-light)' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>Observation Notes</h2>
              {project.observations.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No notes yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxHeight: '320px', overflowY: 'auto' }}>
                  {project.observations.slice().reverse().map(obs => (
                    <div key={obs.id} style={{ paddingBottom: '0.875rem', borderBottom: '1px solid var(--border-light)' }}>
                      {obs.photo_url && (
                        <img src={obs.photo_url} alt="" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.5rem' }} />
                      )}
                      <p style={{ fontSize: '0.875rem', marginBottom: '0.375rem' }}>{obs.content}</p>
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {obs.tags?.map(tag => (
                          <span key={tag} style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', background: 'var(--parchment)', borderRadius: '20px', color: 'var(--text-muted)' }}>{tag}</span>
                        ))}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {format(parseISO(obs.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Measurements log */}
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>Measurement Log</h2>
              {project.measurements.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No measurements yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>
                  {project.measurements.slice().reverse().map(m => (
                    <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '90px repeat(4, 1fr)', gap: '0.5rem', padding: '0.625rem', background: 'var(--warm-white)', borderRadius: '6px', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{format(parseISO(m.logged_at), 'MMM d, yyyy')}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{m.ph ? `pH ${m.ph}` : '—'}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{m.specific_gravity ? `SG ${m.specific_gravity}` : '—'}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{m.alcohol_by_volume ? `${m.alcohol_by_volume.toFixed(1)}%` : '—'}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{m.co2_psi ? `${m.co2_psi} psi` : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'album' && (
          <div style={{ padding: '1.5rem' }}>
            {photos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Camera size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                <p style={{ fontSize: '0.875rem' }}>No photos yet. Add photos when logging observations.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.875rem' }}>
                {photos.map((obs, i) => (
                  <div key={obs.id} onClick={() => setLightboxIndex(i)} style={{ cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)', background: 'var(--warm-white)' }}>
                    <img src={obs.photo_url!} alt={obs.content} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: '0.5rem 0.625rem' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obs.content}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{format(parseISO(obs.created_at), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div onClick={() => setLightboxIndex(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => i! > 0 ? i! - 1 : photos.length - 1) }} style={{ position: 'absolute', left: 16, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <ChevronLeft size={20} />
          </button>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '80vw', textAlign: 'center' }}>
            <img src={photos[lightboxIndex].photo_url!} alt="" style={{ maxHeight: '75vh', maxWidth: '100%', borderRadius: '8px', display: 'block', margin: '0 auto' }} />
            <p style={{ color: '#fff', marginTop: '0.75rem', fontSize: '0.875rem' }}>{photos[lightboxIndex].content}</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{format(parseISO(photos[lightboxIndex].created_at), 'MMMM d, yyyy')}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', marginTop: '0.25rem' }}>{lightboxIndex + 1} / {photos.length}</p>
          </div>
          <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => i! < photos.length - 1 ? i! + 1 : 0) }} style={{ position: 'absolute', right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <ChevronRight size={20} />
          </button>
          <button onClick={() => setLightboxIndex(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Project info */}
      {project.description && (
        <div style={{ marginTop: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>About this batch</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{project.description}</p>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {project.batch_size_liters && <Detail label="Batch Size" value={`${project.batch_size_liters}L`} />}
            {project.vessel_type && <Detail label="Vessel" value={project.vessel_type} />}
            {project.initial_gravity && <Detail label="OG" value={project.initial_gravity.toFixed(3)} />}
            {project.fermentation_temp_celsius && <Detail label="Temp" value={`${project.fermentation_temp_celsius}°C`} />}
          </div>
        </div>
      )}

      {showMeasure && <MeasurementModal projectId={project.id} onClose={() => setShowMeasure(false)} onAdded={() => { setShowMeasure(false); load() }} />}
      {showNote && <NoteModal projectId={project.id} onClose={() => setShowNote(false)} onAdded={() => { setShowNote(false); load() }} />}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function MeasurementModal({ projectId, onClose, onAdded }: { projectId: number; onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ specific_gravity: '', ph: '', temperature_celsius: '', co2_psi: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post(`/projects/${projectId}/measurements`, {
        specific_gravity: form.specific_gravity ? parseFloat(form.specific_gravity) : undefined,
        ph: form.ph ? parseFloat(form.ph) : undefined,
        temperature_celsius: form.temperature_celsius ? parseFloat(form.temperature_celsius) : undefined,
        co2_psi: form.co2_psi ? parseFloat(form.co2_psi) : undefined,
        notes: form.notes || undefined,
      })
      toast.success('Measurement logged!')
      onAdded()
    } catch {
      toast.error('Failed to log measurement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Log Measurement" onClose={onClose}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          {[
            { label: 'Specific Gravity', key: 'specific_gravity' as const, placeholder: '1.010', step: '0.001' },
            { label: 'pH', key: 'ph' as const, placeholder: '4.5', step: '0.1' },
            { label: 'Temperature (°C)', key: 'temperature_celsius' as const, placeholder: '20.0', step: '0.1' },
            { label: 'CO₂ (PSI)', key: 'co2_psi' as const, placeholder: '6.5', step: '0.1' },
          ].map(f => (
            <div key={f.key}>
              <label style={lStyle}>{f.label}</label>
              <input type="number" step={f.step} value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder} style={iStyle} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={lStyle}>Notes</label>
          <textarea value={form.notes} onChange={set('notes')} placeholder="Observations..." style={{ ...iStyle, resize: 'vertical', minHeight: '60px' }} />
        </div>
        <ModalFooter onClose={onClose} loading={loading} submitLabel="Log Measurement" />
      </form>
    </Modal>
  )
}

function NoteModal({ projectId, onClose, onAdded }: { projectId: number; onClose: () => void; onAdded: () => void }) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    if (!content.trim()) return
    setLoading(true)
    try {
      let photo_url: string | undefined

      if (photoFile && user) {
        const ext = photoFile.name.split('.').pop()
        const path = `${user.id}/obs-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('project-photos')
          .upload(path, photoFile, { upsert: true })
        if (uploadError) {
          toast.error('Photo upload failed — note will be saved without photo.')
        } else {
          const { data: urlData } = supabase.storage.from('project-photos').getPublicUrl(path)
          photo_url = urlData.publicUrl
        }
      }

      await api.post(`/projects/${projectId}/observations`, {
        content,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        photo_url,
      })
      toast.success('Note added!')
      onAdded()
    } catch {
      toast.error('Failed to add note')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Add Observation" onClose={onClose}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={lStyle}>Observation *</label>
          <textarea required value={content} onChange={e => setContent(e.target.value)} placeholder="Describe what you see, smell, or taste..." style={{ ...iStyle, resize: 'vertical', minHeight: '80px' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={lStyle}>Photo</label>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
          {photoPreview ? (
            <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', height: '120px' }}>
              <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" onClick={removePhoto} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '0.875rem', border: '2px dashed var(--border)', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
              <ImagePlus size={15} /> Attach a photo
            </button>
          )}
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={lStyle}>Tags (comma-separated)</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="aroma, taste, color, activity" style={iStyle} />
        </div>
        <ModalFooter onClose={onClose} loading={loading} submitLabel="Add Note" />
      </form>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({ onClose, loading, submitLabel }: { onClose: () => void; loading: boolean; submitLabel: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.7rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)' }}>Cancel</button>
      <button type="submit" disabled={loading} style={{ flex: 2, padding: '0.7rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontWeight: 600 }}>
        {loading ? 'Saving...' : submitLabel}
      </button>
    </div>
  )
}

const iStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 0.875rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--warm-white)', fontSize: '0.875rem', color: 'var(--text-primary)' }
const lStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }
