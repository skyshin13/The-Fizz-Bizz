import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { PublicUserProfile, FriendRequest, PublicProject } from '../types'
import { useFermentationTypes } from '../hooks/useLookups'
import toast from 'react-hot-toast'
import { UserPlus, UserCheck, UserX, Clock, Check, Users, FlaskConical, Edit2, X, Phone, Bell } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user: me } = useAuth()
  const isOwnProfile = !username || username === me?.username

  return isOwnProfile ? <OwnProfile /> : <OtherProfile username={username!} />
}

// ─── Own Profile ─────────────────────────────────────────────────────────────

function OwnProfile() {
  const { user: me, refreshUser } = useAuth()
  const [friends, setFriends] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)

  const loadFriends = () => {
    setLoading(true)
    api.get('/friends/').then(r => setFriends(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { loadFriends() }, [])

  const accepted = friends.filter(f => f.status === 'accepted')
  const pendingReceived = friends.filter(f => f.status === 'pending' && f.receiver_id === me?.id)
  const pendingSent = friends.filter(f => f.status === 'pending' && f.requester_id === me?.id)

  const acceptRequest = async (id: number) => {
    try {
      await api.post(`/friends/accept/${id}`)
      toast.success('Friend accepted!')
      loadFriends()
    } catch {
      toast.error('Failed to accept request')
    }
  }

  const removeFriend = async (id: number) => {
    try {
      await api.delete(`/friends/${id}`)
      loadFriends()
    } catch {
      toast.error('Failed to remove')
    }
  }

  return (
    <div style={{ padding: '2.5rem', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem', padding: '2rem', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '1.75rem', color: 'var(--brown-dark)', flexShrink: 0 }}>
          {me?.display_name?.[0]?.toUpperCase() || me?.username?.[0]?.toUpperCase() || '?'}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>{me?.display_name || me?.username}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>@{me?.username}</p>
          {me?.bio && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{me.bio}</p>}
          {me?.phone_number && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Phone size={12} /> {me.phone_number}
              {me.sms_notifications_enabled && <Bell size={12} color="var(--moss)" style={{ marginLeft: 4 }} />}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowEdit(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 0.875rem', background: 'var(--parchment)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <Edit2 size={13} /> Edit Profile
        </button>
      </div>

      {showEdit && (
        <EditProfileModal
          me={me}
          onClose={() => setShowEdit(false)}
          onSaved={() => { refreshUser(); setShowEdit(false) }}
        />
      )}

      {/* Pending requests banner */}
      {pendingReceived.length > 0 && (
        <div className="fade-in" style={{ background: 'var(--amber-glow)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem', border: '1px solid var(--amber)' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '0.875rem', color: 'var(--brown-dark)' }}>Friend Requests ({pendingReceived.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {pendingReceived.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Avatar name={f.friend.display_name || f.friend.username} size={32} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{f.friend.display_name || f.friend.username}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.775rem' }}> @{f.friend.username}</span>
                </div>
                <button onClick={() => acceptRequest(f.id)} style={{ padding: '0.375rem 0.875rem', background: 'var(--moss)', color: '#fff', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={13} /> Accept
                </button>
                <button onClick={() => removeFriend(f.id)} style={{ padding: '0.375rem 0.625rem', background: 'transparent', color: 'var(--text-muted)', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid var(--border)' }}>
                  Decline
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div className="fade-in-delay-1">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <Users size={16} color="var(--brown-mid)" />
          <h2 style={{ fontSize: '1.1rem' }}>Friends ({accepted.length})</h2>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : accepted.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--card-bg)', borderRadius: '12px', border: '2px dashed var(--border)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤝</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No friends yet. <Link to="/explore" style={{ color: 'var(--amber)' }}>Explore</Link> to find fellow brewers!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {accepted.map(f => (
              <FriendCard key={f.id} friendship={f} onRemove={() => removeFriend(f.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Pending sent */}
      {pendingSent.length > 0 && (
        <div className="fade-in-delay-2" style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Pending Requests Sent</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingSent.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--card-bg)', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <Avatar name={f.friend.display_name || f.friend.username} size={32} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{f.friend.display_name || f.friend.username}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.775rem' }}> @{f.friend.username}</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Clock size={11} /> Pending
                </span>
                <button onClick={() => removeFriend(f.id)} title="Cancel request" style={{ padding: 4, background: 'transparent', color: 'var(--text-muted)', borderRadius: 4 }}>
                  <UserX size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Other User's Profile ─────────────────────────────────────────────────────

function OtherProfile({ username }: { username: string }) {
  const { user: me } = useAuth()
  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const { getEmoji } = useFermentationTypes()
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    api.get(`/users/${username}`)
      .then(r => setProfile(r.data))
      .catch(() => toast.error('User not found'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [username])

  const sendRequest = async () => {
    try {
      await api.post(`/friends/request/${username}`)
      toast.success('Friend request sent!')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to send request')
    }
  }

  const removeFriend = async () => {
    if (!profile?.friendship_id) return
    try {
      await api.delete(`/friends/${profile.friendship_id}`)
      toast.success('Removed')
      load()
    } catch {
      toast.error('Failed')
    }
  }

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
  if (!profile) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>User not found.</div>

  const friendBtn = () => {
    if (!profile.friendship_status) {
      return (
        <button onClick={sendRequest} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.625rem 1.25rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem' }}>
          <UserPlus size={15} /> Add Friend
        </button>
      )
    }
    if (profile.friendship_status === 'pending') {
      return (
        <button onClick={removeFriend} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.625rem 1.25rem', background: 'var(--parchment)', color: 'var(--text-secondary)', borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem', border: '1px solid var(--border)' }}>
          <Clock size={15} /> {profile.is_requester ? 'Pending' : 'Accept Request'}
        </button>
      )
    }
    return (
      <button onClick={removeFriend} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.625rem 1.25rem', background: 'var(--parchment)', color: 'var(--moss)', borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem', border: '1px solid var(--border)' }}>
        <UserCheck size={15} /> Friends
      </button>
    )
  }

  return (
    <div style={{ padding: '2.5rem', maxWidth: '900px', margin: '0 auto' }}>
      {/* Profile header */}
      <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem', padding: '2rem', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: '1.75rem', color: 'var(--brown-dark)', flexShrink: 0 }}>
          {profile.display_name?.[0]?.toUpperCase() || profile.username[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>{profile.display_name || profile.username}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>@{profile.username}</p>
          {profile.bio && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{profile.bio}</p>}
          <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
            Brewing since {format(new Date(profile.created_at), 'MMMM yyyy')} · {profile.public_project_count} public project{profile.public_project_count !== 1 ? 's' : ''}
          </p>
        </div>
        <div>{friendBtn()}</div>
      </div>

      {/* Public projects */}
      <div className="fade-in-delay-1">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <FlaskConical size={16} color="var(--brown-mid)" />
          <h2 style={{ fontSize: '1.1rem' }}>Public Fermentations ({profile.public_projects.length})</h2>
        </div>

        {profile.public_projects.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--card-bg)', borderRadius: '12px', border: '2px dashed var(--border)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🫙</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No public projects yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {profile.public_projects.map(p => (
              <PublicProjectMiniCard key={p.id} project={p} getEmoji={getEmoji} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: size * 0.4, color: 'var(--brown-dark)', flexShrink: 0 }}>
      {name[0]?.toUpperCase()}
    </div>
  )
}

function FriendCard({ friendship, onRemove }: { friendship: FriendRequest; onRemove: () => void }) {
  const navigate = useNavigate()
  const f = friendship.friend
  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-light)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <Avatar name={f.display_name || f.username} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.display_name || f.username}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{f.username}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{f.public_project_count} public projects</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={() => navigate(`/profile/${f.username}`)} style={{ padding: '0.3rem 0.6rem', background: 'var(--parchment)', color: 'var(--text-secondary)', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border)' }}>
          View
        </button>
        <button onClick={onRemove} style={{ padding: '0.3rem 0.6rem', background: 'transparent', color: 'var(--text-muted)', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border)' }}>
          Remove
        </button>
      </div>
    </div>
  )
}

function EditProfileModal({ me, onClose, onSaved }: { me: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    display_name: me?.display_name || '',
    bio: me?.bio || '',
    phone_number: me?.phone_number || '',
    sms_notifications_enabled: me?.sms_notifications_enabled ?? false,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.patch('/users/me', {
        display_name: form.display_name || null,
        bio: form.bio || null,
        phone_number: form.phone_number || null,
        sms_notifications_enabled: form.sms_notifications_enabled,
      })
      toast.success('Profile updated!')
      onSaved()
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const iStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 0.875rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--warm-white)', fontSize: '0.875rem', color: 'var(--text-primary)', boxSizing: 'border-box' }
  const lStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Edit Profile</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lStyle}>Display Name</label>
            <input value={form.display_name} onChange={set('display_name')} placeholder={me?.username} style={iStyle} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lStyle}>Bio</label>
            <textarea value={form.bio} onChange={set('bio')} placeholder="Tell other brewers about yourself..." style={{ ...iStyle, resize: 'vertical', minHeight: '70px' }} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lStyle}>
              <Phone size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Phone Number (for SMS reminders)
            </label>
            <input
              type="tel"
              value={form.phone_number}
              onChange={set('phone_number')}
              placeholder="+1 555 000 0000"
              style={iStyle}
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Include country code, e.g. +1 for US. Used for fermentation reminders via SMS.
            </p>
          </div>
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem', background: 'var(--parchment)', borderRadius: '8px' }}>
            <input
              type="checkbox"
              id="sms_toggle"
              checked={form.sms_notifications_enabled}
              onChange={e => setForm(prev => ({ ...prev, sms_notifications_enabled: e.target.checked }))}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="sms_toggle" style={{ fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>
              <Bell size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--moss)' }} />
              Enable SMS reminders for my fermentation projects
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.7rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 2, padding: '0.7rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PublicProjectMiniCard({ project, getEmoji }: { project: PublicProject; getEmoji: (t: string) => string }) {
  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
      {project.cover_photo_url ? (
        <img src={project.cover_photo_url} alt={project.name} style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ height: '60px', background: 'var(--parchment)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
          {getEmoji(project.fermentation_type)}
        </div>
      )}
      <div style={{ padding: '0.875rem' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</h3>
        {project.description && <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.description}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.625rem' }}>
          <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '20px', background: project.status === 'active' ? '#4a674118' : '#3d4e5c18', color: project.status === 'active' ? 'var(--moss)' : 'var(--slate)' }}>
            {project.status}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  )
}
