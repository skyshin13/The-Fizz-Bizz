import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { Recipe } from '../types'
import { useFermentationTypes } from '../hooks/useLookups'
import { Clock, ChefHat, Users, BookOpen, Search, AlertCircle } from 'lucide-react'
import styles from './RecipesPage.module.css'

const DIFF_COLOR: Record<string, string> = {
  beginner: 'var(--moss)', intermediate: 'var(--amber)', advanced: 'var(--rust)',
}

const DIFFICULTIES = ['All', 'beginner', 'intermediate', 'advanced']

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('All')
  const { getEmoji } = useFermentationTypes()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    api.get('/recipes/')
      .then(r => {
        setRecipes(r.data)
        const targetId = searchParams.get('recipe')
        if (targetId) {
          const match = r.data.find((rec: Recipe) => rec.id === parseInt(targetId))
          if (match) setSelected(match)
        }
      })
      .catch(() => setError('Could not load the recipe library. The server may be offline.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = recipes.filter(r => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      r.name.toLowerCase().includes(q) ||
      (r.description?.toLowerCase().includes(q) ?? false)
    const matchesDiff = difficulty === 'All' || r.difficulty === difficulty
    return matchesSearch && matchesDiff
  })

  return (
    <div className={styles.page}>

      {/* Page header */}
      <div className="fade-in" style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Recipe Library</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Starter recipes to kickstart your fermentation journey.
        </p>
      </div>

      {/* Search + difficulty filters */}
      <div className="fade-in" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ position: 'relative', maxWidth: '420px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recipes…"
            style={{
              width: '100%', boxSizing: 'border-box',
              paddingLeft: '2.25rem', paddingRight: '1rem', paddingTop: '0.6rem', paddingBottom: '0.6rem',
              borderRadius: '8px', border: '1px solid var(--border-light)',
              background: 'var(--card-bg)', fontSize: '0.875rem', outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {DIFFICULTIES.map(d => {
            const active = difficulty === d
            const color = d === 'All' ? 'var(--amber)' : DIFF_COLOR[d] || 'var(--amber)'
            return (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                style={{
                  padding: '0.3rem 0.875rem', borderRadius: '20px', fontSize: '0.78rem',
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: active ? color : 'var(--card-bg)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${active ? 'transparent' : 'var(--border-light)'}`,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📖</div>
          <p style={{ fontSize: '0.875rem' }}>Loading recipes…</p>
        </div>
      ) : error ? (
        <div className="fade-in-delay-1">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.875rem 1.125rem', background: '#c8832a10', border: '1px solid #c8832a30', borderRadius: '10px', marginBottom: '1.25rem' }}>
            <AlertCircle size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{error}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {[...Array(6)].map((_, i) => <RecipeSkeletonCard key={i} />)}
          </div>
        </div>
      ) : selected ? (
        /* Split view: list + detail panel */
        <div className={`fade-in-delay-1 ${styles.layout}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                isSelected={selected?.id === recipe.id}
                onSelect={() => setSelected(selected?.id === recipe.id ? null : recipe)}
                getEmoji={getEmoji}
              />
            ))}
          </div>
          <RecipeDetail recipe={selected} getEmoji={getEmoji} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="fade-in-delay-1" style={{ textAlign: 'center', padding: '3rem 2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px dashed var(--border-light)', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📖</div>
          <p style={{ fontSize: '0.875rem' }}>
            {search || difficulty !== 'All' ? 'No recipes match your search.' : 'No recipes in the library yet.'}
          </p>
          <p style={{ fontSize: '0.78rem', marginTop: '0.375rem', opacity: 0.7 }}>
            Recipes added to the library will appear here.
          </p>
        </div>
      ) : (
        /* Grid view */
        <div className="fade-in-delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {filtered.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isSelected={false}
              onSelect={() => setSelected(recipe)}
              getEmoji={getEmoji}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Shared recipe card ── */
function RecipeCard({ recipe, isSelected, onSelect, getEmoji }: {
  recipe: Recipe
  isSelected: boolean
  onSelect: () => void
  getEmoji: (type: string) => string
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem',
        border: `1px solid ${isSelected ? 'var(--amber)' : 'var(--border-light)'}`,
        cursor: 'pointer', transition: 'all 0.2s',
        boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '2.25rem', flexShrink: 0 }}>{getEmoji(recipe.fermentation_type)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '0.95rem' }}>{recipe.name}</h3>
            {recipe.difficulty && (
              <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '20px', background: `${DIFF_COLOR[recipe.difficulty]}18`, color: DIFF_COLOR[recipe.difficulty] }}>
                {recipe.difficulty}
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>{recipe.description}</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {recipe.estimated_duration_days && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> {recipe.estimated_duration_days} days
              </span>
            )}
            {recipe.batch_size_liters && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={11} /> {recipe.batch_size_liters}L
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChefHat size={11} /> {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Detail panel ── */
function RecipeDetail({ recipe, getEmoji }: { recipe: Recipe; getEmoji: (type: string) => string }) {
  const navigate = useNavigate()
  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--amber)', position: 'sticky', top: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '2.5rem' }}>{getEmoji(recipe.fermentation_type)}</span>
        <div>
          <h2 style={{ fontSize: '1.1rem' }}>{recipe.name}</h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            {recipe.estimated_duration_days && <span>{recipe.estimated_duration_days} days</span>}
            {recipe.batch_size_liters && <span>{recipe.batch_size_liters}L batch</span>}
            {recipe.difficulty && <span style={{ color: DIFF_COLOR[recipe.difficulty], fontWeight: 500 }}>{recipe.difficulty}</span>}
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChefHat size={14} /> Ingredients
        </h3>
        {recipe.ingredients.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No ingredients listed.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[...recipe.ingredients].sort((a, b) => a.order_index - b.order_index).map(ing => (
              <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-light)', fontSize: '0.85rem', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ color: ing.is_optional ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {ing.name}
                    {ing.is_optional && <span style={{ fontSize: '0.7rem', marginLeft: 4, color: 'var(--text-muted)' }}>(optional)</span>}
                  </span>
                  {ing.yeast_profile_id && (
                    <button
                      onClick={() => navigate(`/yeasts?yeast=${ing.yeast_profile_id}`)}
                      style={{ fontSize: '0.65rem', padding: '0.1rem 0.45rem', borderRadius: '20px', background: 'var(--amber)18', color: 'var(--amber)', border: '1px solid var(--amber)40', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      View in library →
                    </button>
                  )}
                </div>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {ing.quantity} {ing.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      {recipe.instructions ? (
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={14} /> Instructions
          </h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {recipe.instructions}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={14} /> Instructions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: '10px', width: `${70 + (i % 3) * 10}%`, background: 'var(--parchment)', borderRadius: '4px', opacity: 0.35 }} />
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {recipe.tips && (
        <div style={{ padding: '0.875rem', background: '#c8832a12', borderRadius: '8px', border: '1px solid #c8832a30' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--amber)', marginBottom: '0.375rem' }}>💡 Pro Tips</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{recipe.tips}</p>
        </div>
      )}
    </div>
  )
}

/* ── Skeleton placeholder card ── */
function RecipeSkeletonCard() {
  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem', border: '1px dashed var(--border-light)' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div style={{ width: '36px', height: '36px', background: 'var(--parchment)', borderRadius: '6px', flexShrink: 0, opacity: 0.4 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: '13px', width: '48%', background: 'var(--parchment)', borderRadius: '4px', marginBottom: '0.5rem' }} />
          <div style={{ height: '10px', width: '85%', background: 'var(--parchment)', borderRadius: '4px', marginBottom: '0.35rem', opacity: 0.5 }} />
          <div style={{ height: '10px', width: '65%', background: 'var(--parchment)', borderRadius: '4px', marginBottom: '0.75rem', opacity: 0.4 }} />
          <div style={{ display: 'flex', gap: '1rem' }}>
            {[50, 42, 55].map((w, i) => (
              <div key={i} style={{ height: '10px', width: `${w}px`, background: 'var(--parchment)', borderRadius: '4px', opacity: 0.35 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
