import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'
import { Project } from '../types'
import { useFermentationTypes } from '../hooks/useLookups'
import { FlaskConical, TrendingUp, CheckCircle, Clock, Plus, Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import styles from './DashboardPage.module.css'

const STATUS_COLOR: Record<string, string> = {
  active: '#4a6741', completed: '#3d4e5c', failed: '#b54a2c', paused: '#c8832a'
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const { getEmoji } = useFermentationTypes()

  useEffect(() => {
    api.get('/projects/').then(r => setProjects(r.data)).finally(() => setLoading(false))
  }, [])

  const active = projects.filter(p => p.status === 'active')
  const completed = projects.filter(p => p.status === 'completed')

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className="fade-in" style={{ marginBottom: '2.5rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <h1 className={styles.heading}>
          Good {getTimeOfDay()}, {user?.display_name || user?.username} 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Here's what's bubbling in your fermentation studio.</p>
      </div>

      {/* Stats row */}
      <div className={`fade-in-delay-1 ${styles.statsGrid}`}>
        {[
          { icon: FlaskConical, label: 'Active Batches', value: active.length, color: 'var(--moss)' },
          { icon: CheckCircle, label: 'Completed', value: completed.length, color: 'var(--slate)' },
          { icon: TrendingUp, label: 'Total Projects', value: projects.length, color: 'var(--amber)' },
          { icon: Activity, label: 'Measurements Today', value: projects.reduce((sum, p) => sum + p.measurements.filter(m => {
            const today = new Date(); const d = new Date(m.logged_at)
            return d.toDateString() === today.toDateString()
          }).length, 0), color: 'var(--rust)' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={color} />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontFamily: 'Fraunces, serif', fontWeight: 600, color: 'var(--brown-dark)' }}>{loading ? '—' : value}</div>
          </div>
        ))}
      </div>

      {/* Active Projects */}
      <div className="fade-in-delay-2" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Active Ferments</h2>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : active.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {active.map(project => (
              <ProjectCard key={project.id} project={project} getEmoji={getEmoji} />
            ))}
          </div>
        )}
      </div>

      {/* Recent completed */}
      {completed.length > 0 && (
        <div className="fade-in-delay-3">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Recently Completed</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {completed.slice(0, 3).map(project => (
              <Link key={project.id} to={`/projects/${project.id}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1rem', background: 'var(--card-bg)', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '1.5rem' }}>{getEmoji(project.fermentation_type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{project.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {project.end_date ? `Finished ${formatDistanceToNow(new Date(project.end_date), { addSuffix: true })}` : 'Completed'}
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', padding: '0.25rem 0.625rem', background: '#3d4e5c18', color: 'var(--slate)', borderRadius: '20px' }}>Completed</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project, getEmoji }: { project: Project; getEmoji: (v: string) => string }) {
  const latestPh = project.measurements.filter(m => m.ph != null).at(-1)?.ph
  const latestSg = project.measurements.filter(m => m.specific_gravity != null).at(-1)?.specific_gravity
  const latestAbv = project.measurements.filter(m => m.alcohol_by_volume != null).at(-1)?.alcohol_by_volume

  const daysSinceStart = project.start_date
    ? Math.floor((Date.now() - new Date(project.start_date).getTime()) / 86400000)
    : null

  return (
    <Link to={`/projects/${project.id}`} style={{ display: 'block', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.2s, transform 0.2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; (e.currentTarget as HTMLElement).style.transform = 'none' }}>

      {/* Card header */}
      <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem', lineHeight: 1 }}>{getEmoji(project.fermentation_type)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.name}</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {project.fermentation_type.replace(/_/g, ' ')}
            </div>
          </div>
          <div style={{ flexShrink: 0, fontSize: '0.7rem', padding: '0.25rem 0.625rem', background: `${STATUS_COLOR[project.status]}18`, color: STATUS_COLOR[project.status], borderRadius: '20px', fontWeight: 500 }}>
            {project.status}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        <Metric label="pH" value={latestPh?.toFixed(1)} unit="" />
        <Metric label="SG" value={latestSg?.toFixed(3)} unit="" />
        <Metric label="ABV" value={latestAbv?.toFixed(1)} unit="%" />
      </div>

      {/* Footer */}
      <div style={{ padding: '0.625rem 1.25rem', background: 'var(--parchment)', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Clock size={11} />
        {daysSinceStart != null ? `Day ${daysSinceStart} of fermentation` : 'Just started'}
        {project.measurements.length > 0 && <span style={{ marginLeft: 'auto' }}>{project.measurements.length} readings</span>}
      </div>
    </Link>
  )
}

function Metric({ label, value, unit }: { label: string; value?: string; unit: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.1rem', color: value ? 'var(--brown-dark)' : 'var(--border)' }}>
        {value ? `${value}${unit}` : '—'}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--card-bg)', borderRadius: '12px', border: '2px dashed var(--border)' }}>
      <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🫙</div>
      <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>No active ferments</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>Start a new batch and track it from day one.</p>
      <Link to="/projects" style={{ padding: '0.625rem 1.25rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
        Create First Project
      </Link>
    </div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
