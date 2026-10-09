import { Timestamp } from 'firebase/firestore'

// Borradores de formularios en localStorage. Cada borrador vive bajo una key
// por usuario (`pyxis:draft:{uid}:{formId}`) para que dos personas que comparten
// navegador no vean los datos de la otra; además se borran al cerrar sesión.

const PREFIX = 'pyxis:draft:'
const VERSION = 1
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface StoredDraft<T> {
  v: number
  savedAt: number
  /**
   * Marca de la versión del dato original sobre el que se editó (p. ej.
   * `updated_at` del cliente). Si al restaurar no coincide, alguien modificó
   * el registro después y restaurar podría pisar esos cambios.
   */
  base?: string | number | null
  data: T
}

export function draftKey(uid: string, formId: string): string {
  return `${PREFIX}${uid}:${formId}`
}

// Timestamp/Date no sobreviven JSON.stringify: se guardan como millis marcados.
function replacer(this: Record<string, unknown>, key: string, value: unknown) {
  const raw = this[key]
  if (raw instanceof Timestamp) return { __ts: raw.toMillis() }
  if (raw instanceof Date) return { __date: raw.getTime() }
  return value
}

function reviver(_key: string, value: unknown) {
  if (value && typeof value === 'object') {
    if ('__ts' in value && typeof value.__ts === 'number') return Timestamp.fromMillis(value.__ts)
    if ('__date' in value && typeof value.__date === 'number') return new Date(value.__date)
  }
  return value
}

/** Serialización estable usada también para comparar si el formulario cambió. */
export function serializeDraftData(data: unknown): string {
  return JSON.stringify(data, replacer)
}

export function readDraft<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw, reviver) as StoredDraft<T>
    if (parsed?.v !== VERSION || typeof parsed.savedAt !== 'number') {
      localStorage.removeItem(key)
      return null
    }
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeDraft<T>(key: string, data: T, base?: StoredDraft<T>['base']): number | null {
  const savedAt = Date.now()
  const draft: StoredDraft<T> = { v: VERSION, savedAt, base: base ?? null, data }
  try {
    localStorage.setItem(key, JSON.stringify(draft, replacer))
    return savedAt
  } catch {
    // Cuota llena, modo privado o storage bloqueado: el borrador es best-effort.
    return null
  }
}

export function removeDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignorar si localStorage no está disponible.
  }
}

function draftKeys(filter: (key: string) => boolean): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX) && filter(key)) keys.push(key)
    }
  } catch {
    // Ignorar si localStorage no está disponible.
  }
  return keys
}

/** Borra todos los borradores de un usuario (al cerrar sesión). */
export function clearUserDrafts(uid: string): void {
  draftKeys((key) => key.startsWith(`${PREFIX}${uid}:`)).forEach(removeDraft)
}

/** Elimina borradores vencidos o con formato viejo. */
export function pruneExpiredDrafts(): void {
  draftKeys(() => true).forEach((key) => readDraft(key))
}
