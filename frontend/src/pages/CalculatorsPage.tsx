import { useState } from 'react'
import api from '../lib/api'
import { useSugarTypes } from '../hooks/useLookups'
import toast from 'react-hot-toast'
import { Calculator, FlaskConical, Zap } from 'lucide-react'

export default function CalculatorsPage() {
  const [activeTab, setActiveTab] = useState<'abv' | 'priming'>('abv')

  return (
    <div style={{ padding: '2.5rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="fade-in" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Fermentation Calculators</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Mathematical tools for precise fermentation management.</p>
      </div>

      <div className="fade-in-delay-1" style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        {[
          { id: 'abv' as const, label: 'ABV Calculator', icon: FlaskConical },
          { id: 'priming' as const, label: 'Priming Sugar', icon: Calculator },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.625rem 1.25rem', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 500, background: activeTab === id ? 'var(--brown-dark)' : 'var(--card-bg)', color: activeTab === id ? 'var(--amber-glow)' : 'var(--text-secondary)', border: '1px solid var(--border)', transition: 'all 0.2s' }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="fade-in-delay-2">
        {activeTab === 'abv' ? <ABVCalculator /> : <PrimingSugarCalculator />}
      </div>
    </div>
  )
}

function ABVCalculator() {
  const [og, setOg] = useState('1.054')
  const [fg, setFg] = useState('1.010')
  const [result, setResult] = useState<{ abv_percent: number; attenuation_percent: number; calories_per_12oz: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const calculate = async () => {
    setLoading(true)
    try {
      const res = await api.post('/calculations/abv', {
        original_gravity: parseFloat(og),
        final_gravity: parseFloat(fg),
      })
      setResult(res.data)
    } catch {
      toast.error('Calculation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.75rem', border: '1px solid var(--border-light)' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>ABV Calculator</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Uses the Standard Homebrew ABV formula: (OG − FG) × 131.25. For high-gravity brews (OG &gt; 1.060), a more accurate formula is applied automatically.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <label style={lStyle}>Original Gravity (OG)</label>
          <input type="number" step="0.001" value={og} onChange={e => setOg(e.target.value)} style={iStyle} />
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>Measured before fermentation starts</p>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={lStyle}>Final Gravity (FG)</label>
          <input type="number" step="0.001" value={fg} onChange={e => setFg(e.target.value)} style={iStyle} />
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>Measured after fermentation is complete</p>
        </div>

        <button onClick={calculate} disabled={loading} style={{ width: '100%', padding: '0.75rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
          {loading ? 'Calculating...' : <><Zap size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Calculate ABV</>}
        </button>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.75rem', border: '1px solid var(--border-light)' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Results</h2>
        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <ResultCard label="Alcohol by Volume" value={`${result.abv_percent.toFixed(2)}%`} color="var(--rust)" />
            <ResultCard label="Apparent Attenuation" value={`${result.attenuation_percent.toFixed(1)}%`} color="var(--amber)" sublabel="Percentage of fermentable sugars consumed" />
            <ResultCard label="Approx. Calories (12 oz)" value={`${result.calories_per_12oz} kcal`} color="var(--slate)" />

            <div style={{ padding: '0.875rem', background: 'var(--parchment)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>OG:</strong> {og} → <strong>FG:</strong> {fg}<br />
              {result.abv_percent < 2 ? '🍵 Low-alcohol / probiotic range' :
               result.abv_percent < 5 ? '🍺 Session strength' :
               result.abv_percent < 8 ? '🍺 Standard strength' : '🥃 High gravity'}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <FlaskConical size={32} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
            <p style={{ fontSize: '0.875rem' }}>Enter gravity readings and calculate</p>
          </div>
        )}
      </div>
    </div>
  )
}

function PrimingSugarCalculator() {
  const { sugarTypes } = useSugarTypes()
  const [form, setForm] = useState({
    batch_size_liters: '19',
    current_gravity: '1.010',
    target_co2_volumes: '2.5',
    fermentation_temp_celsius: '18',
    sugar_type: 'table_sugar',
  })
  const [result, setResult] = useState<{ sugar_grams: number; sugar_oz: number; sugar_type: string; notes: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const calculate = async () => {
    setLoading(true)
    try {
      const res = await api.post('/calculations/priming-sugar', {
        batch_size_liters: parseFloat(form.batch_size_liters),
        current_gravity: parseFloat(form.current_gravity),
        target_co2_volumes: parseFloat(form.target_co2_volumes),
        fermentation_temp_celsius: parseFloat(form.fermentation_temp_celsius),
        sugar_type: form.sugar_type,
      })
      setResult(res.data)
    } catch {
      toast.error('Calculation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.75rem', border: '1px solid var(--border-light)' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Priming Sugar Calculator</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Calculate how much sugar to add for bottle carbonation. Factors in dissolved CO₂ at your fermentation temperature.
        </p>

        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={lStyle}>Batch Size (Liters)</label>
            <input type="number" step="0.5" value={form.batch_size_liters} onChange={set('batch_size_liters')} style={iStyle} />
          </div>
          <div>
            <label style={lStyle}>Current Gravity (FG)</label>
            <input type="number" step="0.001" value={form.current_gravity} onChange={set('current_gravity')} style={iStyle} />
          </div>
          <div>
            <label style={lStyle}>Target CO₂ Volumes</label>
            <input type="number" step="0.1" value={form.target_co2_volumes} onChange={set('target_co2_volumes')} style={iStyle} />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>Beer: 2.4, Kombucha/soda: 3.0–3.5, Lager: 2.5</p>
          </div>
          <div>
            <label style={lStyle}>Fermentation Temp (°C)</label>
            <input type="number" step="0.5" value={form.fermentation_temp_celsius} onChange={set('fermentation_temp_celsius')} style={iStyle} />
          </div>
          <div>
            <label style={lStyle}>Sugar Type</label>
            <select value={form.sugar_type} onChange={set('sugar_type')} style={iStyle}>
              {sugarTypes.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button onClick={calculate} disabled={loading} style={{ width: '100%', padding: '0.75rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontWeight: 600 }}>
          {loading ? 'Calculating...' : <><Calculator size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Calculate Sugar</>}
        </button>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.75rem', border: '1px solid var(--border-light)' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Results</h2>
        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <ResultCard label="Sugar Required" value={`${result.sugar_grams}g`} color="var(--amber)" sublabel={`${result.sugar_oz} oz`} />
            <div style={{ padding: '0.875rem', background: 'var(--parchment)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong>Instructions:</strong><br />{result.notes}
            </div>
            <div style={{ padding: '0.875rem', background: '#b54a2c12', border: '1px solid #b54a2c30', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--rust)', lineHeight: 1.6 }}>
              ⚠️ Always leave 2" headspace in bottles. Open one test bottle after 48h to check carbonation level.
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Calculator size={32} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
            <p style={{ fontSize: '0.875rem' }}>Fill in the form to calculate</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ResultCard({ label, value, color, sublabel }: { label: string; value: string; color: string; sublabel?: string }) {
  return (
    <div style={{ padding: '1rem', background: `${color}10`, borderRadius: '8px', border: `1px solid ${color}30` }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', color, fontWeight: 600 }}>{value}</div>
      {sublabel && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sublabel}</div>}
    </div>
  )
}

const lStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }
const iStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 0.875rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--warm-white)', fontSize: '0.875rem', color: 'var(--text-primary)' }
