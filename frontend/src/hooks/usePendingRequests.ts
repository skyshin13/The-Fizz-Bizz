import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from './useAuth'

export function usePendingRequests() {
  const { user: me } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!me) return
    api.get('/friends/').then(r => {
      const pending = r.data.filter(
        (f: any) => f.status === 'pending' && f.receiver_id === me.id
      )
      setCount(pending.length)
    }).catch(() => {})
  }, [me])

  return count
}
