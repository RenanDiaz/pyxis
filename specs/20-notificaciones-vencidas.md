# 20 — Notificaciones de llamadas vencidas que nunca se borran (bug)

**Prioridad:** 🟠 Alta (bug en producción) · **Estado:** reportado · **Tamaño:** S · **Relacionado:** [05](05-historial-status-metricas.md), [08](08-agenda.md), [10](10-rendimiento.md)

## Reporte (2026-10-09)
La campana muestra 5 "Llamada vencida" de **hace 6–7 meses**. Ninguna dice de
qué cliente se trata ("Cliente") y no hay forma de quitarlas: siguen ahí
siempre.

## Diagnóstico
1. **Una llamada vencida solo sale de la campana si cambia su resultado.**
   `getOverdueCalls` trae `outcome == 'pendiente'` con `scheduled_at < ahora`.
   Desde la campana no se puede resolver: el clic solo lleva al cliente. Una
   llamada olvidada queda "vencida" para siempre.
2. **Probable origen de estas 5:** los intentos de contacto (WhatsApp, Llamada
   o Email desde el detalle) se guardaban como `pendiente` con la fecha del
   momento, hasta la spec 05. Por eso se vuelven "vencidos" al instante y no
   hay nada que resolver. El script `scripts/migrate-status-history.ts` los
   corrige: los marca `completada` y `kind: 'contact_attempt'`. **Confirmar si
   se corrió en producción.** Si no, correrlo primero:
   ```bash
   npx tsx scripts/migrate-status-history.ts --dry-run   # cuenta "Intentos de contacto"
   npx tsx scripts/migrate-status-history.ts
   ```
3. **"Cliente" en vez del nombre:**
   - `NotificationCenter` busca el nombre solo entre los clientes **activos**
     (`useClients()`), así que la llamada de un cliente archivado sale como
     "Cliente".
   - La spec 08 lo corrigió en la Agenda y en Inicio, pero no en la campana.
4. **No hay límite de antigüedad:**
   - Una llamada de hace 7 meses no es accionable como "notificación"; es
     deuda de la Agenda.
   - Ocupa los 5 lugares de la campana y tapa las vencidas recientes, que
     son las importantes.

## Requisitos
1. **Resolver desde la campana:** cada llamada vencida tiene acciones rápidas
   "Completada", "No contestó" y "Reagendar". Reagendar abre la Agenda con el
   modal precargado. Al elegir una, la llamada sale de la lista.
2. **Ventana de antigüedad:**
   - La campana muestra vencidas de los **últimos 14 días** (P1).
   - Las más viejas siguen en Agenda → Pendientes con el badge "Vencida", y
     la campana muestra un resumen: "y N vencidas más antiguas → ver en la
     Agenda".
3. **Nombre correcto:**
   - La campana resuelve el nombre con clientes activos **y archivados**,
     igual que la Agenda (spec 08), o con `getCallDisplayName` (leads, spec 19).
   - Si el cliente no existe: "Cliente no disponible".
4. **Clientes cerrados o perdidos:** una llamada pendiente de un cliente
   `perdido` (o archivado) no avisa en la campana; sigue visible en la Agenda.
   Ver P2.
5. **Limpieza de datos viejos:**
   - Confirmar o correr `migrate-status-history.ts` (punto 2).
   - Para lo que quede, en Agenda → Pendientes: acción masiva "Marcar vencidas
     de más de N días como 'No contestó'", solo para el owner (P3).

## Criterios de aceptación
- [ ] Marcar "No contestó" desde la campana la quita de la lista y del contador al instante.
- [ ] Una llamada pendiente de hace 7 meses no aparece en la campana; sí en Agenda → Pendientes como "Vencida".
- [ ] La campana muestra el nombre real del cliente, también si está archivado, y el de los leads.
- [ ] Tras correr `migrate-status-history.ts`, los intentos de contacto viejos no aparecen como vencidos.

## Preguntas abiertas
- **P1:** ¿14 días de ventana para la campana? *(Recomendación: 14.)*
- **P2:** ¿Las llamadas pendientes de clientes perdidos o archivados deben
  avisar? *(Recomendación: no.)*
- **P3:** ¿Acción masiva para limpiar vencidas viejas, o basta con la ventana?
  *(Recomendación: basta con la ventana, más correr el script.)*
