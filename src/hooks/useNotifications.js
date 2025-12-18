import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

export function useNotifications(userId) {
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState(null)
  const [open, setOpen] = useState(false)
  const swListenerAttached = useRef(false)
  const initialFetchAttempted = useRef(false)
  const blockedUntilRef = useRef(0)

  const canUseApi = !!API_BASE_URL && !!userId

  const fetchPage = useCallback(async (isFirst = false) => {
    if (!canUseApi) return { ok: false }
    if (Date.now() < blockedUntilRef.current) return { ok: false }
    setLoading(true)
    try {
      const params = new URLSearchParams({ userId, limit: '20' })
      if (!isFirst && cursor) params.set('cursor', cursor)
      const res = await fetch(`${API_BASE_URL}/notifications?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erreur API notifications')

      const next = (json?.items || []).filter((n) => !n.is_read)
      setItems((prev) => (isFirst ? next : [...prev, ...next]))
      setUnreadCount(Number(json?.unreadCount || 0))
      setHasMore(Boolean(json?.hasMore))
      setCursor(json?.nextCursor || null)
      return { ok: true }
    } catch (_e) {
      blockedUntilRef.current = Date.now() + 30_000
      return { ok: false }
    } finally {
      setLoading(false)
    }
  }, [API_BASE_URL, userId, canUseApi, cursor])

  const fetchFirst = useCallback(async () => {
    setCursor(null)
    return fetchPage(true)
  }, [fetchPage])

  const fetchMore = useCallback(async () => {
    if (!hasMore || loading) return { ok: false }
    return fetchPage(false)
  }, [fetchPage, hasMore, loading])

  const markRead = useCallback(async (id) => {
    if (!canUseApi || !id) return { ok: false }
    // Retire immédiatement la notification lue de la liste
    setItems((prev) => prev.filter((n) => n.id !== id))
    setUnreadCount((n) => Math.max(0, n - 1))
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id })
      })
      const ok = res.ok
      if (!ok) throw new Error('mark-read failed')
      return { ok }
    } catch (_e) {
      // En cas d'échec, on recharge la première page pour resynchroniser
      setUnreadCount((n) => n + 1)
      fetchFirst()
      return { ok: false }
    }
  }, [API_BASE_URL, userId, canUseApi, fetchFirst])

  const markAllRead = useCallback(async () => {
    if (!canUseApi) return { ok: false }
    // On vide localement la liste (toutes les notifs sont considérées comme lues)
    setItems([])
    const prevUnread = unreadCount
    setUnreadCount(0)
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      const ok = res.ok
      if (!ok) throw new Error('mark-all-read failed')
      return { ok }
    } catch (_e) {
      if (prevUnread > 0) setUnreadCount(prevUnread)
      return { ok: false }
    }
  }, [API_BASE_URL, userId, canUseApi, unreadCount])

  // Pré-charge les notifications dès que l'API est disponible et qu'un userId est présent
  useEffect(() => {
    if (!canUseApi) return
    if (initialFetchAttempted.current) return
    // On ne refait pas l'appel si on a déjà des items
    if (items.length > 0) {
      initialFetchAttempted.current = true
      return
    }
    initialFetchAttempted.current = true
    fetchFirst()
  }, [canUseApi, fetchFirst, items.length])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (swListenerAttached.current) return

    const handler = (event) => {
      try {
        const data = event?.data
        if (!data || typeof data !== 'object') return
        if (data.type === 'NEW_PUSH') {
          setUnreadCount((n) => n + 1)
          if (open) {
            fetchFirst()
          }
        }
      } catch (_) {}
    }
    window.addEventListener('message', handler)
    swListenerAttached.current = true

    return () => {
      try {
        window.removeEventListener('message', handler)
        swListenerAttached.current = false
      } catch (_) {}
    }
  }, [open, fetchFirst])

  return useMemo(() => ({
    items,
    unreadCount,
    loading,
    hasMore,
    fetchFirst,
    fetchMore,
    markRead,
    markAllRead,
    open,
    setOpen,
  }), [items, unreadCount, loading, hasMore, fetchFirst, fetchMore, markRead, markAllRead, open])
}
