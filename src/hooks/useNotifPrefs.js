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
      }
    } catch {}
  }, [])

  const setBellHidden = useCallback((hidden) => {
    setBellHiddenState(!!hidden)
    try { localStorage.setItem(BELL_HIDDEN_KEY, hidden ? '1' : '0') } catch {}
  }, [])

  const setPrefs = useCallback((next) => {
    setPrefsState((prev) => {
      const merged = typeof next === 'function' ? next(prev) : next
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(merged)) } catch {}
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
  }, [])

  return useMemo(() => ({
    bellHidden,
    setBellHidden,
    prefs,
    setPrefs,
    reset,
  }), [bellHidden, setBellHidden, prefs, setPrefs, reset])
}
