# Spec 24 — Analítica de uso (qué se usa y qué no)

**Estado:** ✅ código implementado · pendiente de activar (runbook al final) · **Prioridad:** 🟡 Media · **Depende de:** 17 (Worker) · **Tamaño:** M

## Problema
No sabemos qué módulos y acciones usan los agentes ni cuáles se ignoran. Las
prioridades de cambio se deciden por intuición o por quién se queja más.

## Objetivo
Medir adopción por módulo y por acción clave, segmentada por rol y workspace,
para producir un reporte mensual de prioridades: qué reforzar, qué simplificar
y qué quitar.

## Decisión
**PostHog Cloud** (plan gratis) + eventos propios, enviados a través del Worker
(`/ingest/*`). Alternativas descartadas:
- GA4 / Firebase Analytics: orientado a marketing, muestreo, pobre vista por usuario.
- Eventos en Firestore: costo por escritura y habría que construir los reportes.

## Fuera de alcance
Session replay (fase posterior, ver Preguntas abiertas), A/B tests, feature
flags, analítica de marketing de mipyxis.com, tracking en staging o en local.

## Privacidad (requisito duro)
Los clientes del producto son migrantes: el dato es sensible.
1. **Ningún evento ni propiedad lleva PII**: nada de nombres, teléfonos, emails
   de clientes, direcciones, nombres de LLC, SSN/ITIN, notas ni montos de
   clientes. Solo IDs opacos, tipos, conteos y abreviaturas de estado.
2. `identify` usa `uid` de Firebase (opaco). **No** se envía `email` ni
   `display_name` del agente.
3. `autocapture` **desactivado** (captura texto de elementos), `disable_session_recording: true`,
   `mask_all_text` irrelevante al no haber replay.
4. Solo se envían eventos de la lista cerrada de abajo; el wrapper es tipado y
   rechaza (en compilación) cualquier evento o propiedad fuera del catálogo.
5. Se desactiva con `Do Not Track` y con `VITE_ANALYTICS_ENABLED !== 'true'`.
6. Al cerrar sesión: `posthog.reset()`.

## Comportamiento
### Identidad
Tras cargar `WorkspaceContext`: `identify(uid, { role, workspace_id, subteam_id })` y
`group('workspace', workspace_id)`. Sin workspace (onboarding): solo `uid`.

### Catálogo de eventos (lista cerrada)
| Evento | Propiedades | Dónde se emite |
|---|---|---|
| `$pageview` | `route_pattern` (ej. `/clientes/:id`, **nunca** el id real) | listener de React Router en `AppLayout` |
| `client_created` | `source` (`form` \| `lead_conversion`) | `ClientForm` tras guardar nuevo |
| `client_status_changed` | `from`, `to` | tras confirmarse en Firestore: `updateClient` y `mutateClient` devuelven la `transition` real (no se emite si el status no cambió ni dentro de la transacción) |
| `process_added` | `type` (`ProcessType`), `has_state` | `AddProcessDialog` / `processMutations` |
| `process_stage_changed` | `type`, `to` | selector de etapa |
| `payment_added` | `type` del proceso | `PaymentSection` |
| `receipt_generated` | `type` | `receiptUtils` (llamador) |
| `quote_generated` | — | cotización (spec 15) |
| `statement_generated` | — | estado de cuenta (spec 16) |
| `docx_exported` | `scope` (`one` \| `all`) | `exportClientDoc` (llamador) |
| `report_exported` | — | `Reports` |
| `call_scheduled` | `kind` (`client` \| `lead`) | `Schedule` |
| `call_completed` | `outcome` | cuando el agente registra el resultado de una llamada (Agenda y centro de avisos); `outcome` distingue completada, no contestó y reagendada |
| `state_viewed` | `abbreviation` | `StateDetail` (al montar) |
| `state_search` | `has_results` | `States` (debounce 800 ms, **sin** el texto buscado) |
| `reminder_opt_in` | `channel` (`bell` \| `push`) | spec 21 |
| `search_used` | `scope` (`clients` \| `trades` \| `glossary`) | buscadores de Clientes, Oficios y Glosario, sin texto (`useSettledSearch`) |

Cualquier evento nuevo exige actualizar esta tabla y el tipo `AnalyticsEvents`.

**Nota de implementación:** Oficios y Glosario son tarjetas estáticas (no hay
"abrir/voltear"), así que `trade_viewed` y `glossary_term_viewed` no existen; el
uso de esos módulos se mide con `$pageview` y `search_used`.

### Proxy en el Worker
- `/ingest/*` → `https://us.i.posthog.com/*` (y `/ingest/static/*` → `us-assets.i.posthog.com`).
  Archivo nuevo `worker/analyticsProxy.ts` (patrón de `worker/authProxy.ts`):
  reenvía método, cuerpo y headers, **elimina** `cookie` y `x-forwarded-for`/IP del
  request saliente, y no sigue redirecciones.
- Agregar `"/ingest/*"` a `run_worker_first` en `wrangler.jsonc` (producción y
  staging) y correr `npm run cf-typegen` si cambian las vars.
- `worker/` no importa el SDK de PostHog ni nada con DOM (regla de CLAUDE.md).

