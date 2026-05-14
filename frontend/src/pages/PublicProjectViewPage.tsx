import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useFermentationTypes } from '../hooks/useLookups'
import { useAuth } from '../hooks/useAuth'
import { ArrowLeft, FlaskConical, Thermometer, Droplets, Activity, Wind, Heart, MessageCircle, Send, Trash2, Dna } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { ProjectComment } from '../types'

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
  created_at: string
}

interface AlbumPhoto {
  id: number
  url: string
  caption: string | null
  taken_at: string
}

interface SharedYeast {
  yeast_id: number
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
  photos: AlbumPhoto[]
  yeast_strain: SharedYeast | null
  like_count: number
  is_liked_by_me: boolean
  comment_count: number
}

export default function PublicProjectViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState<PublicProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const { getEmoji } = useFermentationTypes()

  // Likes
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [liking, setLiking] = useState(false)

  // Comments
  const [comments, setComments] = useState<ProjectComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [replyingTo, setReplyingTo] = useState<ProjectComment | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)

  const countAllComments = (list: ProjectComment[]): number =>
    list.reduce((sum, c) => sum + 1 + countAllComments(c.replies ?? []), 0)

  const loadComments = () =>
    api.get(`/projects/${id}/comments`).then(r => setComments(r.data)).catch(() => {})

  useEffect(() => {
    api.get(`/projects/${id}/public`)
      .then(r => {
        setProject(r.data)
        setLiked(r.data.is_liked_by_me)
        setLikeCount(r.data.like_count)
      })
      .catch(() => navigate('/explore', { replace: true }))
      .finally(() => setLoading(false))
    loadComments()
  }, [id])

  const toggleLike = async () => {
    if (liking) return
    setLiking(true)
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikeCount(c => wasLiked ? c - 1 : c + 1)
    try {
      if (wasLiked) await api.delete(`/projects/${id}/like`)
      else await api.post(`/projects/${id}/like`)
    } catch {
      setLiked(wasLiked)
      setLikeCount(c => wasLiked ? c + 1 : c - 1)
    } finally {
      setLiking(false)
    }
  }

  const submitComment = async () => {
    const text = commentText.trim()
    if (!text || submittingComment) return
    setSubmittingComment(true)
    try {
      const r = await api.post(`/projects/${id}/comments`, { content: text })
      setComments(prev => [...prev, r.data])
      setCommentText('')
    } catch {
      /* ignore */
    } finally {
      setSubmittingComment(false)
    }
  }

  const submitReply = async (parentId: number) => {
    const text = replyText.trim()
    if (!text || submittingReply) return
    setSubmittingReply(true)
    try {
      await api.post(`/projects/${id}/comments`, { content: text, parent_id: parentId })
      setReplyingTo(null)
      setReplyText('')
      loadComments()
    } catch {
      /* ignore */
    } finally {
      setSubmittingReply(false)
    }
  }

  const deleteComment = async (commentId: number, isReply = false) => {
    await api.delete(`/projects/${id}/comments/${commentId}`)
    if (isReply) {
      setComments(prev => prev.map(c => ({
        ...c,
        replies: (c.replies ?? []).filter(r => r.id !== commentId),
      })))
    } else {
      setComments(prev => prev.filter(c => c.id !== commentId))
    }
  }

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
    minutesElapsed: (new Date(m.logged_at).getTime() - firstTs) / 60000,
    ts: new Date(m.logged_at).getTime(),
    ph: m.ph ?? null,
    sg: m.specific_gravity ?? null,
    abv: m.alcohol_by_volume ?? null,
  }))
  const latestM = sortedMeasurements.at(-1)
  const daysSince = project.start_date
    ? Math.floor((Date.now() - new Date(project.start_date).getTime()) / 86400000)
    : null
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


      {/* Header */}
      <div className="fade-in" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.375rem' }}>
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
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.875rem', background: 'var(--card-bg)', border: '1px solid var(--border-light)', borderRadius: '10px', textDecoration: 'none', marginTop: '0.375rem' }}
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

        {/* Like bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
          <button
            onClick={toggleLike}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.875rem', borderRadius: '20px', border: `1px solid ${liked ? '#c4705a' : 'var(--border)'}`, background: liked ? '#c4705a18' : 'transparent', color: liked ? '#c4705a' : 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <Heart size={14} fill={liked ? '#c4705a' : 'none'} /> {likeCount} {likeCount === 1 ? 'like' : 'likes'}
          </button>
          <button
            onClick={() => commentInputRef.current?.focus()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.875rem', borderRadius: '20px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}
          >
            <MessageCircle size={14} /> {countAllComments(comments)} comment{countAllComments(comments) !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Cover photo */}
      {project.cover_photo_url && (
        <div className="fade-in" style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '1.25rem', maxHeight: '320px' }}>
          <img
            src={project.cover_photo_url}
            alt="Cover"
            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
            onClick={() => setLightbox(project.cover_photo_url!)}
          />
        </div>
      )}

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
            {project.vessel_type && <Detail icon={<FlaskConical size={13} />} label="Vessel">{project.vessel_type}</Detail>}
            {project.batch_size_liters && <Detail icon={<Droplets size={13} />} label="Batch Size">{project.batch_size_liters} L</Detail>}
            {project.initial_gravity && <Detail icon={<Activity size={13} />} label="OG">{project.initial_gravity.toFixed(3)}</Detail>}
            {project.initial_ph && <Detail icon={<Droplets size={13} />} label="Starting pH">{project.initial_ph.toFixed(1)}</Detail>}
            {project.fermentation_temp_celsius && (
              <Detail icon={<Thermometer size={13} />} label="Temp">{toF(project.fermentation_temp_celsius)}°F</Detail>
            )}
          </div>
          {project.yeast_strain && (
            <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.625rem' }}>
              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: '0.2rem' }}>
                  <Dna size={12} /> Yeast
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {project.yeast_strain.name}
                  {project.yeast_strain.strain_code && (
                    <span style={{ fontFamily: 'monospace', opacity: 0.7, fontSize: '0.82em', marginLeft: '0.3em' }}>({project.yeast_strain.strain_code})</span>
                  )}
                </span>
                {project.yeast_strain.brand && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>{project.yeast_strain.brand}</span>
                )}
              </div>
              <Link
                to={`/yeasts?yeast=${project.yeast_strain.yeast_id}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.45rem 0.875rem', background: 'var(--parchment)', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                <Dna size={13} /> View Yeast Profile
              </Link>
            </div>
          )}
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
                labelFormatter={(_l, payload) => {
                  const ts = (payload as any)?.[0]?.payload?.ts
                  return ts ? format(new Date(ts), 'MMM d, yyyy h:mm a') : ''
                }} />
              <Line type="monotone" dataKey="ph" stroke="#4a6741" strokeWidth={2.5} dot={{ fill: '#4a6741', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
            {sortedMeasurements.length} reading{sortedMeasurements.length !== 1 ? 's' : ''} logged
          </p>
        </div>
      )}

      {/* Album photos */}
      {project.photos.length > 0 && (
        <div className="fade-in-delay-2" style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Photos ({project.photos.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.625rem' }}>
            {project.photos.map((p) => (
              <div
                key={p.id}
                onClick={() => setLightbox(p.url)}
                style={{ borderRadius: '10px', overflow: 'hidden', aspectRatio: '1', cursor: 'zoom-in', background: 'var(--parchment)', position: 'relative' }}
              >
                <img src={p.url} alt={p.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {p.caption && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.55))', padding: '1.5rem 0.5rem 0.4rem', fontSize: '0.68rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.caption}
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

      {/* Comments */}
      <div className="fade-in-delay-2" style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid var(--border-light)', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Comments {countAllComments(comments) > 0 && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({countAllComments(comments)})</span>}
        </h2>

        {comments.length === 0 && (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>No comments yet. Be the first!</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.25rem' }}>
          {comments.map(c => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={user?.id}
              replyingTo={replyingTo}
              replyText={replyText}
              submittingReply={submittingReply}
              onReply={c => { setReplyingTo(c); setReplyText(`@${c.author_username} `) }}
              onCancelReply={() => { setReplyingTo(null); setReplyText('') }}
              onReplyTextChange={setReplyText}
              onSubmitReply={submitReply}
              onDelete={deleteComment}
            />
          ))}
        </div>

        {/* Comment input */}
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-end' }}>
          <textarea
            ref={commentInputRef}
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
            placeholder="Add a comment..."
            rows={2}
            style={{ flex: 1, padding: '0.6rem 0.875rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--warm-white)', fontSize: '0.875rem', resize: 'none', fontFamily: 'DM Sans, sans-serif' }}
          />
          <button
            onClick={submitComment}
            disabled={!commentText.trim() || submittingComment}
            style={{ padding: '0.6rem 0.875rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', border: 'none', cursor: commentText.trim() ? 'pointer' : 'default', opacity: commentText.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: '0.82rem' }}
          >
            <Send size={14} /> Post
          </button>
        </div>
      </div>

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

interface CommentItemProps {
  comment: ProjectComment
  currentUserId?: number
  replyingTo: ProjectComment | null
  replyText: string
  submittingReply: boolean
  onReply: (comment: ProjectComment) => void
  onCancelReply: () => void
  onReplyTextChange: (text: string) => void
  onSubmitReply: (parentId: number) => void
  onDelete: (commentId: number, isReply?: boolean) => void
  isReply?: boolean
}

function CommentItem({
  comment: c,
  currentUserId,
  replyingTo,
  replyText,
  submittingReply,
  onReply,
  onCancelReply,
  onReplyTextChange,
  onSubmitReply,
  onDelete,
  isReply = false,
}: CommentItemProps) {
  const cAuthor = c.author_display_name || c.author_username
  const isOwn = currentUserId === c.user_id
  const showReplyBox = replyingTo?.id === c.id

  return (
    <div style={{ marginLeft: isReply ? '2.25rem' : 0 }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{ width: isReply ? 26 : 30, height: isReply ? 26 : 30, borderRadius: '50%', background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '0.75rem', color: 'var(--brown-dark)', flexShrink: 0, overflow: 'hidden' }}>
          {c.author_avatar_url ? (
            <img src={c.author_avatar_url} alt={cAuthor} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : cAuthor[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, background: isReply ? 'var(--warm-white)' : 'var(--parchment)', borderRadius: '10px', padding: '0.6rem 0.875rem', border: isReply ? '1px solid var(--border-light)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{cAuthor}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
              {!isReply && (
                <button
                  onClick={() => onReply(c)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem' }}
                >
                  <MessageCircle size={10} /> Reply
                </button>
              )}
              {isOwn && (
                <button onClick={() => onDelete(c.id, isReply)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{c.content}</p>
        </div>
      </div>

      {/* Reply input box */}
      {showReplyBox && (
        <div style={{ marginLeft: '2.25rem', marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <textarea
            autoFocus
            value={replyText}
            onChange={e => onReplyTextChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmitReply(c.id) } if (e.key === 'Escape') onCancelReply() }}
            rows={2}
            style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid var(--amber)', borderRadius: '8px', background: 'var(--warm-white)', fontSize: '0.82rem', resize: 'none', fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <button
              onClick={() => onSubmitReply(c.id)}
              disabled={!replyText.trim() || submittingReply}
              style={{ padding: '0.45rem 0.75rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '6px', border: 'none', cursor: replyText.trim() ? 'pointer' : 'default', opacity: replyText.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: '0.78rem' }}
            >
              <Send size={12} /> Reply
            </button>
            <button
              onClick={onCancelReply}
              style={{ padding: '0.35rem 0.75rem', background: 'transparent', color: 'var(--text-muted)', borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Nested replies */}
      {(c.replies ?? []).length > 0 && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {(c.replies ?? []).map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              replyingTo={replyingTo}
              replyText={replyText}
              submittingReply={submittingReply}
              onReply={onReply}
              onCancelReply={onCancelReply}
              onReplyTextChange={onReplyTextChange}
              onSubmitReply={onSubmitReply}
              onDelete={onDelete}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  )
}
