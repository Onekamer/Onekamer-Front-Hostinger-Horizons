import { useCallback, useEffect, useMemo, useState } from 'react'
import subscribeForPush from '@/lib/push/subscribeForPush'

const PROVIDER = import.meta.env.VITE_NOTIFICATIONS_PROVIDER || 'onesignal'
const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

export function useWebPush(userId) {
  const [permission, setPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default')
  const [subscribed, setSubscribed] = useState(false)
  const [endpoint, setEndpoint] = useState(null)
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  const active = PROVIDER === 'supabase_light' && !!API_BASE_URL && supported

  const refresh = useCallback(async () => {
    if (!active) return { active: false }
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setPermission(Notification.permission)
      setSubscribed(!!sub)
      setEndpoint(sub?.endpoint || null)
      return { active: true, permission: Notification.permission, subscribed: !!sub, endpoint: sub?.endpoint || null }
    } catch {
      return { active: false }
    }
  }, [active])

  useEffect(() => { refresh() }, [refresh])

  const subscribe = useCallback(async () => {
    if (!active || !userId) return { ok: false }
    const res = await subscribeForPush(userId)
    await refresh()
    return res
  }, [active, userId, refresh])

  const unsubscribe = useCallback(async () => {
    if (!active) return { ok: false }
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      await refresh()
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }, [active, refresh])

  const disableOnThisDevice = useCallback(async () => {
    if (!active) return { ok: false }
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub) {
        await refresh()
        return { ok: true, note: 'no_local_subscription' }
      }
      try {
        await fetch(`${API_BASE_URL}/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint, userId })
        })
      } catch { /* noop */ }
      await sub.unsubscribe()
      await refresh()
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }, [active, userId, refresh])

  const sendTest = useCallback(async () => {
    if (!active || !userId) return { ok: false }
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Push OneKamer',
          message: 'Notification de test',
          targetUserIds: [userId],
          data: { type: 'test' },
          url: 'https://onekamer.co'
        })
      })
      const json = await res.json().catch(() => null)
      return { ok: res.ok, json }
    } catch {
      return { ok: false }
    }
  }, [active, userId])

  return useMemo(() => ({ active, permission, subscribed, endpoint, refresh, subscribe, unsubscribe, disableOnThisDevice, sendTest }), [active, permission, subscribed, endpoint, refresh, subscribe, unsubscribe, disableOnThisDevice, sendTest])
}
