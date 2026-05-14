import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { PublicProject, PublicUser, FriendActivityProject, FriendInteraction, ProjectComment } from '../types'
import { useFermentationTypes } from '../hooks/useLookups'
import toast from 'react-hot-toast'
import { Search, Users, FlaskConical, UserPlus, UserCheck, Check, Heart, MessageCircle } from 'lucide-react'
import styles from './ExplorePage.module.css'
import { formatDistanceToNow } from 'date-fns'

export default function ExplorePage() {
  const [tab, setTab] = useState<'projects' | 'friends' | 'people'>('projects')
  const [projects, setProjects] = useState<PublicProject[]>([])
  const [friendProjects, setFriendProjects] = useState<FriendActivityProject[]>([])
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

  const loadFriendActivity = () => {
    setLoading(true)
    api.get('/explore/friend-activity')
      .then(r => setFriendProjects(r.data))
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
    else if (tab === 'friends') loadFriendActivity()
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
    <div className={styles.page}>
      <div className="fade-in" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Explore</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Discover public fermentations and connect with other brewers
        </p>
      </div>

      {/* Tabs */}
      <div className="fade-in" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem' }}>
        {([
          ['projects', FlaskConical, 'Projects Feed'],
          ['friends', Heart, 'Friends Activity'],
          ['people', Users, 'Find People'],
        ] as const).map(([key, Icon, label]) => (
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
            <div className={`fade-in-delay-2 ${styles.grid}`}>
              {filteredProjects.map(p => (
                <PublicProjectCard
                  key={p.id}
                  project={p}
                  getEmoji={getEmoji}
                  onLikeToggle={(id, liked) => {
                    setProjects(prev => prev.map(proj =>
                      proj.id === id
                        ? { ...proj, is_liked_by_me: liked, like_count: proj.like_count + (liked ? 1 : -1) }
                        : proj
                    ))
                  }}
                  onCommentAdd={(id) => {
                    setProjects(prev => prev.map(proj =>
                      proj.id === id ? { ...proj, comment_count: proj.comment_count + 1 } : proj
                    ))
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Friends Activity tab */}
      {tab === 'friends' && (
        <>
          <div className="fade-in-delay-1" style={{ marginBottom: '1.25rem', padding: '0.875rem 1.125rem', background: 'var(--amber-glow)', borderRadius: '10px', border: '1px solid var(--amber)', fontSize: '0.825rem', color: 'var(--brown-mid)' }}>
            Projects your friends have liked or commented on. Friends must enable "Share my activity" in their profile settings to appear here.
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading...</div>
          ) : friendProjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '2px dashed var(--border)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🤝</div>
              <p style={{ color: 'var(--text-muted)' }}>
                No friend activity yet. Add friends and ask them to enable activity sharing in their profile!
              </p>
            </div>
          ) : (
            <div className={`fade-in-delay-2 ${styles.grid}`}>
              {friendProjects.map(p => (
                <PublicProjectCard
                  key={p.id}
                  project={p}
                  getEmoji={getEmoji}
                  friendInteractions={p.friend_interactions}
                  onLikeToggle={(id, liked) => {
                    setFriendProjects(prev => prev.map(proj =>
                      proj.id === id
                        ? { ...proj, is_liked_by_me: liked, like_count: proj.like_count + (liked ? 1 : -1) }
                        : proj
                    ))
                  }}
                  onCommentAdd={(id) => {
                    setFriendProjects(prev => prev.map(proj =>
                      proj.id === id ? { ...proj, comment_count: proj.comment_count + 1 } : proj
                    ))
                  }}
                />
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
                      style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '1.1rem', color: 'var(--brown-dark)', flexShrink: 0 }}
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
                    {u.friendship_status === 'accepted' || sentRequests.has(u.id) && u.friendship_status === 'accepted' ? (
                      <button disabled style={{ flex: 1, padding: '0.5rem', background: 'var(--moss)', color: '#fff', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <UserCheck size={13} /> Friends
                      </button>
                    ) : u.friendship_status === 'pending' ? (
                      <button disabled style={{ flex: 1, padding: '0.5rem', background: 'var(--parchment)', color: 'var(--text-muted)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, border: '1px solid var(--border)' }}>
                        <Check size={13} /> Pending
                      </button>
                    ) : sentRequests.has(u.id) ? (
                      <button disabled style={{ flex: 1, padding: '0.5rem', background: 'var(--parchment)', color: 'var(--text-muted)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, border: '1px solid var(--border)' }}>
                        <Check size={13} /> Pending
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

function PublicProjectCard({
  project,
  getEmoji,
  onLikeToggle,
  onCommentAdd,
  friendInteractions,
}: {
  project: PublicProject
  getEmoji: (type: string) => string
  onLikeToggle: (id: number, liked: boolean) => void
  onCommentAdd: (id: number) => void
  friendInteractions?: FriendInteraction[]
}) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<ProjectComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localCommentCount, setLocalCommentCount] = useState(project.comment_count)
  const [replyingToId, setReplyingToId] = useState<number | null>(null)
  const [replyTexts, setReplyTexts] = useState<Record<number, string>>({})
  const [submittingReply, setSubmittingReply] = useState(false)

  const countAllComments = (list: ProjectComment[]): number =>
    list.reduce((sum, c) => sum + 1 + countAllComments(c.replies ?? []), 0)

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (project.is_liked_by_me) {
        await api.delete(`/projects/${project.id}/like`)
      } else {
        await api.post(`/projects/${project.id}/like`)
      }
      onLikeToggle(project.id, !project.is_liked_by_me)
    } catch {
      toast.error('Failed to update like')
    }
  }

  const toggleComments = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!showComments && comments.length === 0) {
      setLoadingComments(true)
      try {
        const r = await api.get(`/projects/${project.id}/comments`)
        setComments(r.data)
      } catch {}
      setLoadingComments(false)
    }
    setShowComments(prev => !prev)
  }

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/projects/${project.id}/comments`, { content: commentText.trim() })
      const r = await api.get(`/projects/${project.id}/comments`)
      setComments(r.data)
      setCommentText('')
      const total = countAllComments(r.data)
      setLocalCommentCount(total)
      onCommentAdd(project.id)
    } catch {
      toast.error('Failed to post comment')
    }
    setSubmitting(false)
  }

  const submitReply = async (e: React.FormEvent, parentId: number) => {
    e.preventDefault()
    const text = (replyTexts[parentId] ?? '').trim()
    if (!text) return
    setSubmittingReply(true)
    try {
      await api.post(`/projects/${project.id}/comments`, { content: text, parent_id: parentId })
      const r = await api.get(`/projects/${project.id}/comments`)
      setComments(r.data)
      setReplyingToId(null)
      setReplyTexts(prev => ({ ...prev, [parentId]: '' }))
      setLocalCommentCount(countAllComments(r.data))
    } catch {
      toast.error('Failed to post reply')
    }
    setSubmittingReply(false)
  }

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden', transition: 'box-shadow 0.2s' }}>
      {/* Friend interaction strip */}
      {friendInteractions && friendInteractions.length > 0 && (
        <div style={{ padding: '0.5rem 0.875rem', background: 'var(--amber-glow)', borderBottom: '1px solid var(--amber)', fontSize: '0.72rem', color: 'var(--brown-mid)', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          {friendInteractions.slice(0, 3).map((ia, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {ia.action === 'liked' ? '❤️' : '💬'}
              <strong>@{ia.friend_username}</strong>
              {ia.action === 'liked' ? 'liked' : 'commented'}
              {i < Math.min(friendInteractions.length, 3) - 1 && <span style={{ color: 'var(--text-muted)', marginLeft: '0.1rem' }}>·</span>}
            </span>
          ))}
        </div>
      )}

      {/* Clickable header — navigates to project */}
      <Link to={`/projects/${project.id}/view`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
        {project.cover_photo_url ? (
          <img src={project.cover_photo_url} alt={project.name} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '80px', background: 'var(--parchment)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
            {getEmoji(project.fermentation_type)}
          </div>
        )}
        <div style={{ padding: '1rem 1rem 0.875rem' }}>
          <div style={{ flex: 1, minWidth: 0, marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '0.925rem', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</h3>
            {project.description && (
              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

      {/* Interaction area — does not navigate */}
      <div style={{ padding: '0 1rem 1rem' }}>
        {/* Author row — sits directly above the like/comment bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', paddingBottom: '0.75rem' }}>
          <span>by <strong style={{ color: 'var(--text-secondary)' }}>@{project.author_username}</strong></span>
          <span>{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', marginBottom: showComments ? '0.75rem' : 0 }}>
          <button
            onClick={handleLike}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              background: 'none', padding: '0.25rem 0.625rem', borderRadius: '20px',
              color: project.is_liked_by_me ? '#e05252' : 'var(--text-muted)',
              fontSize: '0.8rem', fontWeight: 600,
              border: `1px solid ${project.is_liked_by_me ? '#e0525240' : 'var(--border-light)'}`,
              transition: 'all 0.15s',
            }}
          >
            <Heart size={14} fill={project.is_liked_by_me ? '#e05252' : 'none'} />
            {project.like_count}
          </button>
          <button
            onClick={toggleComments}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              background: 'none', padding: '0.25rem 0.625rem', borderRadius: '20px',
              color: showComments ? 'var(--brown-mid)' : 'var(--text-muted)',
              fontSize: '0.8rem', fontWeight: 600,
              border: `1px solid ${showComments ? 'var(--border)' : 'var(--border-light)'}`,
              transition: 'all 0.15s',
            }}
          >
            <MessageCircle size={14} />
            {showComments ? countAllComments(comments) : localCommentCount}
          </button>
        </div>

        {showComments && (
          <div>
            {loadingComments ? (
              <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading comments...</div>
            ) : (
              <div style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {comments.length === 0 && (
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>No comments yet — be the first!</div>
                )}
                {comments.map(c => (
                  <div key={c.id}>
                    <div style={{ fontSize: '0.775rem', background: 'var(--parchment)', borderRadius: '8px', padding: '0.5rem 0.625rem', lineHeight: 1.4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--brown-dark)', marginRight: '0.35rem' }}>@{c.author_username}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{c.content}</span>
                        </div>
                        <button
                          onClick={() => { setReplyingToId(replyingToId === c.id ? null : c.id); setReplyTexts(prev => ({ ...prev, [c.id]: `@${c.author_username} ` })) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.68rem', whiteSpace: 'nowrap', marginLeft: '0.5rem', padding: '0 2px' }}
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                    {/* Replies */}
                    {(c.replies ?? []).map(reply => (
                      <div key={reply.id} style={{ marginLeft: '1.25rem', marginTop: '0.25rem', fontSize: '0.755rem', background: 'var(--warm-white)', borderRadius: '7px', padding: '0.4rem 0.625rem', lineHeight: 1.4, border: '1px solid var(--border-light)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--brown-dark)', marginRight: '0.35rem' }}>@{reply.author_username}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{reply.content}</span>
                      </div>
                    ))}
                    {/* Reply input */}
                    {replyingToId === c.id && (
                      <form onSubmit={e => submitReply(e, c.id)} style={{ marginLeft: '1.25rem', marginTop: '0.3rem', display: 'flex', gap: '0.3rem' }}>
                        <input
                          autoFocus
                          value={replyTexts[c.id] ?? ''}
                          onChange={e => setReplyTexts(prev => ({ ...prev, [c.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Escape') setReplyingToId(null) }}
                          style={{ flex: 1, padding: '0.35rem 0.5rem', border: '1px solid var(--amber)', borderRadius: '6px', background: 'var(--warm-white)', fontSize: '0.755rem', fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
                        />
                        <button type="submit" disabled={submittingReply || !(replyTexts[c.id] ?? '').trim()} style={{ padding: '0.35rem 0.6rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '6px', fontSize: '0.73rem', fontWeight: 600, opacity: (submittingReply || !(replyTexts[c.id] ?? '').trim()) ? 0.6 : 1 }}>
                          {submittingReply ? '…' : 'Reply'}
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={submitComment} style={{ display: 'flex', gap: '0.375rem' }}>
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                style={{ flex: 1, padding: '0.4rem 0.625rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--warm-white)', fontSize: '0.775rem', color: 'var(--text-primary)' }}
              />
              <button
                type="submit"
                disabled={submitting || !commentText.trim()}
                style={{ padding: '0.4rem 0.75rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontSize: '0.775rem', fontWeight: 600, opacity: (submitting || !commentText.trim()) ? 0.6 : 1 }}
              >
                {submitting ? '…' : 'Post'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
