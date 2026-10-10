// Preferencias de avisos (spec 21) y avisos ya disparados. Viven en
// localStorage: son de este navegador, y si no está disponible (modo privado)
// se usan los valores por defecto.

export interface ReminderPrefs {
  enabled: boolean
  sound: boolean
}

const DEFAULT_PREFS: ReminderPrefs = { enabled: true, sound: true }
const PREFS_EVENT = 'pyxis-reminder-prefs'
const FIRED_KEY = 'pyxis-reminders-fired'
const FIRED_MAX = 200

const prefsKey = (uid: string) => `pyxis-reminder-prefs:${uid}`

export function readReminderPrefs(uid: string): ReminderPrefs {
  try {
    const raw = localStorage.getItem(prefsKey(uid))
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

export function writeReminderPrefs(uid: string, prefs: ReminderPrefs): void {
  try {
    localStorage.setItem(prefsKey(uid), JSON.stringify(prefs))
  } catch {
    // Sin localStorage la preferencia dura lo que la pestaña.
  }
  window.dispatchEvent(new Event(PREFS_EVENT))
}

/** Para `useSyncExternalStore`: cambios en esta pestaña y en otras. */
export function subscribeReminderPrefs(onChange: () => void): () => void {
  window.addEventListener(PREFS_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(PREFS_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readFired(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]')
  } catch {
    return []
  }
}

/** Avisos ya mostrados en esta pestaña si no hay localStorage. */
const firedInMemory = new Set<string>()

export function wasReminderFired(key: string): boolean {
  return firedInMemory.has(key) || readFired().includes(key)
}

/**
 * Reclama un aviso para esta pestaña. Devuelve `false` si otra pestaña ya lo
 * mostró, así un aviso sale una sola vez aunque Pyxis esté abierto dos veces.
 */
export function claimReminder(key: string): boolean {
  if (wasReminderFired(key)) return false
  firedInMemory.add(key)
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...readFired(), key].slice(-FIRED_MAX)))
  } catch {
    // Sin localStorage, el dedupe queda solo en esta pestaña.
  }
  return true
}
