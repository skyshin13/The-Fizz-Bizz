import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', username: '', password: '', displayName: '' })
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await register(form.email, form.username, form.password, form.displayName)
      toast.success('Welcome to Fizz Bizz! 🫧')
      navigate('/')
    } catch (err: any) {
      toast.error(err?.message || err?.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--brown-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(200,131,42,0.15) 0%, transparent 50%)', pointerEvents: 'none' }} />

      <div className="fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🫧</div>
          <h1 style={{ fontFamily: 'Fraunces, serif', color: 'var(--amber-glow)', fontSize: '1.75rem' }}>Create Account</h1>
        </div>

        <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          <form onSubmit={handleSubmit}>
            {[
              { label: 'Display Name', key: 'displayName' as const, type: 'text', placeholder: 'Alex the Brewer' },
              { label: 'Username', key: 'username' as const, type: 'text', placeholder: 'brewmaster42', required: true },
              { label: 'Email', key: 'email' as const, type: 'email', placeholder: 'you@example.com', required: true },
              { label: 'Password', key: 'password' as const, type: 'password', placeholder: '8+ characters', required: true },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  {field.label}{field.required && <span style={{ color: 'var(--rust)' }}> *</span>}
                </label>
                <input
                  type={field.type}
                  value={form[field.key]}
                  onChange={set(field.key)}
                  required={field.required}
                  placeholder={field.placeholder}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--warm-white)', fontSize: '0.9rem', color: 'var(--text-primary)' }}
                />
              </div>
            ))}

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
              {loading ? 'Creating account...' : 'Start Fermenting →'}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--amber)', fontWeight: 500 }}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
