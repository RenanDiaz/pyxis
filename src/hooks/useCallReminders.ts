import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useClients } from '@/hooks/useClients'
import { getReminderCalls } from '@/lib/firestore'
import { dueReminders, reminderWindow, type DueReminder } from '@/lib/callReminders'
import { getCallDisplayName, isLeadCall } from '@/lib/leads'
import { getPrimaryPhoneNumber } from '@/lib/clientUtils'
import {
  claimReminder,
  readReminderPrefs,
  subscribeReminderPrefs,
  wasReminderFired,
  writeReminderPrefs,
  type ReminderPrefs,
} from '@/lib/reminderPrefs'
import type { Client } from '@/types'

const CHECK_EVERY_MS = 15_000

/** Preferencias de avisos del usuario actual (spec 21). */
export function useReminderPrefs(): [ReminderPrefs, (prefs: ReminderPrefs) => void] {
  const { wsCtx } = useUserProfile()
  const uid = wsCtx?.uid ?? ''
  // useSyncExternalStore necesita una referencia estable mientras no cambie.
  const cache = useRef<{ raw: string; prefs: ReminderPrefs } | null>(null)
  const prefs = useSyncExternalStore(subscribeReminderPrefs, () => {
    const next = readReminderPrefs(uid)
    const raw = JSON.stringify(next)
    if (cache.current?.raw !== raw) cache.current = { raw, prefs: next }
    return cache.current.prefs
  })
  return [prefs, (next) => writeReminderPrefs(uid, next)]
}

/** Dos tonos cortos con WebAudio (sin archivo de sonido). */
function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const start = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2)
      osc.start(start)
      osc.stop(start + 0.21)
    })
    setTimeout(() => ctx.close(), 800)
  } catch {
    // El navegador puede bloquear el audio sin interacción previa: el aviso sigue sin sonido.
  }
}

/**
 * Avisa de las llamadas propias 5 minutos antes y a la hora (spec 21), con
 * Pyxis abierto aunque la pestaña esté en segundo plano. Se monta una vez en
 * el layout.
 */
export function useCallReminders() {
  const { wsCtx } = useUserProfile()
  const navigate = useNavigate()
  const [prefs] = useReminderPrefs()

  const { data: calls } = useQuery({
    queryKey: ['calls', 'reminders', wsCtx?.workspaceId, wsCtx?.uid],
    queryFn: () => {
      const { from, to } = reminderWindow(Date.now())
      return getReminderCalls(wsCtx!, from, to)
    },
    enabled: !!wsCtx && prefs.enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: 'always',
  })

  const { data: activeClients } = useClients()
  const { data: archivedClients } = useClients({ archived: true })
  const clientsById = useMemo(() => {
    const map = new Map<string, Client>()
    for (const c of [...(activeClients ?? []), ...(archivedClients ?? [])]) map.set(c.id, c)
    return map
  }, [activeClients, archivedClients])

  // El intervalo lee siempre lo último sin reiniciarse en cada render.
  const latest = useRef({ calls, clientsById, prefs, navigate })
  useEffect(() => {
    latest.current = { calls, clientsById, prefs, navigate }
  })

  const uid = wsCtx?.uid
  useEffect(() => {
    if (!uid || !prefs.enabled) return

    const fire = (reminder: DueReminder) => {
      const { clientsById: byId, prefs: p, navigate: go } = latest.current
      const { call, kind } = reminder
      const name = getCallDisplayName(call, byId)
      const lead = isLeadCall(call) ? call.lead : null
      const client = call.client_id ? byId.get(call.client_id) : undefined
      const phone = lead?.phone ?? (client ? getPrimaryPhoneNumber(client) : '')
      const time = format(call.scheduled_at.toDate(), 'h:mm a')
      const title = kind === 'before' ? `En 5 minutos: llamada con ${name}` : `Es la hora: llamada con ${name}`
      const open = () => go(call.client_id ? `/clientes/${call.client_id}` : '/agenda')

      toast(title, {
        description: `${time}${lead ? ' · lead' : ''}${call.notes ? ` · ${call.notes}` : ''}`,
        // "Es la hora" queda hasta cerrarlo; "en 5 minutos" se va solo al minuto.
        duration: kind === 'now' ? Infinity : 60_000,
        // Abajo: arriba taparía la campana y el menú del usuario.
        position: 'bottom-right',
        closeButton: true,
        action: phone
          ? { label: 'Llamar', onClick: () => { window.location.href = `tel:${phone}` } }
          : { label: 'Ver', onClick: open },
        cancel: phone ? { label: 'Ver', onClick: open } : undefined,
      })

      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(title, { body: time, tag: reminder.key })
          n.onclick = () => {
            window.focus()
            open()
            n.close()
          }
        } catch {
          // Algunos navegadores solo permiten notificaciones desde un service worker.
        }
      }
      if (p.sound) playChime()
    }

    const check = () => {
      const current = latest.current.calls ?? []
      for (const reminder of dueReminders(current, uid, Date.now(), wasReminderFired)) {
        if (claimReminder(reminder.key)) fire(reminder)
      }
    }
    // También al llegar datos nuevos, para no esperar al próximo tic.
    check()
    const id = setInterval(check, CHECK_EVERY_MS)
    return () => clearInterval(id)
  }, [uid, prefs.enabled, calls])
}
