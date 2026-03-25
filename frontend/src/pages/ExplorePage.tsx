import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { PublicProject, PublicUser } from '../types'
import { useFermentationTypes } from '../hooks/useLookups'
import toast from 'react-hot-toast'
import { Search, Users, FlaskConical, UserPlus, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function ExplorePage() {
  const [tab, setTab] = useState<'projects' | 'people'>('projects')
  const [projects, setProjects] = useState<PublicProject[]>([])
  const [users, setUsers] = useState<PublicUser[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [sentRequests, setSentRequests] = useState<Set<number>>(new Set())
  const { types, getEmoji } = useFermentationTypes()
  const navigate = useNavigate()

  const loadProjects = () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (typeFilter) params.fermentation_type = typeFilter
    api.get('/explore/projects', { params })
      .then(r => setProjects(r.data))
      .finally(() => setLoading(false))
  }

  const loadUsers = () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (search) params.q = search
    api.get('/explore/users', { params })
      .then(r => setUsers(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (tab === 'projects') loadProjects()
    else loadUsers()
  }, [tab, typeFilter])

  const handleUserSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadUsers()
  }

  const sendRequest = async (username: string, userId: number) => {
    try {
      await api.post(`/friends/request/${username}`)
      setSentRequests(prev => new Set(prev).add(userId))
      toast.success('Friend request sent!')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to send request')
    }
  }

  const filteredProjects = projects.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.author_username.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div className="fade-in" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Explore</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Discover public fermentations and connect with other brewers
        </p>
      </div>

      {/* Tabs */}
      <div className="fade-in" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem' }}>
        {([['projects', FlaskConical, 'Projects Feed'], ['people', Users, 'Find People']] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSearch('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.6rem 1.25rem', borderRadius: '10px',
              fontWeight: 600, fontSize: '0.875rem',
              background: tab === key ? 'var(--amber)' : 'var(--card-bg)',
              color: tab === key ? 'var(--brown-dark)' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Projects tab */}
      {tab === 'projects' && (
        <>
          <div className="fade-in-delay-1" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search projects or authors..."
                style={{ width: '100%', padding: '0.6rem 0.875rem 0.6rem 2.25rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--card-bg)', fontSize: '0.875rem' }}
              />
            </div>
            <select
              value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              style={{ padding: '0.6rem 0.875rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--card-bg)', fontSize: '0.875rem', color: 'var(--text-primary)' }}
            >
              <option value="">All Types</option>
              {types.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading...</div>
          ) : filteredProjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '2px dashed var(--border)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🫙</div>
              <p style={{ color: 'var(--text-muted)' }}>No public projects found yet. Be the first to share!</p>
            </div>
          ) : (
            <div className="fade-in-delay-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {filteredProjects.map(p => (
                <PublicProjectCard key={p.id} project={p} getEmoji={getEmoji} />
              ))}
            </div>
          )}
        </>
      )}

      {/* People tab */}
      {tab === 'people' && (
        <>
          <form onSubmit={handleUserSearch} className="fade-in-delay-1" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by username or name..."
                style={{ width: '100%', padding: '0.6rem 0.875rem 0.6rem 2.25rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--card-bg)', fontSize: '0.875rem' }}
              />
            </div>
            <button type="submit" style={{ padding: '0.6rem 1.25rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
              Search
            </button>
          </form>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading...</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '2px dashed var(--border)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👤</div>
              <p style={{ color: 'var(--text-muted)' }}>No users found. Try a different search.</p>
            </div>
          ) : (
            <div className="fade-in-delay-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {users.map(u => (
                <div
                  key={u.id}
                  style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-light)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div
                      style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '1.1rem', color: 'var(--brown-dark)', flexShrink: 0 }}
                    >
                      {u.display_name?.[0]?.toUpperCase() || u.username[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.925rem', color: 'var(--brown-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.display_name || u.username}
                      </div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>@{u.username}</div>
                    </div>
                  </div>
                  {u.bio && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{u.bio}</p>}
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                    {u.public_project_count} public project{u.public_project_count !== 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      onClick={() => navigate(`/profile/${u.username}`)}
                      style={{ flex: 1, padding: '0.5rem', background: 'var(--parchment)', color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500, border: '1px solid var(--border)' }}
                    >
                      View Profile
                    </button>
                    {sentRequests.has(u.id) ? (
                      <button disabled style={{ flex: 1, padding: '0.5rem', background: 'var(--moss-light)', color: '#fff', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Check size={13} /> Sent
                      </button>
                    ) : (
                      <button
                        onClick={() => sendRequest(u.username, u.id)}
                        style={{ flex: 1, padding: '0.5rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      >
                        <UserPlus size={13} /> Add Friend
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PublicProjectCard({ project, getEmoji }: { project: PublicProject; getEmoji: (type: string) => string }) {
  return (
    <Link to={`/profile/${project.author_username}`} style={{ display: 'block', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden', transition: 'box-shadow 0.2s' }}>
      {project.cover_photo_url ? (
        <img src={project.cover_photo_url} alt={project.name} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '80px', background: 'var(--parchment)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
          {getEmoji(project.fermentation_type)}
        </div>
      )}
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', marginBottom: '0.5rem' }}>
          {!project.cover_photo_url && null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '0.925rem', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</h3>
            {project.description && (
              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.description}</p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>by <strong style={{ color: 'var(--text-secondary)' }}>@{project.author_username}</strong></span>
          <span>{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.625rem' }}>
          <span style={{ fontSize: '1.1rem' }}>{getEmoji(project.fermentation_type)}</span>
          <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '20px', background: project.status === 'active' ? '#4a674118' : '#3d4e5c18', color: project.status === 'active' ? 'var(--moss)' : 'var(--slate)' }}>
            {project.status}
          </span>
          {project.measurement_count > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{project.measurement_count} readings</span>
          )}
        </div>
      </div>
    </Link>
  )
}
