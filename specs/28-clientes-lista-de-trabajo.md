# 28 — Clientes como lista de trabajo

**Prioridad:** 🟡 Media · **Estado:** pendiente · **Tamaño:** M (fase 1) + L (fase 2, en espera) · **Depende de:** [25](25-consistencia-visual.md) · **Relacionado:** [08](08-agenda.md), [10](10-rendimiento.md), [23](23-procesos-cancelados-saldo.md), [24](24-analytics-uso.md)

## Problema
`/clientes` es una grilla de tarjetas ordenada por fecha de creación. No se
puede ordenar, y la tarjeta no muestra lo que decide a quién llamar: cuánto
debe, cuándo es su próxima llamada, hace cuánto no se le contacta. Para
responder "¿a quién le cobro hoy?" el agente abre clientes uno por uno.

## Diagnóstico (verificado en el código, 2026-11-10)
- `Clients.tsx`: grilla `sm:2 / lg:3` columnas; filtros: texto, `Select` de
  status y switch de archivados. Sin orden ni paginación (renderiza todo).
- El filtro de status va **a Firestore** (`getClients` con `where('status')`):
  cada status es una query y una entrada de caché distinta, así que no hay
  conteos por status sin leer todo.
- **Saldo:** se puede calcular en memoria con `getClientPaymentSummary(client).balance`
  (ya respeta cancelados, spec 23). Costo cero.
- **Próxima llamada:** no está en el cliente. `getUpcomingCalls` trae un máximo
  fijo; `getCalls({ outcome: 'pendiente' })` trae todas las pendientes del
  alcance del rol (1 lectura por llamada pendiente).
- **Último contacto:** no existe. `contacted_at` es la **primera** vez que pasó
  a contactado; `updated_at` cambia con cualquier edición.
- `Home` ya usa `useClients()` sin filtros: esa lista suele estar en caché.

## Datos de uso
Según la analítica del 2026-11-10 (30 días, 1 agente y 1 owner activos; ver `README.md`):
- Clientes es el segundo módulo (81 vistas de lista, 63 de detalle), todo en escritorio.
- **No se agendó ninguna llamada a un cliente:** las 7 `call_scheduled` fueron a
  leads, y solo se registraron 3 resultados de llamada. Una columna "Próxima
  llamada" saldría vacía para todos.
- El trabajo sobre clientes es de **cobro y trámite**: 18 pagos, 21 recibos,
  14 cambios de status, 10 cambios de etapa.

Consecuencias: la fase 1 se centra en saldo, status y orden. Todo lo que
depende de llamadas (próxima llamada, último contacto) pasa a la fase 2, que
queda en espera hasta que la Agenda se use con clientes.

## Fase 1 — tabla, orden y saldo (sin cambios de datos ni lecturas extra)
### Requisitos
1. **Una sola carga:** `Clients` usa `useClients()` sin `status` y filtra en
   memoria (comparte caché con `Home`). Archivados sigue siendo una query aparte.
2. **Desktop (`lg+`): tabla** (`components/ui/table`) con columnas:

   | Columna | Fuente | Ordenable |
   |---|---|---|
   | Cliente (nombre + LLC debajo) | `getClientDisplayName`, compañía | sí (A–Z) |
   | Teléfono + acciones (WhatsApp, llamar, email) | como hoy | no |
   | Estado (abreviatura) | `client.state` | sí |
   | Status | `StatusBadge` | sí (orden del embudo) |
   | Saldo | `getClientPaymentSummary().balance` | sí |
   | Procesos | cuántos activos y su etapa más atrasada (`pendiente` < `en_proceso` < `completado`) | no |
   | Agente | solo `owner`/`supervisor` | sí |
   | Creado | `created_at` | sí (por defecto, desc) |

   Toda la fila navega al detalle (patrón "stretched link" actual, spec 13);
   las acciones siguen siendo enlaces propios con foco.
3. **Móvil (`< lg`): tarjetas** como hoy, agregando saldo (si > 0). Un selector "Ordenar por" reemplaza los encabezados de la tabla.
4. **Chips de status con conteo** en lugar del `Select`: Todos, Nuevo,
   Contactado, En proceso, Cerrado, Perdido, Deuda pendiente. Selección única.
   Los conteos son del alcance del rol y no incluyen archivados.
5. **Vistas rápidas** (segunda fila de chips, combinables con el status y el texto):
   - **Con saldo** — saldo > 0.
   - **Trámite pendiente** — pagado completo (saldo 0, total > 0) con al menos
     un proceso en `pendiente` o `en_proceso`.
6. La lista **no lee llamadas**: cero lecturas adicionales a Firestore respecto a hoy.
7. **Estado en la URL:** `?status=…&vista=…&orden=…&dir=…` (`useSearchParams`),
   para que "atrás" desde el detalle conserve la lista. El **texto buscado no va
   a la URL** (puede ser un nombre o teléfono).
8. **Render:** se muestran 100 filas y un botón "Mostrar 100 más" (ver pregunta 1).
9. Se conservan: búsqueda actual (`filterClientsBySearch`), switch y aviso de
   archivados, estados vacío / sin coincidencias / error, skeleton de carga.
