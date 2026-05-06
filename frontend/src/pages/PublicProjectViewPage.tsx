import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useFermentationTypes } from '../hooks/useLookups'
import { ArrowLeft, FlaskConical, Thermometer, Droplets, Activity, Wind, User } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, parseISO, formatDistanceToNow } from 'date-fns'

const toF = (c: number) => Math.round((c * 9 / 5 + 32) * 10) / 10
const ALCOHOL_TYPES = new Set(['beer', 'wine', 'mead', 'cider', 'alcohol_brewing'])

interface SharedMeasurement {
  logged_at: string
  ph: number | null
  specific_gravity: number | null
  alcohol_by_volume: number | null
  co2_psi: number | null
  temperature_celsius: number | null
}

interface SharedObservation {
  content: string
  photo_url: string | null
  created_at: string
}

interface SharedYeast {
  name: string
  strain_code: string | null
  brand: string | null
  yeast_type: string | null
}

interface PublicProjectDetail {
  id: number
  name: string
  fermentation_type: string
  status: string
  description: string | null
  notes: string | null
  cover_photo_url: string | null
  batch_size_liters: number | null
  vessel_type: string | null
  initial_gravity: number | null
  initial_ph: number | null
  fermentation_temp_celsius: number | null
  start_date: string | null
  end_date: string | null
  created_at: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  measurements: SharedMeasurement[]
  observations: SharedObservation[]
  yeast_strain: SharedYeast | null
}

