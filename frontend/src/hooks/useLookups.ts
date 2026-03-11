import { useEffect, useState } from 'react'
import api from '../lib/api'
import { FermentationTypeConfig, SugarType } from '../types'

export function useFermentationTypes() {
  const [types, setTypes] = useState<FermentationTypeConfig[]>([])

  useEffect(() => {
    api.get('/lookup/fermentation-types').then(r => setTypes(r.data))
  }, [])

  const getEmoji = (value: string) =>
    types.find(t => t.value === value)?.emoji ?? '🧪'

  return { types, getEmoji }
}

export function useSugarTypes() {
  const [sugarTypes, setSugarTypes] = useState<SugarType[]>([])

  useEffect(() => {
    api.get('/lookup/sugar-types').then(r => setSugarTypes(r.data))
  }, [])

  return { sugarTypes }
}
