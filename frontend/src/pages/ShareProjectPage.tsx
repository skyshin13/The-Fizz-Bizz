import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { useFermentationTypes } from '../hooks/useLookups'
import { FlaskConical, Droplets, Activity, Thermometer, Clock } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, parseISO, formatDistanceToNow } from 'date-fns'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface SharedMeasurement {
  logged_at: string
  ph: number | null
  specific_gravity: number | null
  alcohol_by_volume: number | null
  co2_psi: number | null
  temperature_celsius: number | null
}

interface SharedProject {
  id: number
  name: string
  fermentation_type: string
  status: string
  description: string | null
  cover_photo_url: string | null
  start_date: string | null
  created_at: string
  author_username: string
  author_display_name: string | null
  measurements: SharedMeasurement[]
}

export default function ShareProjectPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<SharedProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const { getEmoji } = useFermentationTypes()

  useEffect(() => {
    axios.get(`${API_BASE}/api/explore/share/${id}`)
      .then(r => setProject(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--warm-white)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🫧</div>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    </div>
  )

  if (notFound || !project) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--warm-white)', gap: '1rem' }}>
      <div style={{ fontSize: '3rem' }}>🫙</div>
      <h2 style={{ color: 'var(--text-secondary)' }}>Project not found</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>This project may be private or no longer exists.</p>
      <Link to="/" style={{ padding: '0.625rem 1.25rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
        Go to Fizz Bizz
      </Link>
    </div>
  )

  const ALCOHOL_TYPES = new Set(['beer', 'wine', 'mead', 'cider', 'alcohol_brewing'])
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
    co2: m.co2_psi ?? null,
  }))

  const latestM = sortedMeasurements.at(-1)
  const daysSince = project.start_date
    ? Math.floor((Date.now() - new Date(project.start_date).getTime()) / 86400000)
    : null

  const author = project.author_display_name || project.author_username

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--brown-dark)', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🫧</span>
          <div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 700, color: 'var(--amber-glow)' }}>Fizz Bizz</div>
            <div style={{ fontSize: '0.6rem', color: 'rgba(245,199,110,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fermentation Studio</div>
          </div>
        </div>
        <Link to="/register" style={{ padding: '0.5rem 1rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem' }}>
          Join Free
        </Link>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>

        {/* Cover photo */}
        {project.cover_photo_url && (
          <div style={{ borderRadius: '14px', overflow: 'hidden', marginBottom: '1.5rem', height: '220px' }}>
            <img src={project.cover_photo_url} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem' }}>{getEmoji(project.fermentation_type)}</span>
            <div>
              <h1 style={{ fontSize: '1.75rem', marginBottom: '0.125rem' }}>{project.name}</h1>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {project.fermentation_type.replace(/_/g, ' ')}
                </span>
                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.625rem', background: project.status === 'active' ? '#4a674118' : '#3d4e5c18', color: project.status === 'active' ? 'var(--moss)' : 'var(--slate)', borderRadius: '20px' }}>
                  {project.status}
                </span>
                {daysSince != null && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> Day {daysSince}
                  </span>
                )}
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Shared by <strong style={{ color: 'var(--text-secondary)' }}>{author}</strong>
            {project.start_date && <> · Started {formatDistanceToNow(new Date(project.start_date), { addSuffix: true })}</>}
          </p>
        </div>

        {/* Description */}
        {project.description && (
          <div style={{ marginBottom: '1.5rem', background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid var(--border-light)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{project.description}</p>
          </div>
        )}

        {/* Stats */}
        {latestM && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Current pH', value: latestM.ph?.toFixed(1), icon: Droplets, color: 'var(--moss)' },
              ...(isAlcohol ? [
                { label: 'Gravity (SG)', value: latestM.specific_gravity?.toFixed(3), icon: FlaskConical, color: 'var(--amber)' },
                { label: 'Est. ABV', value: latestM.alcohol_by_volume ? `${latestM.alcohol_by_volume.toFixed(1)}%` : undefined, icon: Activity, color: 'var(--rust)' },
              ] : []),
              { label: 'Temp (°C)', value: latestM.temperature_celsius?.toFixed(1), icon: Thermometer, color: 'var(--slate)' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                  <Icon size={13} color={color} />
                </div>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.35rem', color: value ? 'var(--brown-dark)' : 'var(--border)' }}>
                  {value || '—'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        {chartData.length >= 2 && (
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid var(--border-light)', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Fermentation Trend — pH</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                <XAxis dataKey="minutesElapsed" type="number" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickFormatter={v => v >= 1440 ? `${Math.round(v / 1440)}d` : v >= 60 ? `${Math.floor(v / 60)}h` : `${v}m`} />
                <YAxis domain={[0, 14]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={{ fontFamily: 'DM Sans', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8 }}
                  formatter={(v: number) => [`${v} pH`, 'pH']}
                  labelFormatter={l => `${(l / 60).toFixed(1)}h elapsed`} />
                <Line type="monotone" dataKey="ph" stroke="#4a6741" strokeWidth={2.5}
                  dot={{ fill: '#4a6741', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
              {project.measurements.length} reading{project.measurements.length !== 1 ? 's' : ''} logged
            </p>
          </div>
        )}

        {/* CTA */}
        <div style={{ background: 'var(--brown-dark)', borderRadius: '14px', padding: '1.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🫧</div>
          <h3 style={{ color: 'var(--amber-glow)', fontFamily: 'Fraunces, serif', marginBottom: '0.5rem' }}>Start tracking your own ferments</h3>
          <p style={{ color: 'rgba(245,240,232,0.6)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Log pH, gravity, CO₂, and more. Track kombucha, beer, wine, kimchi & beyond.
          </p>
          <Link to="/register" style={{ display: 'inline-block', padding: '0.7rem 1.75rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem' }}>
            Join Fizz Bizz — it's free
          </Link>
        </div>
      </div>
    </div>
  )
}
