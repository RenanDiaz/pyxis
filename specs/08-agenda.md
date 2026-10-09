# 08 — Agenda

**Prioridad:** 🟡 Media · **Estado:** implementado · **Relacionado:** [05](05-historial-status-metricas.md) (intentos de contacto)

## Problema
- ✔ `ClientDetail` enlaza a `/agenda?client={id}` ("Agendar", "Agendar llamada") pero `Schedule.tsx` nunca lee el parámetro: el modal no se abre ni preselecciona al cliente.
- `Schedule` usa `useClients()`, que excluye archivados ⇒ sus llamadas salen como "Cliente desconocido" y sin zona horaria. Lo mismo en Home ("próxima llamada").
- Se puede agendar en el pasado.
- La hora se interpreta en la zona del **agente**; el agente piensa en la hora del **cliente**.
- "Todas" ordena de la más vieja a la más nueva y sin límite.
- `handleOutcomeChange` sin try/catch (ver 09).

## Implementación (2026-10-09)
- **Lógica pura** en `src/lib/agenda.ts` (`filterAgenda`, `isOverdue`,
  `scheduledInstant`, `isInPast`), con tests en `tests/unit/agenda.test.ts`
  (incluye "10:00 CA = 17:00 UTC").
- **`/agenda?client={id}`** (`Schedule.tsx`): abre el modal con el cliente
  preseleccionado (gana sobre el `clientId` del borrador) y quita el parámetro
  al cerrar.
- **Clientes archivados:** la Agenda y la "próxima llamada" de Inicio buscan
  también en `useClients({ archived: true })`. Las tarjetas muestran el badge
  "Archivado"; si el cliente no existe, "Cliente no disponible".
- **Zona horaria:** toggle "Hora del cliente (zona) / Mi hora", por defecto hora
  del cliente cuando tiene estado. Se guarda en UTC (`fromZonedTime`) y el
  resumen muestra ambas horas antes de confirmar.
- **Pasado:** aviso en vivo "Esa fecha y hora ya pasaron" (margen de 5 min) y
  `confirm()` al guardar. Es advertencia, no bloqueo: sirve para registrar una
  llamada que ya ocurrió.
- **Vistas:** Pendientes (por defecto: todas las pendientes, vencidas primero
  con badge "Vencida"), Hoy, Esta semana (lunes a domingo) e Historial
  (no pendientes, descendente, "Mostrar más" de 50 en 50 en memoria).
- **Intentos de contacto** (`kind: 'contact_attempt'`, spec 05) no aparecen en
  la Agenda; las llamadas nuevas se guardan con `kind: 'scheduled'`.
- Errores de `updateCall` ya los cubre el toast global (spec 09). Label
  "No contestó" corregido en `OutcomeBadge`.

### Decisiones
- "Próximas" del requisito 5 se implementó como **Pendientes** (incluye las
  vencidas): una llamada vencida sin resultado es justamente la que el agente no
  debe perder de vista.
- Paginación en memoria: el volumen por workspace es bajo; si crece, pasar a
  query paginada en Firestore.

## Requisitos
1. `/agenda?client={id}` abre el modal con el cliente preseleccionado y limpia el parámetro al cerrar. Si hay borrador (form-drafts) del modal, el parámetro gana en `clientId` y se conserva el resto.
2. Nombres de clientes de llamadas resueltos aunque el cliente esté archivado (query por IDs o incluir archivados en ese lookup).
3. Validación: fecha/hora no en el pasado (advertencia con margen de 5 min).
4. Toggle "Hora del cliente / Mi hora" al capturar; se guarda siempre en UTC (`Timestamp`). Mostrar ambas horas en la confirmación.
5. Filtro por defecto "Próximas" (pendientes desde ahora, ascendente); "Historial" descendente; paginación de 50.
6. Las llamadas de intentos de contacto (05) no se mezclan con las programadas (ver 05-P1).

## Criterios de aceptación
- [x] Desde el detalle, "Agendar llamada" abre el modal con ese cliente.
- [x] Una llamada de un cliente archivado muestra su nombre.
- [x] Capturar 10:00 "hora del cliente" para un cliente en CA desde un agente en Panamá guarda 17:00 UTC (en horario de verano) y la lista la muestra como 10:00 PT / 12:00 Panamá.
- [x] No se puede agendar ayer sin confirmación explícita.
