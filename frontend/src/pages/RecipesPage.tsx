import { useEffect, useState } from 'react'
import api from '../lib/api'
import { Recipe } from '../types'
import { useFermentationTypes } from '../hooks/useLookups'
import { Clock, ChefHat, Users, BookOpen } from 'lucide-react'

const DIFF_COLOR: Record<string, string> = {
  beginner: 'var(--moss)', intermediate: 'var(--amber)', advanced: 'var(--rust)'
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Recipe | null>(null)
  const { getEmoji } = useFermentationTypes()

  useEffect(() => {
    api.get('/recipes').then(r => setRecipes(r.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div className="fade-in" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Recipe Library</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Starter recipes to kickstart your fermentation journey.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Loading recipes...</div>
      ) : (
        <div className="fade-in-delay-1" style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          <div style={{ display: selected ? 'flex' : 'contents', flexDirection: 'column', gap: '0.75rem' }}>
            {recipes.map(recipe => (
              <div key={recipe.id} onClick={() => setSelected(selected?.id === recipe.id ? null : recipe)}
                style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.25rem', border: `1px solid ${selected?.id === recipe.id ? 'var(--amber)' : 'var(--border-light)'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '2.25rem', flexShrink: 0 }}>{getEmoji(recipe.fermentation_type)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '0.95rem' }}>{recipe.name}</h3>
                      {recipe.difficulty && (
                        <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '20px', background: `${DIFF_COLOR[recipe.difficulty]}18`, color: DIFF_COLOR[recipe.difficulty] }}>
                          {recipe.difficulty}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>{recipe.description}</p>
                    <div style={{ display: 'flex', gap: '1rem' }}>
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
                        <ChefHat size={11} /> {recipe.ingredients.length} ingredients
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--amber)', position: 'sticky', top: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '2.5rem' }}>{getEmoji(selected.fermentation_type)}</span>
                <div>
                  <h2 style={{ fontSize: '1.1rem' }}>{selected.name}</h2>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                    {selected.estimated_duration_days && <span>{selected.estimated_duration_days} days</span>}
                    {selected.batch_size_liters && <span>{selected.batch_size_liters}L batch</span>}
                    {selected.difficulty && <span style={{ color: DIFF_COLOR[selected.difficulty], fontWeight: 500 }}>{selected.difficulty}</span>}
                  </div>
                </div>
              </div>

              {/* Ingredients */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ChefHat size={14} /> Ingredients
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {selected.ingredients.sort((a, b) => a.order_index - b.order_index).map(ing => (
                    <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
                      <span style={{ color: ing.is_optional ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        {ing.name}{ing.is_optional && <span style={{ fontSize: '0.7rem', marginLeft: 4, color: 'var(--text-muted)' }}>(optional)</span>}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {ing.quantity} {ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              {selected.instructions && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BookOpen size={14} /> Instructions
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                    {selected.instructions}
                  </div>
                </div>
              )}

              {/* Tips */}
              {selected.tips && (
                <div style={{ padding: '0.875rem', background: '#c8832a12', borderRadius: '8px', border: '1px solid #c8832a30' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--amber)', marginBottom: '0.375rem' }}>💡 Pro Tips</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selected.tips}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
