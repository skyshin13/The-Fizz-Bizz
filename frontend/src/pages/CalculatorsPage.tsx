import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'
import { useSugarTypes } from '../hooks/useLookups'
import toast from 'react-hot-toast'
import { Calculator, FlaskConical, Zap, Wind, AlertTriangle, Search, Info } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'

type Tab = 'abv' | 'priming' | 'cer'

export default function CalculatorsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('abv')

  return (
    <div style={{ padding: '2.5rem', maxWidth: '900px', margin: '0 auto' }}>
      <div className="fade-in" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Fermentation Calculators</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Mathematical tools for precise fermentation management.</p>
      </div>

      <div className="fade-in-delay-1" style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {[
          { id: 'abv' as const,    label: 'ABV Calculator',    icon: FlaskConical },
          { id: 'priming' as const, label: 'Priming Sugar',    icon: Calculator },
          { id: 'cer' as const,    label: 'CO2 Production',    icon: Wind },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.625rem 1.25rem', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 500, background: activeTab === id ? 'var(--brown-dark)' : 'var(--card-bg)', color: activeTab === id ? 'var(--amber-glow)' : 'var(--text-secondary)', border: '1px solid var(--border)', transition: 'all 0.2s' }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="fade-in-delay-2">
        {activeTab === 'abv'    && <ABVCalculator />}
        {activeTab === 'priming' && <PrimingSugarCalculator />}
        {activeTab === 'cer'    && <CERCalculator />}
      </div>
    </div>
  )
}

// ─── ABV Calculator ──────────────────────────────────────────────────────────

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

// ─── Priming Sugar Calculator ────────────────────────────────────────────────

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

// ─── CER Calculator ──────────────────────────────────────────────────────────

interface CERStrain {
  id: string
  name: string
  strain_type: string
  brand: string
  opt_temp_c: number
  temp_min_c: number
  temp_max_c: number
  ethanol_tol: number
  description: string
}

interface CERPoint {
  t: number
  cer: number
  phase: string
}

interface CERResult {
  points: CERPoint[]
  peak_cer: number
  peak_t: number
  alert_triggered: boolean
  alert_t: number | null
  strain_id: string
  strain_name: string
  total_co2_mg_per_L: number
}

const PHASE_COLORS: Record<string, string> = {
  lag: '#94a3b8',
  exponential: '#f59e0b',
  stationary: '#10b981',
  decline: '#ef4444',
}

const TYPE_LABELS: Record<string, string> = {
  ale: 'Ale', lager: 'Lager', wheat: 'Wheat', wine: 'Wine',
  champagne: 'Champagne', saison: 'Saison', wild: 'Wild / Belgian',
}

function CERCalculator() {
  const [strains, setStrains] = useState<CERStrain[]>([])
  const [strainSearch, setStrainSearch] = useState('')
  const [selectedStrain, setSelectedStrain] = useState<CERStrain | null>(null)
  const [showStrainList, setShowStrainList] = useState(false)

  const [sugar, setSugar] = useState('200')
  const [volume, setVolume] = useState('5000')
  const [temp, setTemp] = useState('20')
  const [duration, setDuration] = useState('120')
  const [threshold, setThreshold] = useState('150')

  const [result, setResult] = useState<CERResult | null>(null)
  const [displayedPoints, setDisplayedPoints] = useState<CERPoint[]>([])
  const [animating, setAnimating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api.get('/calculations/cer-strains').then(r => {
      setStrains(r.data)
      const def = r.data.find((s: CERStrain) => s.id === 'US-05')
      if (def) setSelectedStrain(def)
    }).catch(() => {})
  }, [])

  const filteredStrains = strains.filter(s =>
    s.name.toLowerCase().includes(strainSearch.toLowerCase()) ||
    s.strain_type.toLowerCase().includes(strainSearch.toLowerCase()) ||
    s.brand.toLowerCase().includes(strainSearch.toLowerCase())
  )

  const grouped: Record<string, CERStrain[]> = {}
  for (const s of filteredStrains) {
    if (!grouped[s.strain_type]) grouped[s.strain_type] = []
    grouped[s.strain_type].push(s)
  }

  const simulate = async () => {
    if (!selectedStrain) { toast.error('Select a yeast strain first'); return }
    if (animRef.current) clearInterval(animRef.current)
    setDisplayedPoints([])
    setResult(null)
    setLoading(true)
    try {
      const res = await api.post('/calculations/cer', {
        strain_id: selectedStrain.id,
        sugar_g: parseFloat(sugar),
        volume_ml: parseFloat(volume),
        temperature_c: parseFloat(temp),
        duration_hours: parseFloat(duration),
        alert_threshold: parseFloat(threshold),
      })
      const data: CERResult = res.data
      setResult(data)
      setAnimating(true)
      let idx = 0
      animRef.current = setInterval(() => {
        idx += 2
        if (idx >= data.points.length) {
          idx = data.points.length
          clearInterval(animRef.current!)
          setAnimating(false)
        }
        setDisplayedPoints(data.points.slice(0, idx))
      }, 40)
    } catch {
      toast.error('Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  const alertThresholdNum = parseFloat(threshold) || 150

  // Build chart data with alert zone
  const chartData = displayedPoints.map(p => ({ t: p.t, cer: p.cer, phase: p.phase }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Inputs row */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>

        {/* Left: strain picker + params */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>CO₂ Evolution Rate</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Simulates CER(t) = μ(t) × X(t) × 0.49 × 1000 mg/L/h over your fermentation window.
            </p>
          </div>

          {/* Strain selector */}
          <div style={{ position: 'relative' }}>
            <label style={lStyle}>Yeast Strain</label>
            <div
              onClick={() => setShowStrainList(v => !v)}
              style={{ ...iStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
            >
              <span style={{ fontSize: '0.8rem', color: selectedStrain ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {selectedStrain ? selectedStrain.name : 'Select strain…'}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>▼</span>
            </div>
            {showStrainList && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', marginTop: 4, maxHeight: 280, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--card-bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.6rem', background: 'var(--parchment)', borderRadius: 6 }}>
                    <Search size={12} color="var(--text-muted)" />
                    <input
                      autoFocus
                      value={strainSearch}
                      onChange={e => setStrainSearch(e.target.value)}
                      placeholder="Search strains…"
                      style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', outline: 'none', width: '100%', color: 'var(--text-primary)' }}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                </div>
                {Object.entries(grouped).map(([type, list]) => (
                  <div key={type}>
                    <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--parchment)' }}>
                      {TYPE_LABELS[type] ?? type}
                    </div>
                    {list.map(s => (
                      <div
                        key={s.id}
                        onClick={() => { setSelectedStrain(s); setShowStrainList(false); setStrainSearch('') }}
                        style={{ padding: '0.55rem 0.9rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)', background: selectedStrain?.id === s.id ? 'var(--brown-dark)' : 'transparent', transition: 'background 0.15s' }}
                        onMouseEnter={e => { if (selectedStrain?.id !== s.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--parchment)' }}
                        onMouseLeave={e => { if (selectedStrain?.id !== s.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        <div style={{ fontWeight: 500 }}>{s.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.brand}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedStrain && (
            <div style={{ padding: '0.6rem 0.75rem', background: 'var(--parchment)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {selectedStrain.description}<br />
              <span style={{ color: 'var(--text-muted)' }}>
                Temp: {selectedStrain.temp_min_c}–{selectedStrain.temp_max_c}°C · EtOH tol: {selectedStrain.ethanol_tol}%
              </span>
            </div>
          )}

          <div>
            <label style={lStyle}>Sugar (g)</label>
            <input type="number" step="10" value={sugar} onChange={e => setSugar(e.target.value)} style={iStyle} />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>Total fermentable sugar added</p>
          </div>
          <div>
            <label style={lStyle}>Volume (mL)</label>
            <input type="number" step="100" value={volume} onChange={e => setVolume(e.target.value)} style={iStyle} />
          </div>
          <div>
            <label style={lStyle}>Temperature (°C)</label>
            <input type="number" step="0.5" value={temp} onChange={e => setTemp(e.target.value)} style={iStyle} />
          </div>
          <div>
            <label style={lStyle}>Simulate (hours)</label>
            <input type="number" step="12" value={duration} onChange={e => setDuration(e.target.value)} style={iStyle} />
          </div>
          <div>
            <label style={lStyle}>Alert Threshold (mg/L/h)</label>
            <input type="number" step="10" value={threshold} onChange={e => setThreshold(e.target.value)} style={iStyle} />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>Release pressure when CER exceeds this</p>
          </div>

          <button
            onClick={simulate}
            disabled={loading || animating}
            style={{ width: '100%', padding: '0.75rem', background: 'var(--amber)', color: 'var(--brown-dark)', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', marginTop: 4 }}
          >
            {loading ? 'Running…' : animating ? 'Simulating…' : <><Wind size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Run Simulation</>}
          </button>
        </div>

        {/* Right: chart + stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Alert banner */}
          {result?.alert_triggered && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1.25rem', background: '#b54a2c18', border: '1px solid #b54a2c50', borderRadius: '10px', color: 'var(--rust)' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Pressure Alert</strong>
                <p style={{ fontSize: '0.8rem', margin: 0, opacity: 0.85 }}>
                  CER exceeded {threshold} mg/L/h at <strong>{result.alert_t}h</strong>. Release pressure from your jar.
                </p>
              </div>
            </div>
          )}

          {/* Chart */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-light)', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CO₂ Evolution Rate</span>
              <button
                onClick={() => setShowInfo(v => !v)}
                title="How is this calculated?"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.3rem 0.625rem', borderRadius: 20, border: `1px solid ${showInfo ? 'var(--amber)' : 'var(--border)'}`, background: showInfo ? '#f59e0b18' : 'transparent', color: showInfo ? 'var(--amber)' : 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                <Info size={12} /> How is this calculated?
              </button>
            </div>

            {showInfo && (
              <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--parchment)', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>How CO₂ Evolution Rate is calculated</strong>
                <p style={{ margin: '0.5rem 0 0.25rem' }}>
                  The graph models the <strong>CO₂ Evolution Rate (CER)</strong> using this formula:
                </p>
                <div style={{ fontFamily: 'monospace', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.75rem', margin: '0.5rem 0', fontSize: '0.8rem', color: 'var(--amber)' }}>
                  CER(t) = μ(t) × X(t) × 0.49 × 1000 &nbsp;[mg CO₂/L/h]
                </div>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li><strong>μ(t)</strong> — specific growth rate of yeast at time t, adjusted for your temperature (bell-curve response vs. strain min/opt/max), sugar availability (Monod kinetics), and ethanol inhibition</li>
                  <li><strong>X(t)</strong> — estimated yeast biomass (g/L) at time t</li>
                  <li><strong>0.49</strong> — CO₂ yield coefficient: ~0.49 g of CO₂ is produced per gram of new biomass</li>
                  <li><strong>× 1000</strong> — converts g/L/h → mg/L/h</li>
                </ul>
                <p style={{ margin: '0.75rem 0 0.25rem' }}><strong>Growth phases</strong></p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <li><span style={{ color: '#94a3b8' }}>●</span> <strong>Lag</strong> — yeast adapts to the environment; little to no CO₂ produced</li>
                  <li><span style={{ color: '#f59e0b' }}>●</span> <strong>Exponential</strong> — rapid growth; CO₂ spikes quickly toward peak</li>
                  <li><span style={{ color: '#10b981' }}>●</span> <strong>Stationary</strong> — sugars depleted; CO₂ levels off at max</li>
                  <li><span style={{ color: '#ef4444' }}>●</span> <strong>Decline</strong> — yeast dies off; CO₂ drops toward zero</li>
                </ul>
                <p style={{ margin: '0.75rem 0 0', color: 'var(--text-muted)' }}>
                  Strain-specific parameters (growth rates, temperature tolerances, ethanol limits) are sourced from published yeast kinetic data and updated per selected strain.
                </p>
              </div>
            )}

            {chartData.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--text-muted)', gap: '0.75rem' }}>
                <Wind size={36} style={{ opacity: 0.2 }} />
                <p style={{ fontSize: '0.875rem' }}>Configure inputs and run simulation</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="t"
                    label={{ value: 'Time (h)', position: 'insideBottom', offset: -2, style: { fontSize: '0.72rem', fill: 'var(--text-muted)' } }}
                    tick={{ fontSize: '0.7rem', fill: 'var(--text-muted)' }}
                    tickCount={8}
                  />
                  <YAxis
                    label={{ value: 'CER (mg/L/h)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: '0.72rem', fill: 'var(--text-muted)' } }}
                    tick={{ fontSize: '0.7rem', fill: 'var(--text-muted)' }}
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.78rem' }}
                    formatter={(val: number) => [`${val.toFixed(2)} mg/L/h`, 'CER']}
                    labelFormatter={(t: number) => `Hour ${t}`}
                  />
                  <ReferenceLine
                    y={alertThresholdNum}
                    stroke="var(--rust)"
                    strokeDasharray="6 3"
                    label={{ value: `Alert ${alertThresholdNum}`, position: 'insideTopRight', style: { fontSize: '0.68rem', fill: 'var(--rust)' } }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cer"
                    stroke="var(--amber)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Stats row */}
          {result && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <StatCard label="Peak CER" value={`${result.peak_cer.toFixed(1)}`} unit="mg/L/h" color="var(--amber)" />
              <StatCard label="Peak at" value={`${result.peak_t}h`} unit="into fermentation" color="var(--slate)" />
              <StatCard label="Total CO₂" value={`${result.total_co2_mg_per_L.toFixed(0)}`} unit="mg/L cumulative" color="var(--rust)" />
            </div>
          )}

          {/* Phase legend */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {Object.entries(PHASE_COLORS).map(([phase, color]) => (
              <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                {phase.charAt(0).toUpperCase() + phase.slice(1)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Shared components ───────────────────────────────────────────────────────

function ResultCard({ label, value, color, sublabel }: { label: string; value: string; color: string; sublabel?: string }) {
  return (
    <div style={{ padding: '1rem', background: `${color}10`, borderRadius: '8px', border: `1px solid ${color}30` }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', color, fontWeight: 600 }}>{value}</div>
      {sublabel && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sublabel}</div>}
    </div>
  )
}

function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{ padding: '0.875rem 1rem', background: 'var(--card-bg)', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem', color, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{unit}</div>
    </div>
  )
}

const lStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }
const iStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 0.875rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--warm-white)', fontSize: '0.875rem', color: 'var(--text-primary)', boxSizing: 'border-box' }
