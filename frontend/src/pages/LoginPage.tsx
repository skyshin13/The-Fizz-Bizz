import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      toast.error(err?.message || err?.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--brown-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      {/* Background texture */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(200,131,42,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(74,103,65,0.1) 0%, transparent 50%)', pointerEvents: 'none' }} />

      <div className="fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🫧</div>
          <h1 style={{ fontFamily: 'Fraunces, serif', color: 'var(--amber-glow)', fontSize: '2rem', marginBottom: '0.25rem' }}>
            Fizz Bizz
          </h1>
          <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: '0.875rem' }}>Fermentation Studio</p>
        </div>

        {/* Form card */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Welcome back</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? <><span className="spinner" style={{ display: 'inline-block', marginRight: 8 }} />Signing in...</> : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            No account? <Link to="/register" style={{ color: 'var(--amber)', fontWeight: 500 }}>Create one</Link>
          </div>

        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.875rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--warm-white)',
  fontSize: '0.9rem',
  color: 'var(--text-primary)',
  transition: 'border-color 0.2s',
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  background: 'var(--amber)',
  color: 'var(--brown-dark)',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: '0.9rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