export default function PublicProjectViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<PublicProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const { getEmoji } = useFermentationTypes()

  useEffect(() => {
    api.get(`/projects/${id}/public`)
      .then(r => setProject(r.data))
      .catch(() => navigate('/explore', { replace: true }))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
  )
  if (!project) return null

  const isAlcohol = ALCOHOL_TYPES.has(project.fermentation_type)
  const sortedMeasurements = [...project.measurements].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  )
  const firstTs = sortedMeasurements.length > 0 ? new Date(sortedMeasurements[0].logged_at).getTime() : 0
  const chartData = sortedMeasurements.map(m => ({
    minutesElapsed: Math.round((new Date(m.logged_at).getTime() - firstTs) / 60000),
    ph: m.ph ?? null,
    sg: m.specific_gravity ?? null,
    abv: m.alcohol_by_volume ?? null,
  }))
  const latestM = sortedMeasurements.at(-1)
  const daysSince = project.start_date
    ? Math.floor((Date.now() - new Date(project.start_date).getTime()) / 86400000)
    : null
  const photos = project.observations.filter(o => o.photo_url)
  const author = project.author_display_name || project.author_username

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1.25rem', padding: 0 }}
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Cover photo */}
      {project.cover_photo_url && (
        <div style={{ borderRadius: '14px', overflow: 'hidden', marginBottom: '1.5rem', height: '240px' }}>
          <img src={project.cover_photo_url} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      {/* Header */}
      <div className="fade-in" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.875rem' }}>
          <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{getEmoji(project.fermentation_type)}</span>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{project.name}</h1>
            <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {project.fermentation_type.replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.625rem', background: project.status === 'active' ? '#4a674118' : '#3d4e5c18', color: project.status === 'active' ? 'var(--moss)' : 'var(--slate)', borderRadius: '20px' }}>
                {project.status}
              </span>
              {daysSince != null && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Day {daysSince}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {project.start_date && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Started {format(parseISO(project.start_date), 'MMM d, yyyy')}
                </span>
              )}
              {project.end_date && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  · Finished {format(parseISO(project.end_date), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Author */}
        <Link
          to={`/profile/${project.author_username}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.875rem', background: 'var(--card-bg)', border: '1px solid var(--border-light)', borderRadius: '10px', textDecoration: 'none' }}
        >
          {project.author_avatar_url ? (
            <img src={project.author_avatar_url} alt={author} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '0.85rem', color: 'var(--brown-dark)', flexShrink: 0 }}>
              {author[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{author}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{project.author_username}</div>
          </div>
        </Link>
      </div>

      {/* Description */}
      {project.description && (
        <div className="fade-in-delay-1" style={{ marginBottom: '1.25rem', background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid var(--border-light)' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{project.description}</p>
        </div>
      )}

      {/* Batch details */}
      {(project.vessel_type || project.batch_size_liters || project.initial_gravity || project.initial_ph || project.fermentation_temp_celsius || project.yeast_strain) && (
        <div className="fade-in-delay-1" style={{ marginBottom: '1.25rem', background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Batch Details</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.625rem' }}>
            {project.yeast_strain && (
              <Detail icon={<FlaskConical size={13} />} label="Yeast">
                {project.yeast_strain.name}
                {project.yeast_strain.strain_code && <span style={{ fontFamily: 'monospace', opacity: 0.7, fontSize: '0.8em' }}> ({project.yeast_strain.strain_code})</span>}
                {project.yeast_strain.brand && <span style={{ opacity: 0.7 }}> · {project.yeast_strain.brand}</span>}
              </Detail>
            )}
            {project.vessel_type && <Detail icon={<FlaskConical size={13} />} label="Vessel">{project.vessel_type}</Detail>}
            {project.batch_size_liters && <Detail icon={<Droplets size={13} />} label="Batch Size">{project.batch_size_liters} L</Detail>}
            {project.initial_gravity && <Detail icon={<Activity size={13} />} label="OG">{project.initial_gravity.toFixed(3)}</Detail>}
            {project.initial_ph && <Detail icon={<Droplets size={13} />} label="Starting pH">{project.initial_ph.toFixed(1)}</Detail>}
            {project.fermentation_temp_celsius && (
              <Detail icon={<Thermometer size={13} />} label="Temp">{toF(project.fermentation_temp_celsius)}°F</Detail>
            )}
          </div>
        </div>
      )}

      {/* Current readings */}
      {latestM && (
        <div className="fade-in-delay-1" style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Latest Readings <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>· {formatDistanceToNow(new Date(latestM.logged_at), { addSuffix: true })}</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem' }}>
            {[
              { label: 'pH', value: latestM.ph?.toFixed(1), icon: Droplets, color: 'var(--moss)' },
              ...(isAlcohol ? [
                { label: 'Gravity', value: latestM.specific_gravity?.toFixed(3), icon: FlaskConical, color: 'var(--amber)' },
                { label: 'Est. ABV', value: latestM.alcohol_by_volume ? `${latestM.alcohol_by_volume.toFixed(1)}%` : undefined, icon: Activity, color: 'var(--rust)' },
              ] : []),
              { label: 'CO₂ (psi)', value: latestM.co2_psi?.toFixed(1), icon: Wind, color: 'var(--slate)' },
              { label: 'Temp', value: latestM.temperature_celsius != null ? `${toF(latestM.temperature_celsius)}°F` : undefined, icon: Thermometer, color: 'var(--slate)' },
            ].filter(s => s.value).map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '0.875rem 1rem', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                  <Icon size={13} color={color} />
                </div>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.3rem', color: 'var(--brown-dark)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length >= 2 && (
        <div className="fade-in-delay-2" style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid var(--border-light)', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>pH Over Time</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="minutesElapsed" type="number" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={v => v >= 1440 ? `${Math.round(v / 1440)}d` : v >= 60 ? `${Math.floor(v / 60)}h` : `${v}m`} />
              <YAxis domain={[0, 14]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ fontFamily: 'DM Sans', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(v: number) => [`${v} pH`, 'pH']}
                labelFormatter={l => firstTs ? format(new Date(firstTs + Number(l) * 60 * 1000), 'MMM d, yyyy h:mm a') : ''} />
              <Line type="monotone" dataKey="ph" stroke="#4a6741" strokeWidth={2.5} dot={{ fill: '#4a6741', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
            {sortedMeasurements.length} reading{sortedMeasurements.length !== 1 ? 's' : ''} logged
          </p>
        </div>
      )}

      {/* Photo log */}
      {photos.length > 0 && (
        <div className="fade-in-delay-2" style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Photo Log ({photos.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.625rem' }}>
            {photos.map((o, i) => (
              <div
                key={i}
                onClick={() => setLightbox(o.photo_url!)}
                style={{ borderRadius: '10px', overflow: 'hidden', aspectRatio: '1', cursor: 'zoom-in', background: 'var(--parchment)', position: 'relative' }}
              >
                <img src={o.photo_url!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {o.content && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.55))', padding: '1.5rem 0.5rem 0.4rem', fontSize: '0.68rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {project.notes && (
        <div className="fade-in-delay-2" style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid var(--border-light)', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Brewer's Notes</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{project.notes}</p>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem', cursor: 'zoom-out' }}
        >
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '10px', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{children}</span>
    </div>
  )
}
