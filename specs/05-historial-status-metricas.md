# 05 — Historial de status y métricas confiables

**Prioridad:** 🟠 Alta · **Estado:** propuesto · **Base para:** [08](08-agenda.md), [11](11-metas.md)

## Problema
- ✔ `Home.tsx`: "Contactados hoy", "Cerrados hoy" y "Meta del mes" cuentan
  clientes con `status` actual + `updated_at` en el rango. Editar una nota o
  archivar un cliente cerrado hace meses **lo cuenta como venta de hoy**; un
  cliente cerrado ayer y editado hoy desaparece de ayer.
- ✔ Intento de contacto (Llamar/WhatsApp en `ClientDetail`) crea una llamada
  `outcome: 'pendiente'` con `scheduled_at: now` ⇒ aparece al instante como
  **"Llamada vencida"** en la campana, para siempre; cada clic suma otra.
- Owner/supervisor ven métricas de todo el equipo comparadas contra su meta personal.
- "Contactados hoy" muestra la meta de ventas.
- Sin estado de carga: se ven $0 / "sin llamadas" mientras carga.
- "Deuda perdida" (`Home.tsx`) marca `perdido` sin confirmación ni toast.

## Objetivo
Métricas que respondan "¿cuántos contacté/cerré hoy/este mes?" con eventos
reales, no con el último `updated_at`.

## Requisitos
1. **Eventos de status:** cada cambio de status registra
   `{ from, to, at, by }` en `client.status_history` (array, máx ~50) y
   actualiza campos denormalizados `contacted_at` (primera vez que pasa a
   contactado o posterior) y `closed_at` (al pasar a `cerrado`; se limpia si sale de cerrado).
   Centralizar en una función `changeClientStatus()`; prohibido escribir `status` por otro camino.
2. **Intentos de contacto:** se guardan como llamada `outcome: 'completada'`
   (o tipo `contact_log`, ver P1) con `channel: 'phone' | 'whatsapp'`. Nunca
   generan notificación de vencida. Script para corregir las existentes
   (notas `Contacto iniciado vía …` con outcome pendiente ⇒ completada).
3. **Dashboard:**
   - Cerrados hoy/mes = clientes con `closed_at` en el rango (query directa, con índice).
   - Contactados hoy = clientes con `contacted_at` hoy, o llamadas completadas hoy (P2).
   - Meta comparada contra la meta del ámbito que se ve (personal para agente;
     suma del equipo o meta de equipo para owner/supervisor — ver 11).
   - Skeletons mientras carga.
4. "Marcar como perdido" con confirmación y toast.
5. **Migración:** `closed_at = updated_at` para clientes actualmente cerrados
   (aproximación, documentada); `contacted_at` igual para status ≥ contactado.

## Criterios de aceptación
- [ ] Editar la nota de un cliente cerrado el mes pasado no cambia "Cerrados este mes".
- [ ] Cerrar un cliente hoy suma 1 a "Cerrados hoy" y al mes, una sola vez aunque se edite después.
- [ ] Reabrir (cerrado → en proceso) lo saca del conteo.
- [ ] Registrar intento de contacto no crea notificación de llamada vencida.
- [ ] El dashboard muestra skeleton, no $0, mientras carga.

## Preguntas abiertas
- **P1:** ¿Los intentos de contacto deben verse en Agenda? Si no, mejor colección/tipo aparte (`contact_log`).
- **P2:** "Contactados hoy": ¿clientes distintos contactados, o número de llamadas/intentos?
