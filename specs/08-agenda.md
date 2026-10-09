# 08 — Agenda

**Prioridad:** 🟡 Media · **Estado:** propuesto · **Relacionado:** [05](05-historial-status-metricas.md) (intentos de contacto)

## Problema
- ✔ `ClientDetail` enlaza a `/agenda?client={id}` ("Agendar", "Agendar llamada") pero `Schedule.tsx` nunca lee el parámetro: el modal no se abre ni preselecciona al cliente.
- `Schedule` usa `useClients()`, que excluye archivados ⇒ sus llamadas salen como "Cliente desconocido" y sin zona horaria. Lo mismo en Home ("próxima llamada").
- Se puede agendar en el pasado.
- La hora se interpreta en la zona del **agente**; el agente piensa en la hora del **cliente**.
- "Todas" ordena de la más vieja a la más nueva y sin límite.
- `handleOutcomeChange` sin try/catch (ver 09).

## Requisitos
1. `/agenda?client={id}` abre el modal con el cliente preseleccionado y limpia el parámetro al cerrar. Si hay borrador (form-drafts) del modal, el parámetro gana en `clientId` y se conserva el resto.
2. Nombres de clientes de llamadas resueltos aunque el cliente esté archivado (query por IDs o incluir archivados en ese lookup).
3. Validación: fecha/hora no en el pasado (advertencia con margen de 5 min).
4. Toggle "Hora del cliente / Mi hora" al capturar; se guarda siempre en UTC (`Timestamp`). Mostrar ambas horas en la confirmación.
5. Filtro por defecto "Próximas" (pendientes desde ahora, ascendente); "Historial" descendente; paginación de 50.
6. Las llamadas de intentos de contacto (05) no se mezclan con las programadas (ver 05-P1).

## Criterios de aceptación
- [ ] Desde el detalle, "Agendar llamada" abre el modal con ese cliente.
- [ ] Una llamada de un cliente archivado muestra su nombre.
- [ ] Capturar 10:00 "hora del cliente" para un cliente en CA desde un agente en Panamá guarda 17:00 UTC (en horario de verano) y la lista la muestra como 10:00 PT / 12:00 Panamá.
- [ ] No se puede agendar ayer sin confirmación explícita.
