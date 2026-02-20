import { useCallback, useEffect, useMemo, useState } from 'react'

const BELL_HIDDEN_KEY = 'ok_notif_bell_hidden'
const PREFS_KEY = 'ok_notif_prefs'

const DEFAULT_PREFS = {
  mentions: true,
  annonces: true,
  evenements: true,
  systeme: true,
  partenaires: true,
  faits_divers: true,
  groupes: true,
  rencontre: true,
  marketplace: true,
}

export function useNotifPrefs() {
  const [bellHidden, setBellHiddenState] = useState(false)
  const [prefs, setPrefsState] = useState(DEFAULT_PREFS)

  useEffect(() => {
    try {
      const h = localStorage.getItem(BELL_HIDDEN_KEY)
      setBellHiddenState(h === '1')
    } catch {}
    try {
      const raw = localStorage.getItem(PREFS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setPrefsState({ ...DEFAULT_PREFS, ...parsed })
        try {
          if (typeof caches !== 'undefined') {
            caches.open('ok-prefs').then((c) => c.put('/ok-prefs', new Response(JSON.stringify({ ...DEFAULT_PREFS, ...parsed }), { headers: { 'Content-Type': 'application/json' } }))).catch(() => {})
          }
        } catch {}
      }
    } catch {}
    // Sync cross-components: écoute les changements locaux et inter-onglets
    const onStorage = (e) => {
      try {
        if (e && e.key === BELL_HIDDEN_KEY) {
          setBellHiddenState(e.newValue === '1')
        }
        if (e && e.key === PREFS_KEY && e.newValue) {
          const parsed = JSON.parse(e.newValue)
          setPrefsState({ ...DEFAULT_PREFS, ...parsed })
        }
      } catch {}
    }
    const onLocalBell = () => {
      try {
        const h = localStorage.getItem(BELL_HIDDEN_KEY)
        setBellHiddenState(h === '1')
      } catch {}
    }
    const onLocalPrefs = () => {
      try {
        const raw = localStorage.getItem(PREFS_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          setPrefsState({ ...DEFAULT_PREFS, ...parsed })
        }
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage)
      window.addEventListener('ok_notif_bell_hidden_changed', onLocalBell)
      window.addEventListener('ok_notif_prefs_changed', onLocalPrefs)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('ok_notif_bell_hidden_changed', onLocalBell)
        window.removeEventListener('ok_notif_prefs_changed', onLocalPrefs)
      }
    }
  }, [])

  const setBellHidden = useCallback((hidden) => {
    setBellHiddenState(!!hidden)
    try {
      localStorage.setItem(BELL_HIDDEN_KEY, hidden ? '1' : '0')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ok_notif_bell_hidden_changed'))
      }
    } catch {}
  }, [])

  const setPrefs = useCallback((next) => {
    setPrefsState((prev) => {
      const merged = typeof next === 'function' ? next(prev) : next
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(merged)) } catch {}
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ok_notif_prefs_changed'))
        }
      } catch {}
      try {
        if (typeof caches !== 'undefined') {
          caches.open('ok-prefs').then((c) => c.put('/ok-prefs', new Response(JSON.stringify(merged), { headers: { 'Content-Type': 'application/json' } }))).catch(() => {})
        }
      } catch {}
      return merged
    })
  }, [])

  const reset = useCallback(() => {
    setBellHiddenState(false)
    setPrefsState(DEFAULT_PREFS)
    try {
      localStorage.removeItem(BELL_HIDDEN_KEY)
      localStorage.removeItem(PREFS_KEY)
    } catch {}
    try {
      if (typeof caches !== 'undefined') {
        caches.open('ok-prefs').then((c) => c.put('/ok-prefs', new Response(JSON.stringify(DEFAULT_PREFS), { headers: { 'Content-Type': 'application/json' } }))).catch(() => {})
      }
    } catch {}
  }, [])

  return useMemo(() => ({
    bellHidden,
    setBellHidden,
    prefs,
    setPrefs,
    reset,
  }), [bellHidden, setBellHidden, prefs, setPrefs, reset])
}
