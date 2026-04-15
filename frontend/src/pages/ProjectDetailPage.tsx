import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'
import { supabase } from '../lib/supabase'
import { Project, Reminder } from '../types'
import { useFermentationTypes } from '../hooks/useLookups'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, FlaskConical, Thermometer, Droplets, Activity, BookOpen, Camera, X, ImagePlus, ChevronLeft, ChevronRight, CheckCircle, Bell, BellOff, Trash2, Send, Pencil, Check, Wind, AlertTriangle, Search, Info } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { format, parseISO } from 'date-fns'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMeasure, setShowMeasure] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [activeChart, setActiveChart] = useState<'ph' | 'gravity' | 'co2'>('ph')
  const [activeTab, setActiveTab] = useState<'log' | 'album' | 'cer'>('log')
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [showReminder, setShowReminder] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const { getEmoji } = useFermentationTypes()

  const load = () => api.get(`/projects/${id}`).then(r => setProject(r.data)).finally(() => setLoading(false))
  const loadReminders = () => api.get(`/projects/${id}/reminders`).then(r => setReminders(r.data)).catch(() => {})
  useEffect(() => {
    load(); loadReminders()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [id])

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading...</div>
  if (!project) return <div style={{ padding: '3rem', textAlign: 'center' }}>Project not found.</div>

  const photos = project.observations.filter(o => o.photo_url).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const sortedMeasurements = [...project.measurements].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  )
  const firstTs = sortedMeasurements.length > 0 ? new Date(sortedMeasurements[0].logged_at).getTime() : 0
  const chartData = sortedMeasurements.map(m => ({
    date: format(parseISO(m.logged_at), 'MMM d'),
    minutesElapsed: Math.round((new Date(m.logged_at).getTime() - firstTs) / 60000),
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

  const ALCOHOL_TYPES = new Set(['beer', 'wine', 'mead', 'cider', 'alcohol_brewing'])
  const isAlcohol = ALCOHOL_TYPES.has(project.fermentation_type)

  const finalAbv = (project.initial_gravity && project.final_gravity)
    ? Math.max(0, (project.initial_gravity - project.final_gravity) * 131.25)
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
              {editingName ? (
                <form
                  onSubmit={async e => {
                    e.preventDefault()
                    const trimmed = nameInput.trim()
                    if (!trimmed || trimmed === project.name) { setEditingName(false); return }
                    try {
                      await api.patch(`/projects/${project.id}`, { name: trimmed })
                      await load()
                      toast.success('Project renamed')
                    } catch {
                      toast.error('Failed to rename project')
                    } finally {
                      setEditingName(false)
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}
                >
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && setEditingName(false)}
                    style={{ fontSize: '1.5rem', fontWeight: 700, border: '1px solid var(--amber)', borderRadius: '8px', padding: '0.2rem 0.625rem', background: 'var(--card-bg)', color: 'var(--text-primary)', outline: 'none', width: '100%' }}
                  />
                  <button type="submit" style={{ padding: '0.375rem', background: 'var(--amber)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: 'var(--brown-dark)', display: 'flex', alignItems: 'center' }}>
                    <Check size={16} />
                  </button>
                  <button type="button" onClick={() => setEditingName(false)} style={{ padding: '0.375rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <h1 style={{ fontSize: '1.75rem' }}>{project.name}</h1>
                  <button
                    onClick={() => { setNameInput(project.name); setEditingName(true) }}
                    title="Rename project"
                    style={{ padding: '0.3rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', borderRadius: '6px' }}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{project.fermentation_type.replace(/_/g, ' ')}</span>
                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.625rem', background: '#4a674118', color: 'var(--moss)', borderRadius: '20px' }}>{project.status}</span>
                {daysSince != null && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Day {daysSince}</span>}
              </div>
              {project.yeast_strain && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.375rem' }}>
                  <FlaskConical size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {project.yeast_strain.name}
                    {project.yeast_strain.strain_code && <span style={{ fontFamily: 'monospace', marginLeft: '0.3rem', opacity: 0.75 }}>({project.yeast_strain.strain_code})</span>}
                    {project.yeast_strain.brand && <span style={{ marginLeft: '0.3rem', opacity: 0.75 }}>· {project.yeast_strain.brand}</span>}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
            {/* Row 1: Complete Project + Add Note */}
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              {project.status === 'active' && (
                <button onClick={() => setShowComplete(true)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--moss)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500, color: 'var(--moss)', background: 'var(--card-bg)' }}>
                  <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Complete Project
                </button>
              )}
              <button onClick={() => setShowNote(true)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--card-bg)' }}>
                <BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add Note
              </button>
            </div>
            {/* Row 2: Log Measurement + Set Reminder */}
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={() => setShowMeasure(true)} style={{ padding: '0.5rem 1rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Log Measurement
              </button>
              <button onClick={() => setShowReminder(true)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--amber)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--amber)', background: 'var(--card-bg)' }}>
                <Bell size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Set Reminder
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* About this batch */}
      {project.description && (
        <div className="fade-in-delay-1" style={{ marginBottom: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid var(--border-light)' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{project.description}</p>
          {(project.batch_size_liters || project.vessel_type || project.fermentation_temp_celsius || project.yeast_strain) && (
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
              {project.batch_size_liters && <Detail label="Batch Size" value={`${project.batch_size_liters}L`} />}
              {project.vessel_type && <Detail label="Vessel" value={project.vessel_type} />}
              {isAlcohol && project.initial_gravity && <Detail label="OG" value={project.initial_gravity.toFixed(3)} />}
              {project.fermentation_temp_celsius && <Detail label="Temp" value={`${project.fermentation_temp_celsius}°C`} />}
              {project.yeast_strain && (
                <Detail
                  label="Yeast Strain"
                  value={`${project.yeast_strain.name}${project.yeast_strain.strain_code ? ` (${project.yeast_strain.strain_code})` : ''}${project.yeast_strain.brand ? ` · ${project.yeast_strain.brand}` : ''}`}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats row */}
      {(() => {
        const stats = [
          { label: 'Current pH', value: latestM?.ph?.toFixed(1), icon: Droplets, color: 'var(--moss)' },
          ...(isAlcohol ? [
            { label: 'Gravity (SG)', value: latestM?.specific_gravity?.toFixed(3), icon: FlaskConical, color: 'var(--amber)' },
            {
              label: project.status === 'completed' && finalAbv !== null ? 'Final ABV' : 'Est. ABV',
              value: project.status === 'completed' && finalAbv !== null
                ? `${finalAbv.toFixed(1)}%`
                : latestM?.alcohol_by_volume ? `${latestM.alcohol_by_volume.toFixed(1)}%` : undefined,
              icon: Activity,
              color: 'var(--rust)',
            },
          ] : []),
          { label: 'Temp (°C)', value: latestM?.temperature_celsius?.toFixed(1), icon: Thermometer, color: 'var(--slate)' },
        ]
        return (
      <div className="fade-in-delay-1" style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: '1rem', marginBottom: '2rem' }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
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
        )
      })()}

      {/* Chart */}
      {chartData.length >= 1 && (
        <div className="fade-in-delay-2" style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-light)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.1rem' }}>Fermentation Trends</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {([
                ['ph',  'pH',  '#4a6741'],
                ...(isAlcohol ? [['gravity', 'SG', '#c8832a']] : []),
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
              {(() => {
                const maxMin = chartData.length > 0 ? Math.max(...chartData.map(d => d.minutesElapsed)) : 0
                const useDays = maxMin >= 1440
                const tickFormatter = (v: number) => {
                  if (useDays) return `${Math.round(v / 1440)}d`
                  if (v < 60) return `${v}m`
                  return `${Math.floor(v / 60)}h${v % 60 > 0 ? `${v % 60}m` : ''}`
                }
                return (
                  <XAxis
                    dataKey="minutesElapsed"
                    type="number"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickFormatter={tickFormatter}
                  />
                )
              })()}
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
                labelFormatter={(label) => `${(label / 60).toFixed(1)} hours elapsed`}
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
          {([
            ['log', 'Notes & Log'],
            ['album', `Album (${photos.length})`],
            ...(isAlcohol ? [['cer', 'CO₂ Production']] : []),
          ] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab as 'log' | 'album' | 'cer')} style={{ flex: 1, padding: '0.875rem', fontSize: '0.875rem', fontWeight: 500, background: 'transparent', color: activeTab === tab ? 'var(--amber)' : 'var(--text-muted)', borderBottom: activeTab === tab ? '2px solid var(--amber)' : '2px solid transparent', transition: 'color 0.15s' }}>
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
                    <div key={m.id} style={{ display: 'grid', gridTemplateColumns: isAlcohol ? '90px repeat(4, 1fr)' : '90px repeat(3, 1fr)', gap: '0.5rem', padding: '0.625rem', background: 'var(--warm-white)', borderRadius: '6px', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{format(parseISO(m.logged_at), 'MMM d, yyyy')}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{m.ph ? `pH ${m.ph}` : '—'}</span>
                      {isAlcohol && <span style={{ color: 'var(--text-secondary)' }}>{m.specific_gravity ? `SG ${m.specific_gravity}` : '—'}</span>}
                      {isAlcohol && <span style={{ color: 'var(--text-secondary)' }}>{m.alcohol_by_volume ? `${m.alcohol_by_volume.toFixed(1)}% ABV` : '—'}</span>}
                      <span style={{ color: 'var(--text-secondary)' }}>{m.co2_psi ? `${m.co2_psi} psi` : '—'}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{m.temperature_celsius ? `${m.temperature_celsius}°C` : '—'}</span>
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

        {activeTab === 'cer' && isAlcohol && (
          <div style={{ padding: '1.5rem' }}>
            <CERTab
              projectId={parseInt(id!)}
              startDate={project.start_date}
            />
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

      {/* Project info — moved to bottom placeholder, now rendered near top */}
      {false && project.description && (
        <div style={{ marginTop: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>About this batch</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{project.description}</p>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {project.batch_size_liters && <Detail label="Batch Size" value={`${project.batch_size_liters}L`} />}
            {project.vessel_type && <Detail label="Vessel" value={project.vessel_type} />}
            {isAlcohol && project.initial_gravity && <Detail label="OG" value={project.initial_gravity.toFixed(3)} />}
            {project.fermentation_temp_celsius && <Detail label="Temp" value={`${project.fermentation_temp_celsius}°C`} />}
            {project.yeast_strain && (
              <Detail
                label="Yeast Strain"
                value={`${project.yeast_strain.name}${project.yeast_strain.strain_code ? ` (${project.yeast_strain.strain_code})` : ''}${project.yeast_strain.brand ? ` · ${project.yeast_strain.brand}` : ''}`}
              />
            )}
          </div>
        </div>
      )}

      {showMeasure && <MeasurementModal projectId={project.id} isAlcohol={isAlcohol} onClose={() => setShowMeasure(false)} onAdded={() => { setShowMeasure(false); load() }} />}
      {showNote && <NoteModal projectId={project.id} onClose={() => setShowNote(false)} onAdded={() => { setShowNote(false); load() }} />}
      {showReminder && <ReminderModal projectId={project.id} onClose={() => setShowReminder(false)} onAdded={() => { setShowReminder(false); loadReminders() }} />}
      {showComplete && (
        <CompleteProjectModal
          project={project}
          isAlcohol={isAlcohol}
          onClose={() => setShowComplete(false)}
          onCompleted={() => { setShowComplete(false); load() }}
        />
      )}
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

function MeasurementModal({ projectId, isAlcohol, onClose, onAdded }: { projectId: number; isAlcohol: boolean; onClose: () => void; onAdded: () => void }) {
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
            ...(isAlcohol ? [{ label: 'Specific Gravity', key: 'specific_gravity' as const, placeholder: '1.010', step: '0.001' }] : []),
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

function CompleteProjectModal({ project, isAlcohol, onClose, onCompleted }: {
  project: Project
  isAlcohol: boolean
  onClose: () => void
  onCompleted: () => void
}) {
  const lastSg = project.measurements.filter(m => m.specific_gravity).at(-1)?.specific_gravity
  const [finalGravity, setFinalGravity] = useState(lastSg?.toString() ?? '')
  const [loading, setLoading] = useState(false)

  const fg = parseFloat(finalGravity)
  const previewAbv = (isAlcohol && project.initial_gravity && fg && !isNaN(fg))
    ? Math.max(0, (project.initial_gravity - fg) * 131.25).toFixed(1)
    : null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.patch(`/projects/${project.id}`, {
        status: 'completed',
        end_date: new Date().toISOString(),
        ...(isAlcohol && fg && !isNaN(fg) ? { final_gravity: fg } : {}),
      })
      toast.success('Project completed!')
      onCompleted()
    } catch {
      toast.error('Failed to complete project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Complete Project" onClose={onClose}>
      <form onSubmit={submit}>
        {isAlcohol && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={lStyle}>Final Gravity (FG)</label>
              <input
                type="number" step="0.001" value={finalGravity}
                onChange={e => setFinalGravity(e.target.value)}
                placeholder={lastSg?.toString() ?? '1.010'}
                style={iStyle}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                {lastSg ? `Last logged SG: ${lastSg.toFixed(3)}` : 'Enter your final hydrometer reading'}
              </p>
            </div>
            {previewAbv && (
              <div style={{ background: 'var(--parchment)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Calculated Final ABV</p>
                <p style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', color: 'var(--amber)' }}>{previewAbv}%</p>
                {project.initial_gravity && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    OG {project.initial_gravity.toFixed(3)} → FG {fg.toFixed(3)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {isAlcohol
            ? 'Marking this project as complete will lock in your final ABV.'
            : 'Mark this batch as complete. This will record today as the end date.'}
        </p>
        <ModalFooter onClose={onClose} loading={loading} submitLabel="Complete Project" />
      </form>
    </Modal>
  )
}

function friendlyInterval(hours: number): string {
  if (hours >= 720 && hours % 720 === 0) {
    const n = hours / 720
    return `Every ${n} month${n !== 1 ? 's' : ''}`
  }
  if (hours >= 168 && hours % 168 === 0) {
    const n = hours / 168
    return `Every ${n} week${n !== 1 ? 's' : ''}`
  }
  if (hours >= 24 && hours % 24 === 0) {
    const n = hours / 24
    return `Every ${n} day${n !== 1 ? 's' : ''}`
  }
  return `Every ${hours} hour${hours !== 1 ? 's' : ''}`
}

// ─── CER Tab (stateful, persistent) ──────────────────────────────────────────

interface CERStrain    { id: string; name: string; strain_type: string; brand: string; opt_temp_c: number; temp_min_c: number; temp_max_c: number; ethanol_tol: number; description: string }
interface LiveCERPoint { hours_elapsed: number; co2_psi: number; timestamp: string }
interface LiveCERState { current_psi: number; current_phase: string; current_cer_estimate: number; elapsed_hours: number; strain_id: string; strain_name: string; sugar_g: number; volume_ml: number; temperature_c: number; X: number; S: number }

const TYPE_LABELS: Record<string, string> = { ale: 'Ale', lager: 'Lager', wheat: 'Wheat', wine: 'Wine', champagne: 'Champagne', saison: 'Saison', wild: 'Wild / Belgian' }
const PHASE_COLOR: Record<string, string> = { lag: '#94a3b8', exponential: '#f59e0b', stationary: '#10b981', decline: '#ef4444' }
const cerInput: React.CSSProperties = { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--warm-white)', fontSize: '0.85rem', color: 'var(--text-primary)', boxSizing: 'border-box' }
const cerLabel: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.3rem' }

function CERTab({ projectId, startDate }: { projectId: number; startDate?: string }) {
  const [strains, setStrains]           = useState<CERStrain[]>([])
  const [selectedStrain, setSelectedStrain] = useState<CERStrain | null>(null)
  const [strainSearch, setStrainSearch] = useState('')
  const [showList, setShowList]         = useState(false)
  const [showInfo, setShowInfo]         = useState(false)

  // Editable params (initialised from backend state on first load)
  const [sugar, setSugar]         = useState('200')
  const [volume, setVolume]       = useState('5000')
  const [temp, setTemp]           = useState('20')
  const [threshold, setThreshold] = useState('150')  // CER alert in mg/L/h (frontend-only)

  // Live data from the database
  const [points, setPoints]       = useState<LiveCERPoint[]>([])
  const [liveState, setLiveState] = useState<LiveCERState | null>(null)
  const [loading, setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [releasing, setReleasing] = useState(false)
  const [patching, setPatching]   = useState(false)
  const initialised               = useRef(false)

  // Zoom window: 'all' or last-N-hours
  const [viewHours, setViewHours]       = useState<number | 'all'>('all')
  const [customHours, setCustomHours]   = useState('12')
  const [showCustom, setShowCustom]     = useState(false)

  // ── Fetch live data from database ──────────────────────────────────────────
  const fetchData = async () => {
    try {
      const res = await api.get(`/calculations/live-cer/${projectId}`)
      setPoints(res.data.points ?? [])
      setLiveState(res.data.state ?? null)
      setLastUpdated(new Date())
      // Sync controls from backend state on first load only
      if (!initialised.current && res.data.state) {
        const s: LiveCERState = res.data.state
        setSugar(String(Math.round(s.sugar_g)))
        setVolume(String(Math.round(s.volume_ml)))
        setTemp(String(s.temperature_c))
        initialised.current = true
      }
    } catch { /* silent — offline */ }
    finally { setLoading(false) }
  }

  // Load strains once (for picker)
  useEffect(() => {
    api.get('/calculations/cer-strains').then(r => setStrains(r.data)).catch(() => {})
  }, [])

  // Sync selectedStrain display whenever liveState or strains list changes
  useEffect(() => {
    if (liveState && strains.length > 0) {
      const match = strains.find(s => s.id === liveState.strain_id)
      if (match) setSelectedStrain(match)
    }
  }, [liveState?.strain_id, strains])

  // Poll every 30 s — matches backend tick interval
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [projectId])

  // ── Send updated params to backend ─────────────────────────────────────────
  const patchParams = async (overrides?: { strain_id?: string }) => {
    setPatching(true)
    try {
      await api.patch(`/calculations/cer-params/${projectId}`, {
        strain_id:    overrides?.strain_id ?? selectedStrain?.id,
        sugar_g:      parseFloat(sugar)  || undefined,
        volume_ml:    parseFloat(volume) || undefined,
        temperature_c: parseFloat(temp)  || undefined,
      })
      await fetchData()
    } catch { toast.error('Could not update simulation params') }
    finally { setPatching(false) }
  }

  // ── CO₂ release ────────────────────────────────────────────────────────────
  const handleRelease = async () => {
    setReleasing(true)
    try {
      await api.post(`/calculations/co2-release/${projectId}`)
      await fetchData()
      toast.success('CO₂ released — pressure reset to 0')
    } catch { toast.error('Could not record CO₂ release') }
    finally { setReleasing(false) }
  }

  // Derived values
  const alertNum      = parseFloat(threshold) || 150
  const isAlerting    = (liveState?.current_cer_estimate ?? 0) > alertNum
  const secsSincePoll = lastUpdated ? Math.round((Date.now() - lastUpdated.getTime()) / 1000) : null

  // Zoom: slice points and compute X-axis domain for the selected window
  const maxH = points.length > 0 ? points[points.length - 1].hours_elapsed : 0
  const windowH = viewHours === 'all' ? null : (viewHours === -1 ? (parseFloat(customHours) || 12) : viewHours)
  const minH    = windowH !== null ? Math.max(0, maxH - windowH) : 0
  const visiblePoints = windowH !== null ? points.filter(p => p.hours_elapsed >= minH) : points
  const xDomain: [number | string, number | string] = windowH !== null ? [minH, maxH] : ['dataMin', 'dataMax']

  const filtered = strains.filter(s =>
    s.name.toLowerCase().includes(strainSearch.toLowerCase()) ||
    s.strain_type.toLowerCase().includes(strainSearch.toLowerCase()) ||
    s.brand.toLowerCase().includes(strainSearch.toLowerCase())
  )
  const grouped: Record<string, CERStrain[]> = {}
  for (const s of filtered) {
    if (!grouped[s.strain_type]) grouped[s.strain_type] = []
    grouped[s.strain_type].push(s)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem' }}>

      {/* ── Controls ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Persistent CO₂ simulation — continues across restarts. Backfills any offline gap automatically.
        </p>

        {/* Strain picker */}
        <div style={{ position: 'relative' }}>
          <label style={cerLabel}>Yeast Strain</label>
          <div onClick={() => setShowList(v => !v)} style={{ ...cerInput, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: selectedStrain ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {selectedStrain ? selectedStrain.name : (liveState?.strain_name ?? 'Select…')}
            </span>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>▼</span>
          </div>
          {showList && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', marginTop: 4, maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
              <div style={{ padding: '0.4rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--card-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.35rem 0.5rem', background: 'var(--parchment)', borderRadius: 6 }}>
                  <Search size={11} color="var(--text-muted)" />
                  <input autoFocus value={strainSearch} onChange={e => setStrainSearch(e.target.value)} placeholder="Search…" style={{ border: 'none', background: 'transparent', fontSize: '0.78rem', outline: 'none', width: '100%', color: 'var(--text-primary)' }} onClick={e => e.stopPropagation()} />
                </div>
              </div>
              {Object.entries(grouped).map(([type, list]) => (
                <div key={type}>
                  <div style={{ padding: '0.35rem 0.7rem', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--parchment)' }}>
                    {TYPE_LABELS[type] ?? type}
                  </div>
                  {list.map(s => (
                    <div key={s.id}
                      onClick={() => {
                        setSelectedStrain(s)
                        setShowList(false)
                        setStrainSearch('')
                        patchParams({ strain_id: s.id })
                      }}
                      style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)', background: selectedStrain?.id === s.id ? 'var(--brown-dark)' : 'transparent' }}>
                      <div style={{ fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{s.brand}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div><label style={cerLabel}>Sugar (g)</label>
          <input type="number" step="10" value={sugar} onChange={e => setSugar(e.target.value)} onBlur={() => patchParams()} style={cerInput} />
        </div>
        <div><label style={cerLabel}>Volume (mL)</label>
          <input type="number" step="100" value={volume} onChange={e => setVolume(e.target.value)} onBlur={() => patchParams()} style={cerInput} />
        </div>
        <div><label style={cerLabel}>Temperature (°C)</label>
          <input type="number" step="0.5" value={temp} onChange={e => setTemp(e.target.value)} onBlur={() => patchParams()} style={cerInput} />
        </div>
        <div>
          <label style={cerLabel}>CER Alert (mg/L/h)</label>
          <input type="number" step="10" value={threshold} onChange={e => setThreshold(e.target.value)} style={cerInput} />
        </div>

        <button
          onClick={handleRelease}
          disabled={releasing || !liveState}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #b54a2c60', background: releasing ? '#b54a2c08' : '#b54a2c14', color: 'var(--rust)', fontSize: '0.8rem', fontWeight: 600, cursor: releasing ? 'default' : 'pointer', transition: 'all 0.15s', opacity: releasing ? 0.6 : 1 }}
          onMouseEnter={e => { if (!releasing) (e.currentTarget as HTMLButtonElement).style.background = '#b54a2c25' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = releasing ? '#b54a2c08' : '#b54a2c14' }}
        >
          <Wind size={14} />
          {releasing ? 'Releasing…' : 'Release CO₂'}
        </button>

        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {patching ? 'Saving…' : secsSincePoll !== null ? `Updated ${secsSincePoll}s ago` : 'Loading…'}
        </p>
      </div>

      {/* ── Chart + stats ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Alert banner */}
        {isAlerting && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.75rem 1rem', background: '#b54a2c18', border: '1px solid #b54a2c50', borderRadius: '10px', color: 'var(--rust)' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.875rem' }}>Pressure Alert</strong>
              <p style={{ fontSize: '0.78rem', margin: 0, opacity: 0.85 }}>CER is {liveState!.current_cer_estimate.toFixed(1)} mg/L/h — above your {threshold} threshold. Release CO₂ from your jar.</p>
            </div>
          </div>
        )}

        <style>{`@keyframes cer-live-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
        <div style={{ background: 'var(--warm-white)', borderRadius: '10px', padding: '1rem', border: '1px solid #ef444440', transition: 'border-color 0.3s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CO₂ Pressure (PSI)</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', fontWeight: 700, color: '#ef4444', background: '#ef444415', border: '1px solid #ef444440', borderRadius: 20, padding: '0.1rem 0.45rem' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'cer-live-pulse 1.4s ease-in-out infinite' }} />
                LIVE
              </span>
              {liveState && (
                <span style={{ fontSize: '0.62rem', color: PHASE_COLOR[liveState.current_phase] ?? 'var(--text-muted)', fontWeight: 600, textTransform: 'capitalize' }}>
                  {liveState.current_phase}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {/* ── Zoom window selector ── */}
              {([['all', 'All'], [6, '6h'], [24, '24h'], [48, '48h'], [-1, 'Custom']] as [number | 'all', string][]).map(([val, label]) => {
                const active = val === -1 ? showCustom : viewHours === val && !showCustom
                return (
                  <button key={String(val)}
                    onClick={() => {
                      if (val === -1) {
                        setShowCustom(v => !v)
                      } else {
                        setShowCustom(false)
                        setViewHours(val)
                      }
                    }}
                    style={{ padding: '0.2rem 0.5rem', borderRadius: 20, border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`, background: active ? '#f59e0b18' : 'transparent', color: active ? 'var(--amber)' : 'var(--text-muted)', fontSize: '0.65rem', fontWeight: active ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    {label}
                  </button>
                )
              })}
              {showCustom && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    min="1"
                    value={customHours}
                    onChange={e => { setCustomHours(e.target.value); setViewHours(-1) }}
                    style={{ width: 46, padding: '0.18rem 0.4rem', border: '1px solid var(--amber)', borderRadius: 6, background: 'var(--warm-white)', fontSize: '0.7rem', color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>h</span>
                </div>
              )}
              <button
                onClick={() => setShowInfo(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.25rem 0.5rem', borderRadius: 20, border: `1px solid ${showInfo ? 'var(--amber)' : 'var(--border)'}`, background: showInfo ? '#f59e0b18' : 'transparent', color: showInfo ? 'var(--amber)' : 'var(--text-muted)', fontSize: '0.68rem', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                <Info size={11} />
              </button>
            </div>
          </div>

          {showInfo && (
            <div style={{ marginBottom: '0.875rem', padding: '0.875rem', background: 'var(--parchment)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>Persistent stateful fermentation model</strong>
              <p style={{ margin: '0.4rem 0 0.2rem' }}>PSI accumulates from the governing equation:</p>
              <div style={{ fontFamily: 'monospace', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.625rem', margin: '0.4rem 0', fontSize: '0.75rem', color: 'var(--amber)' }}>
                CER(t) = μ(t) × X(t) × 0.49 × 1000 [mg CO₂/L/h]
              </div>
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <li>State (X, S, phase) is persisted in the database every 30 s</li>
                <li>Offline gaps are backfilled automatically on restart</li>
                <li>CO₂ Release drops PSI to 0 and creates a new accumulation trajectory</li>
                <li>X-axis = real elapsed hours since project start</li>
              </ul>
              <p style={{ margin: '0.6rem 0 0.2rem' }}><strong>Phases: </strong>
                <span style={{ color: '#94a3b8' }}>Lag</span> → <span style={{ color: '#f59e0b' }}>Exponential</span> → <span style={{ color: '#10b981' }}>Stationary</span> → <span style={{ color: '#ef4444' }}>Decline</span>
              </p>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: 'var(--text-muted)', gap: '0.5rem' }}>
              <Wind size={30} style={{ opacity: 0.2 }} />
              <p style={{ fontSize: '0.8rem' }}>Loading simulation data…</p>
            </div>
          )}

          {!loading && points.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: 'var(--text-muted)', gap: '0.5rem', flexDirection: 'column' }}>
              <Wind size={30} style={{ opacity: 0.2 }} />
              <p style={{ fontSize: '0.8rem', margin: 0 }}>Simulation starting…</p>
              <p style={{ fontSize: '0.72rem', margin: 0, opacity: 0.6 }}>First data point arrives within 30 seconds.</p>
            </div>
          )}

          {!loading && points.length > 0 && (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={visiblePoints} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="hours_elapsed"
                  type="number"
                  domain={xDomain}
                  tick={{ fontSize: '0.68rem', fill: 'var(--text-muted)' }}
                  label={{ value: windowH !== null ? `Last ${windowH.toFixed(0)}h` : 'Hours elapsed', position: 'insideBottom', offset: -2, style: { fontSize: '0.68rem', fill: 'var(--text-muted)' } }}
                  tickCount={8}
                  tickFormatter={(v: number) => `${v.toFixed(0)}h`}
                  allowDataOverflow
                />
                <YAxis
                  tick={{ fontSize: '0.68rem', fill: 'var(--text-muted)' }}
                  label={{ value: 'PSI', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: '0.68rem', fill: 'var(--text-muted)' } }}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem' }}
                  formatter={(v: number) => [`${v.toFixed(3)} PSI`, 'CO₂ Pressure']}
                  labelFormatter={(h: number) => `Hour ${h.toFixed(1)} since start`}
                />
                <Line type="monotone" dataKey="co2_psi" stroke="var(--amber)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stat cards */}
        {liveState && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
            {[
              { label: 'Current PSI',  value: liveState.current_psi.toFixed(3),              unit: 'vessel pressure' },
              { label: 'CER estimate', value: liveState.current_cer_estimate.toFixed(1),     unit: 'mg/L/h now' },
              { label: 'Elapsed',      value: `${liveState.elapsed_hours.toFixed(1)}h`,      unit: `${liveState.current_phase} phase` },
            ].map(({ label, value, unit }) => (
              <div key={label} style={{ padding: '0.75rem', background: 'var(--warm-white)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{label}</div>
                <div style={{ fontSize: '1.2rem', fontFamily: 'Fraunces, serif', color: 'var(--amber)', fontWeight: 600 }}>{value}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{unit}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ReminderCard({ reminder, onDelete, onSendNow }: { reminder: Reminder; onDelete: () => void; onSendNow: () => void }) {
  const typeLabels: Record<string, string> = {
    ph_check: '🧪 pH Check',
    co2_release: '💨 CO₂ Release',
    gravity_check: '⚗️ Gravity Check',
    taste: '👅 Taste Test',
    custom: '⏰ Custom',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', padding: '1rem 1.125rem', background: reminder.is_active ? 'var(--card-bg)' : 'var(--warm-white)', borderRadius: '10px', border: `1px solid ${reminder.is_active ? 'var(--border-light)' : 'var(--border)'}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{typeLabels[reminder.reminder_type] || reminder.reminder_type}</span>
          {reminder.sms_enabled ? (
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', background: '#4a674118', color: 'var(--moss)', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Bell size={10} /> SMS on
            </span>
          ) : (
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', background: 'var(--parchment)', color: 'var(--text-muted)', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: 3 }}>
              <BellOff size={10} /> SMS off
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{reminder.message}</p>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {friendlyInterval(reminder.interval_hours)}
          {reminder.next_trigger_at && ` · Next: ${format(parseISO(reminder.next_trigger_at), 'MMM d, h:mm a')}`}
          {reminder.phone_number && ` · ${reminder.phone_number}`}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
        {reminder.sms_enabled && (
          <button
            onClick={onSendNow}
            title="Send SMS now"
            style={{ padding: '0.375rem 0.625rem', background: 'var(--parchment)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--moss)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
          >
            <Send size={12} /> Send
          </button>
        )}
        <button
          onClick={onDelete}
          title="Delete reminder"
          style={{ padding: '0.375rem 0.5rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function ReminderModal({ projectId, onClose, onAdded }: { projectId: number; onClose: () => void; onAdded: () => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    reminder_type: 'ph_check',
    interval_count: '2',
    interval_unit: 'day' as 'day' | 'week' | 'month',
  })
  const [showSmsConfirm, setShowSmsConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const PRESET_TYPES = [
    { value: 'ph_check',      label: '🧪 pH Check',           defaultMsg: 'Time to check the pH on your fermentation!',             defaultCount: '2', defaultUnit: 'day'  as const },
    { value: 'co2_release',   label: '💨 CO₂ Release (Burp)', defaultMsg: 'Time to burp/release CO₂ from your fermentation vessel!', defaultCount: '1', defaultUnit: 'day'  as const },
    { value: 'gravity_check', label: '⚗️ Gravity Check',      defaultMsg: 'Time to take a gravity reading!',                         defaultCount: '3', defaultUnit: 'day'  as const },
    { value: 'custom',        label: '⏰ Custom',               defaultMsg: 'Time to check on your fermentation!',                    defaultCount: '2', defaultUnit: 'day'  as const },
  ]

  const UNIT_HOURS = { day: 24, week: 168, month: 720 }

  const selectPreset = (value: string) => {
    const preset = PRESET_TYPES.find(p => p.value === value)!
    setForm(prev => ({ ...prev, reminder_type: value, interval_count: preset.defaultCount, interval_unit: preset.defaultUnit }))
  }

  const save = async (sms_enabled: boolean) => {
    setLoading(true)
    try {
      const preset = PRESET_TYPES.find(p => p.value === form.reminder_type)!
      const interval_hours = Math.max(1, parseInt(form.interval_count) || 1) * UNIT_HOURS[form.interval_unit]
      await api.post(`/projects/${projectId}/reminders`, {
        reminder_type: form.reminder_type,
        message: preset.defaultMsg,
        interval_hours,
        sms_enabled,
        phone_number: sms_enabled ? (user?.phone_number || undefined) : undefined,
      })
      toast.success('Reminder created!')
      onAdded()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create reminder')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Set Reminder" onClose={onClose}>
      {showSmsConfirm ? (
        /* SMS confirmation step */
        <div>
          <div style={{ textAlign: 'center', padding: '1rem 0 1.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📱</div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Enable SMS reminders?</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              We'll send a text to your phone number on file
              {user?.phone_number ? <><br /><strong style={{ color: 'var(--text-secondary)' }}>{user.phone_number}</strong></> : ' when it\u2019s time.'}.
            </p>
            {!user?.phone_number && (
              <p style={{ fontSize: '0.78rem', color: 'var(--amber)', marginTop: '0.5rem' }}>
                No phone number saved — add one in your profile to use SMS reminders.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => save(false)}
              disabled={loading}
              style={{ flex: 1, padding: '0.7rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}
            >
              No thanks
            </button>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={loading || !user?.phone_number}
              style={{ flex: 2, padding: '0.7rem', background: user?.phone_number ? 'var(--moss)' : 'var(--border)', color: user?.phone_number ? '#fff' : 'var(--text-muted)', borderRadius: '8px', fontWeight: 600, cursor: user?.phone_number ? 'pointer' : 'not-allowed' }}
            >
              {loading ? 'Saving...' : 'Yes, enable SMS'}
            </button>
          </div>
        </div>
      ) : (
        /* Main form */
        <form onSubmit={e => { e.preventDefault(); setShowSmsConfirm(true) }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lStyle}>Reminder Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {PRESET_TYPES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => selectPreset(p.value)}
                  style={{
                    padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left',
                    fontWeight: form.reminder_type === p.value ? 600 : 400,
                    background: form.reminder_type === p.value ? 'var(--amber-glow)' : 'var(--warm-white)',
                    border: `1px solid ${form.reminder_type === p.value ? 'var(--amber)' : 'var(--border)'}`,
                    color: form.reminder_type === p.value ? 'var(--brown-dark)' : 'var(--text-secondary)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={lStyle}>Repeat Every</label>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <select
                value={form.interval_count}
                onChange={e => setForm(prev => ({ ...prev, interval_count: e.target.value }))}
                style={{ ...iStyle, flex: '0 0 auto', width: '90px', cursor: 'pointer' }}
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
              <select
                value={form.interval_unit}
                onChange={e => setForm(prev => ({ ...prev, interval_unit: e.target.value as 'day' | 'week' | 'month' }))}
                style={{ ...iStyle, flex: 1, cursor: 'pointer' }}
              >
                <option value="day">{parseInt(form.interval_count) === 1 ? 'Day' : 'Days'}</option>
                <option value="week">{parseInt(form.interval_count) === 1 ? 'Week' : 'Weeks'}</option>
                <option value="month">{parseInt(form.interval_count) === 1 ? 'Month' : 'Months'}</option>
              </select>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
              Every {form.interval_count} {form.interval_unit}{parseInt(form.interval_count) !== 1 ? 's' : ''} &middot; {Math.max(1, parseInt(form.interval_count) || 1) * UNIT_HOURS[form.interval_unit]} hours
            </p>
          </div>

          <ModalFooter onClose={onClose} loading={false} submitLabel="Create Reminder" />
        </form>
      )}
    </Modal>
  )
}

const iStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 0.875rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--warm-white)', fontSize: '0.875rem', color: 'var(--text-primary)' }
const lStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }
