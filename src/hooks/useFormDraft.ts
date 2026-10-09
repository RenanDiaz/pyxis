import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  draftKey,
  readDraft,
  removeDraft,
  serializeDraftData,
  writeDraft,
  type StoredDraft,
} from '@/lib/formDraft'

interface UseFormDraftOptions<T> {
  /** Identificador del formulario (`client-form:new`, …). `null` lo desactiva. */
  formId: string | null
  /** Valor actual a guardar. Solo debe incluir datos seguros para localStorage. */
  value: T
  /**
   * Valor con el que arrancó el formulario. Mientras sea `null` (cargando o
   * resolviendo un borrador previo) no se guarda nada; si `value` vuelve a ser
   * igual a `initial`, el borrador se elimina.
   */
  initial: T | null
  /** Versión del dato original (p. ej. `updated_at`), para detectar conflictos. */
  base?: StoredDraft<T>['base']
  delay?: number
}

/**
 * Autoguarda un formulario en curso en localStorage (con debounce) y lo vuelca
 * de inmediato al ocultar/cerrar la pestaña o al desmontar el componente.
 * Restaurar es responsabilidad del formulario: usa `read()` al inicializar.
 */
export function useFormDraft<T>({ formId, value, initial, base, delay = 600 }: UseFormDraftOptions<T>) {
  const { user } = useAuth()
  const key = user && formId ? draftKey(user.uid, formId) : null
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const serialized = serializeDraftData(value)
  const initialSerialized = useMemo(
    () => (initial === null ? null : serializeDraftData(initial)),
    [initial],
  )
  const dirty = initialSerialized !== null && serialized !== initialSerialized

  const pending = useRef<(() => void) | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef({ value, base })
  useEffect(() => {
    latest.current = { value, base }
  })

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const write = pending.current
    pending.current = null
    write?.()
  }, [])

  useEffect(() => {
    if (!key || initialSerialized === null) return
    clearTimeout(timer.current)
    if (!dirty) {
      pending.current = null
      removeDraft(key)
      return
    }
    pending.current = () => {
      const at = writeDraft(key, latest.current.value, latest.current.base)
      if (at) setSavedAt(at)
    }
    timer.current = setTimeout(flush, delay)
  }, [key, serialized, initialSerialized, dirty, delay, flush])

  // Cerrar/recargar la pestaña o mandarla a segundo plano (móvil) no debe
  // perder lo escrito durante el debounce.
  useEffect(() => {
    const onHide = () => flush()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [flush])

  const read = useCallback(() => (key ? readDraft<T>(key) : null), [key])

  /** Elimina el borrador (al guardar con éxito, cancelar o descartar). */
  const clear = useCallback(() => {
    clearTimeout(timer.current)
    pending.current = null
    if (key) removeDraft(key)
    setSavedAt(null)
  }, [key])

  return { read, clear, savedAt: dirty ? savedAt : null, dirty }
}
