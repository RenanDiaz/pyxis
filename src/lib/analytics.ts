// Analítica de uso (spec 24): único punto de contacto con PostHog.
//
// Privacidad: los clientes de Pyxis son migrantes, así que NUNCA se envía PII
// (nombres, teléfonos, emails, LLC, notas, textos de búsqueda, montos). Solo ids
// opacos, tipos, conteos y abreviaturas de estado, y solo los eventos de
// `AnalyticsEvents`: agregar uno exige actualizar este tipo y el spec.

import type { PostHog } from 'posthog-js'
import { routePattern, sanitizeUrl } from '@/lib/routePattern'
import type { CallOutcome, ClientStatus, ProcessStage, ProcessType, WorkspaceRole } from '@/types'

export interface AnalyticsEvents {
  $pageview: { route_pattern: string }
  client_created: { source: 'form' | 'lead_conversion' }
  client_status_changed: { from: ClientStatus; to: ClientStatus }
  process_added: { type: ProcessType; has_state: boolean }
  process_stage_changed: { type: ProcessType; to: ProcessStage }
  payment_added: { type: ProcessType }
  receipt_generated: { type: ProcessType }
  quote_generated: undefined
  statement_generated: undefined
  docx_exported: { scope: 'one' | 'all' }
  report_exported: undefined
  call_scheduled: { kind: 'client' | 'lead' }
  call_completed: { outcome: CallOutcome }
  state_viewed: { abbreviation: string }
  state_search: { has_results: boolean }
  search_used: { scope: 'clients' | 'trades' | 'glossary' }
  reminder_opt_in: { channel: 'bell' | 'push' }
}

type EventArgs<E extends keyof AnalyticsEvents> = AnalyticsEvents[E] extends undefined
  ? []
  : [props: AnalyticsEvents[E]]

/** Solo estos dominios miden: un mismo build sirve producción y staging (authDomain.ts). */
const ANALYTICS_HOSTS = new Set(['mipyxis.com', 'www.mipyxis.com'])

export interface AnalyticsEnv {
  enabled?: string
  key?: string
  hostname: string
  /** `navigator.doNotTrack` (o equivalentes). */
  doNotTrack?: string | null
}

/** Activo solo en producción, con la variable de build y la clave, y sin Do Not Track. */
export function analyticsEnabled({ enabled, key, hostname, doNotTrack }: AnalyticsEnv): boolean {
  if (enabled !== 'true' || !key) return false
  if (!ANALYTICS_HOSTS.has(hostname)) return false
  return doNotTrack !== '1' && doNotTrack !== 'yes'
}

// Propiedades automáticas del SDK que llevan la URL completa (con ids de cliente).
const URL_PROPERTIES = [
  '$current_url',
  '$referrer',
  '$initial_referrer',
  '$session_entry_url',
  '$initial_current_url',
]
const PATH_PROPERTIES = ['$pathname', '$session_entry_pathname', '$initial_pathname']

/** `before_send` del SDK: ningún evento sale con la URL real de un cliente. */
export function scrubEventUrls<T extends { properties?: Record<string, unknown> } | null>(event: T): T {
  const props = event?.properties
  if (!props) return event
  for (const key of URL_PROPERTIES) {
    if (typeof props[key] === 'string') props[key] = sanitizeUrl(props[key])
  }
  for (const key of PATH_PROPERTIES) {
    if (typeof props[key] === 'string') props[key] = routePattern(props[key])
  }
  return event
}

let sdk: Promise<PostHog | null> | null = null
let identified: string | null = null

function readEnv(): AnalyticsEnv {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  const win = globalThis as { doNotTrack?: string }
  return {
    enabled: import.meta.env.VITE_ANALYTICS_ENABLED,
    key: import.meta.env.VITE_POSTHOG_KEY,
    hostname: typeof location === 'undefined' ? '' : location.hostname,
    doNotTrack: nav?.doNotTrack ?? win.doNotTrack ?? null,
  }
}

/** Inicializa PostHog (una vez). Sin condiciones de producción, no carga ni el SDK. */
export function initAnalytics(): void {
  if (sdk) return
  const env = readEnv()
  if (!analyticsEnabled(env)) return
  sdk = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(env.key!, {
        // Las requests salen por el Worker (worker/analyticsProxy.ts): mismo
        // dominio, sin bloqueo de adblockers y sin IP ni cookies al proveedor.
        api_host: '/ingest',
        ui_host: 'https://us.posthog.com',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_exceptions: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_flags: true,
        disable_external_dependency_loading: true,
        respect_dnt: true,
        ip: false,
        person_profiles: 'identified_only',
        persistence: 'localStorage',
        before_send: scrubEventUrls,
      })
      return posthog
    })
    .catch(() => null)
}

/** Nunca lanza ni espera red: la analítica no puede romper un flujo de negocio. */
export function track<E extends keyof AnalyticsEvents>(event: E, ...args: EventArgs<E>): void {
  void sdk?.then((ph) => ph?.capture(event, args[0] as Record<string, unknown> | undefined)).catch(() => {})
}

export interface AnalyticsTraits {
  role: WorkspaceRole
  workspace_id: string
  subteam_id: string | null
}

/** Identidad opaca: uid de Firebase, rol y ids de workspace/subequipo. Nada de email ni nombre. */
export function identifyUser(uid: string, traits: AnalyticsTraits): void {
  const key = `${uid}|${traits.role}|${traits.workspace_id}|${traits.subteam_id ?? ''}`
  if (identified === key) return
  identified = key
  void sdk
    ?.then((ph) => {
      ph?.identify(uid, { role: traits.role, workspace_id: traits.workspace_id, subteam_id: traits.subteam_id })
      ph?.group('workspace', traits.workspace_id)
    })
    .catch(() => {})
}

/** Al cerrar sesión: el siguiente usuario del navegador no hereda la identidad. */
export function resetAnalytics(): void {
  identified = null
  void sdk?.then((ph) => ph?.reset()).catch(() => {})
}