### Habilitado por entorno
Un mismo build sirve producción y staging (Workers Builds tiene un único juego de
variables de build, ver `authDomain.ts`), así que la variable por sí sola no
distingue entornos. `analyticsEnabled()` exige las tres cosas:
`VITE_ANALYTICS_ENABLED === 'true'`, `VITE_POSTHOG_KEY` y que el host de la página
sea `mipyxis.com` o `www.mipyxis.com`, además de no tener Do Not Track.
- Producción (`mipyxis.com`): activo.
- Staging (`staging.mipyxis.com`), `workers.dev` y local: no se importa ni el SDK.
- Variables de build: `VITE_ANALYTICS_ENABLED`, `VITE_POSTHOG_KEY`
  (clave pública del proyecto; las `VITE_*` son de build, no secretos).
  `api_host: '/ingest'`, `ui_host: 'https://us.posthog.com'`.

## Diseño técnico
- `npm i posthog-js`; cargarlo con `import()` dinámico para no engordar el chunk inicial.
- `src/lib/analytics.ts` — único punto de contacto con el SDK:
  ```ts
  type AnalyticsEvents = { client_created: { source: 'form' | 'lead_conversion' } /* … tabla */ }
  export function track<E extends keyof AnalyticsEvents>(event: E, props?: AnalyticsEvents[E]): void
  export function identifyUser(uid: string, traits: { role: Role; workspace_id: string | null; subteam_id: string | null }): void
  export function resetAnalytics(): void
  ```
  `track` es no-op si analítica está apagada, falla en silencio (try/catch; nunca
  rompe un flujo de negocio) y no espera red.
- `src/hooks/usePageviews.ts` — `useLocation` + `matchPath` contra la lista de rutas
  de `App.tsx` para enviar `route_pattern`.
- Las llamadas a `track()` van **después** del éxito de la escritura, nunca antes.
- Tests: `track` es no-op apagado; `usePageviews` mapea `/clientes/abc123` →
  `/clientes/:id`; el proxy elimina `cookie` y no sigue redirecciones.

## Reporte de prioridades (mensual)
Dashboard en PostHog (documentar en este spec el enlace cuando exista):
1. **Adopción por módulo:** % de usuarios activos (WAU) con ≥1 `$pageview` en el módulo, por rol.
2. **Acciones clave:** conteo y usuarios únicos de cada evento del catálogo.
3. **Cola larga:** features con < 10 % de usuarios activos en 30 días.
4. **Funnel:** `client_created` → `process_added` → `payment_added` → `receipt_generated`.
5. **Retención semanal** por rol y por workspace.
6. **Estados más consultados:** `state_viewed` por `abbreviation` (insumo para qué estados mantener al día).

Regla de decisión: un número bajo no alcanza para quitar nada. Con pocos
usuarios puede ser una sola persona; antes de retirar un feature se valida con
2–3 agentes.

## Complemento sin tracking: `scripts/usage-report.ts`
Script (patrón de `scripts/migrate-to-multi-process.ts`, con `--dry-run` no aplica
al ser solo lectura) que lee Firestore y escribe un CSV/Markdown por
workspace y mes: clientes creados, procesos por `type`, pagos y recibos, llamadas
agendadas y completadas, leads convertidos. Datos de negocio agregados; no
imprime nombres ni teléfonos.

## Runbook de activación (manual)
1. Crear el proyecto en PostHog Cloud (región US, ver pregunta 2) y copiar la
   **Project API Key** (pública, `phc_…`).
2. Cloudflare → Workers & Pages → `pyxis` → Settings → Build → Variables:
   `VITE_ANALYTICS_ENABLED=true` y `VITE_POSTHOG_KEY=<clave>` (son variables de
   **build**, no secretos de runtime). Sin ellas el código no hace nada.
3. Resolver la pregunta abierta 1 (aviso a los usuarios) **antes** de este paso.
4. Desplegar `main`; verificar en DevTools → Network que las requests van a
   `mipyxis.com/ingest/*` y que ningún payload trae PII ni ids en las URLs.
5. Crear el dashboard (6 paneles de arriba) y anotar el enlace aquí.

## Criterios de aceptación
- [ ] En producción, navegar entre módulos genera `$pageview` con `route_pattern`; ninguna URL con ids reales llega a PostHog.
- [ ] Cada evento del catálogo se emite una vez por acción exitosa y no se emite si la acción falla.
- [ ] Ningún payload (revisado en Network y en PostHog) contiene nombre, teléfono, email, LLC, notas, texto de búsqueda ni montos.
- [ ] Las requests salen a `mipyxis.com/ingest/*` (no a `posthog.com`) y no son bloqueadas por uBlock Origin.
- [ ] En staging y local no se inicializa el SDK ni hay requests a `/ingest`.
- [ ] Con `Do Not Track` activo no se envía nada.
- [ ] Cerrar sesión llama `reset()`; el siguiente usuario del mismo navegador no hereda identidad.
- [ ] Si PostHog o el proxy fallan, la app funciona igual y no aparecen errores visibles.
- [ ] El chunk inicial no crece más de ~2 KB gzip (SDK cargado en diferido).
- [ ] `npm run build`, `tsc` (app y worker) y los tests pasan.
- [ ] Existe el dashboard con los 6 paneles y `scripts/usage-report.ts` corre contra el workspace de prueba.

## Preguntas abiertas
1. **Aviso a los usuarios:** ¿basta una línea en términos/onboarding ("medimos qué
   módulos se usan, sin datos de clientes") o se requiere consentimiento explícito
   (EE.UU./Panamá y política interna de ncubo)? Recomiendo la línea + validar con legal.
2. **Región de PostHog:** US (por defecto, usada en el spec) o EU.
3. **Session replay:** recomiendo fase 2 y solo con `maskAllInputs` y bloqueo de
   las páginas de cliente; hoy queda apagado por la sensibilidad del dato.
4. **Retención de datos** en PostHog: 1 año por defecto del plan gratis; ¿alcanza?