10. **Analítica:** evento nuevo `clients_view_used` con
    `{ kind: 'status' | 'quick_view' | 'sort', value: string }` donde `value` es
    el id del chip, la vista o la columna (lista cerrada, sin datos de clientes).
    Actualizar `AnalyticsEvents` y el spec 24.

### Diseño técnico
- `lib/clientList.ts` (puro): `buildClientRows(clients)`,
  `sortClientRows(rows, key, dir)`, `filterByQuickView(rows, view)`,
  `countByStatus(clients)`. Montos en centavos (`money.ts`).
- `Clients.tsx` queda como orquestador; extraer `ClientsTable`, `ClientCard`,
  `ClientFilters` a `components/clients/`.
- Orden estable; nulos al final (sin estado).

## Fase 2 — seguimiento por llamadas (en espera)
No implementar hasta que se agenden llamadas a clientes de forma habitual (ver
pregunta 1).

0. **Próxima llamada:** columna ordenable y vistas rápidas **"Sin próxima
   llamada"** (status activo sin pendiente futura) y **"Llamada vencida"**
   (`isOverdue`, `lib/agenda.ts`). Fuente: `useCalls({ outcome: 'pendiente' })` →
   mapa `client_id → llamada más cercana`, ignorando leads. Cuesta una lectura
   por llamada pendiente del alcance del rol; con miles, denormalizar
   `next_call_at` en el cliente.
1. Campo `last_contact_at?: Timestamp` en `Client`, escrito en la misma
   transacción en que se registra el resultado de una llamada del cliente
   (completada o intento de contacto; **no** al agendar ni al reagendar).
2. Script `scripts/backfill-last-contact.ts [--dry-run]` (patrón de
   `migrate-to-multi-process.ts`): toma la última llamada no pendiente de cada cliente.
3. Columna "Último contacto" (relativa: "hace 3 días") y vista rápida
   **"Sin contactar en 7 días"** (status activo y `last_contact_at` > 7 días o ausente).
4. Revisar `firestore.rules`: el campo lo escribe el dueño del cliente o quien
   registra la llamada, igual que hoy `updated_at`.

## Fuera de alcance
Edición en línea, selección múltiple y acciones masivas, columnas configurables,
exportar la lista, paginación en servidor, vista kanban por status.

## Criterios de aceptación
### Fase 1
- [ ] En `lg+` se ve la tabla; debajo de `lg`, tarjetas. Sin scroll horizontal en 375 px ni en 1024 px.
- [ ] Clic en "Saldo" ordena de mayor a menor; segundo clic invierte. El encabezado indica el orden (`aria-sort`).
- [ ] El saldo de la lista coincide con el de la cabecera de `ClientDetail` (incluido un cliente con proceso cancelado).
- [ ] Los chips muestran conteos correctos y cambian al crear o cambiar el status de un cliente.
- [ ] "Con saldo" + chip "En proceso" + texto "tx" se combinan (AND).
- [ ] "Trámite pendiente" incluye a un cliente pagado con un proceso `en_proceso` y excluye a uno con todo `completado` o `cancelado`.
- [ ] Abrir `/clientes` no hace ninguna lectura de `calls`, y cambiar de status no dispara una query nueva a Firestore (verificado en Network).
- [ ] Abrir un cliente y volver con "atrás" conserva status, vista y orden.
- [ ] La URL nunca contiene el texto buscado.
- [ ] Un `agent` no ve la columna Agente; `owner` y `supervisor` sí.
- [ ] Fila navegable con teclado; las acciones WhatsApp/llamar/email tienen foco propio.
- [ ] Tests unitarios de `clientList.ts`: orden por cada columna, nulos al final, cada vista rápida, conteos.
- [ ] `clients_view_used` registrado en `AnalyticsEvents` y en el spec 24.
- [ ] `npm run build`, `npm run lint` y `npm test` pasan.

### Fase 2
- [ ] "Sin próxima llamada" no incluye clientes `cerrado` ni `perdido`.
- [ ] Una llamada a un lead no aparece como próxima llamada de ningún cliente.
- [ ] Registrar el resultado de una llamada actualiza `last_contact_at`; agendar o reagendar no.
- [ ] El backfill en `--dry-run` lista los cambios sin escribir.
- [ ] "Sin contactar en 7 días" incluye a un cliente activo sin ninguna llamada registrada.
- [ ] Tests de reglas (`tests/rules`) cubren la escritura del campo.

## Preguntas abiertas
1. **¿Por qué no se agendan llamadas a clientes?** ¿El seguimiento se hace por
   WhatsApp, o la Agenda estorba? La respuesta decide si la fase 2 tiene sentido
   o si lo que falta es otra cosa (p. ej. registrar el contacto por WhatsApp).
   Preguntar al agente antes de invertir en ella.
2. **Orden por defecto:** recomiendo mantener "Creado, más reciente" para no
   desorientar. Alternativa: "Saldo, mayor primero". Decidir con el agente.
3. **Volumen:** ¿cuántos clientes tiene el workspace más grande? Define si
   "Mostrar 100 más" basta.
4. **Fase 2, "Sin próxima llamada":** ¿`deuda_pendiente` cuenta como status
   activo? Recomiendo que sí.
5. **Fase 2:** ¿un cambio de status manual a `contactado` (sin llamada
   registrada) también cuenta como contacto? Recomiendo que sí.
