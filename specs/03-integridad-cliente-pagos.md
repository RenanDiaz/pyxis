# 03 — Integridad de escrituras del cliente y dinero

**Prioridad:** 🔴 Alta · **Estado:** implementado (R6 el 2026-10-09)

## Problema
`processes` (con sus pagos) vive como array dentro del doc del cliente y se
reescribe completo desde la copia en caché. Eso, sumado a cálculos de dinero en
coma flotante y recibos numerados por índice, produce pérdida de pagos y
documentos inconsistentes.

| # | Hallazgo | Impacto |
|---|----------|---------|
| ✔ 1 | `ClientDetail.handleProcessUpdate` / `handleAddProcess` / quitar proceso: read-modify-write de `processes` desde `client` en caché, sin transacción | Registrar un pago y enseguida cambiar la etapa de otro proceso (antes del refetch), o dos agentes/pestañas a la vez ⇒ **el último gana y se pierde el pago**. |
| ✔ 2 | `ClientForm` envía `processes` completo al editar | Pagos registrados en el detalle mientras el form estaba abierto se borran al guardar. (Mitigado parcialmente por el conflicto de borradores, no resuelto.) |
| ✔ 3 | `ClientForm` solo envía campos no vacíos + `updateDoc` hace merge | **No se puede vaciar** email, dirección, SSN, etc.: el valor viejo persiste. |
| ✔ 4 | Sumas de pagos en float (`processUtils.ts` `getProcessPaid`, `receiptUtils.ts`) sin redondeo | Residuos tipo `1e-14` impiden `full_payment` (cliente no pasa a cerrado); recibo dice "PAGO PARCIAL" con saldo $0.00. |
| ✔ 5 | Número de recibo y saldo dependen del **índice** del pago en el array (`receiptUtils.ts` `paymentIndex`) | Borrar un pago renumera los siguientes (recibos ya emitidos quedan duplicados/inconsistentes); un pago con fecha anterior altera el saldo de recibos emitidos. |
| ✔ 6 | `PaymentSection.handleDeletePayment` sin confirmación ni recálculo de status | Un clic borra dinero; cliente queda `cerrado` aunque deba. |
| ✔ 7 | `handleSetTotal` no dispara `inferStatus` | Bajar el total al monto pagado no cierra al cliente. |
| ✔ 8 | Sin tope: se puede pagar más que el saldo; "Registrar pago" solo con `total > 0` | Saldos negativos; no se puede cobrar anticipo antes de fijar precio. |
| 9 | Fallback `|| client.llc_name` en `receiptUtils.ts` | El 2º registro sin nombre sale con el nombre de la 1ª compañía (contradice la regla de herencia de `companyUtils`). |
| ✔ 10 | Notas `[SISTEMA]` (reasignaciones) viven en el mismo string editable | El agente puede borrar la auditoría desde el textarea. |

## Implementación (2026-10-09)
- **R1:**
  - `src/lib/processMutations.ts` tiene los mutadores puros (`clientMutations.*`).
  - `src/lib/clientTransactions.ts` los corre en `runTransaction` sobre el documento actual.
  - `ClientDetail`, `ProcessCard` y `PaymentSection` solo mutan procesos por esa vía.
  - El form de edición ya no envía `processes` (P1).
  - El status se calcula dentro de la transacción.
- **R2:** al editar, un campo que el usuario vació se borra con `deleteField()`.
- **R3:** `src/lib/money.ts` (centavos). Lo usan los agregados de `processUtils`, recibos, Home y el reporte.
- **R4:**
  - `Payment.id` y `receipt_number` se asignan al registrar el pago.
  - Los pagos legacy usan su posición original (lo que ya se imprimía).
  - Saldo del recibo por fecha.
  - Backfill: `npx tsx scripts/backfill-payment-ids.ts [--dry-run]`.
- **R5:**
  - Borrar un pago pide confirmación y recalcula el status: un cliente cerrado y saldado que vuelve a deber pasa a `en_proceso`.
  - Cambiar el total también recalcula.
  - Un sobrepago se advierte y se confirma, no se bloquea (P3).
  - Se pueden registrar anticipos sin total definido.
- **R7:** el recibo y el reporte ya no caen a `client.llc_name` para un registro sin nombre.
- **Tests:**
  - `npm test`: 12 unitarios (centavos, recibos, status).
  - `npm run test:emulator`: 3 de concurrencia contra el emulador. Como control, el patrón viejo (leer y después escribir) pierde 1 de 2 pagos simultáneos.
- **CI:**
  - `ci.yml` corre build y tests unitarios en cada PR.
  - `rules-tests.yml` corre también los tests de transacciones.

**R6 (2026-10-09), notas de sistema separadas:**
- **Datos:** `client.activity: ClientActivity[]`, con `{ type, text, at, by }`.
- **Reasignar:** agrega el evento con `arrayUnion` y ya **no reescribe
  `notes`**. Así no pisa lo que otro esté editando, y el bloque de notas no se
  remonta.
- **Reglas:** `activityAppendOnly()` en el update de clientes. Nadie edita ni
  borra eventos, ni siquiera el owner. Tiene tests.
- **UI:** el textarea edita solo las notas del agente. Los eventos se ven
  aparte y no se pueden editar (`getClientActivity`).
- **Datos sin migrar:** las líneas `[SISTEMA]` viejas se separan al leer
  (`splitNotes`) y se conservan al guardar (`joinNotes`). La app funciona bien
  sin correr la migración.
- **Migración (opcional, limpieza):**
  `npx tsx scripts/migrate-system-notes.ts [--dry-run]` pasa esas líneas a
  `activity` con `at: null` (la fecha va en el texto). Probada en el emulador;
  se puede volver a correr sin efecto.
- **Lógica pura:** `src/lib/clientActivity.ts`, con tests.

**Cambio de comportamiento:** las mutaciones de procesos son transacciones. Sin conexión fallan con un error explícito, en vez de quedar en cola como antes con `updateDoc`.

### Decisiones tomadas
- **P1:** los procesos se agregan, quitan y editan solo desde el detalle (confirmado). Al crear un cliente nuevo se pueden seguir agregando en el formulario: ahí no hay concurrencia porque el documento todavía no existe.
- **P2:** sin migración a centavos en Firestore.
- **P3:** el sobrepago se advierte con confirmación (recomendación del spec).
- **P4:** un recibo anulado no se puede descargar; el diálogo de borrado avisa que el recibo entregado queda sin respaldo.

## Objetivo
Ninguna operación concurrente razonable pierde un pago; los montos cuadran al
centavo; un recibo emitido conserva su número y su saldo para siempre.

## Requisitos

### R1 — Escrituras atómicas de procesos
Toda mutación de `processes` pasa por funciones en `src/lib/firestore.ts` que
usan `runTransaction`: leer el doc actual, aplicar un **mutador** sobre el array
fresco, escribir. API propuesta:
```ts
mutateClientProcesses(wsId, clientId, (processes) => ClientProcess[]): Promise<ClientProcess[]>
addPayment(wsId, clientId, processId, payment)
removePayment(wsId, clientId, processId, paymentId)
updateProcess(wsId, clientId, processId, patch)
```
El status inferido (`partial_payment`/`full_payment`) se calcula **dentro** de la
transacción sobre los datos frescos. `ClientForm` deja de enviar `processes`
al editar: agregar/quitar procesos en el form se traduce a operaciones
`addProcess`/`removeProcess` transaccionales (o se gestionan solo en el detalle — ver P1).

### R2 — Vaciar campos
Al editar, un campo del formulario que quedó vacío y antes tenía valor se envía
como `deleteField()`.

### R3 — Dinero en centavos
- Helper `toCents(n)`/`fromCents(c)` y `sumMoney(amounts[])` que redondea a centavos.
- Comparaciones de saldo (`balance <= 0`) siempre sobre centavos.
- Sin migración de datos: los montos guardados siguen en dólares; solo el cálculo cambia. (Ver P2.)

### R4 — Pagos con identidad
- `Payment` gana `id` (uuid) y `receipt_number` asignado **al registrarse**
  (secuencia por proceso: máx existente + 1, dentro de la transacción).
- Saldo del recibo = total − suma de pagos con fecha ≤ fecha del pago (orden
  estable por `date`, desempate por `receipt_number`).
- Script de backfill: asigna `id` y `receipt_number` a pagos existentes según el orden actual del array.

### R5 — Reglas de pago
- Eliminar pago: confirmación ("Se eliminará el pago de $X del {fecha}. El recibo N° Y quedará anulado") y recalcular status.
- Cambiar total: recalcular status.
- Pago mayor al saldo: advertencia y confirmación explícita (no bloqueo; ver P3).
- Permitir registrar pagos sin total definido (anticipo); saldo "Por definir".

### R6 — Notas de sistema separadas
Mover eventos de sistema a `client.activity: { type, text, at, by }[]` (o
subcolección). El textarea edita solo notas del agente. Migración: extraer
líneas `[SISTEMA]` existentes a `activity`.

### R7 — Fallback de compañía
Recibo y reporte usan `getProcessCompanyName` sin `|| client.llc_name`.

## Criterios de aceptación
- [ ] Test: dos `addPayment` concurrentes sobre el mismo cliente ⇒ ambos pagos persisten.
- [ ] Test: `addPayment` en proceso A + `updateProcess(stage)` en proceso B concurrentes ⇒ ambos cambios persisten.
- [ ] Editar cliente y vaciar email ⇒ el campo desaparece en Firestore.
- [ ] Pagos 33.33 + 33.33 + 33.34 sobre total 100 ⇒ `full_payment`, status cerrado, recibo final "PAGADO" saldo $0.00.
- [ ] Borrar el pago 1 de 3 ⇒ los recibos 2 y 3 conservan su número.
- [ ] Borrar un pago de un cliente cerrado ⇒ vuelve a deuda/parcial según corresponda, con confirmación previa.
- [ ] Bajar total al monto pagado ⇒ status `cerrado`.
- [ ] Agente no puede editar ni borrar entradas de actividad del sistema.
- [ ] 2º registro sin nombre ⇒ recibo muestra "Compañía sin nombre"/nombre de la persona, no la 1ª compañía.

## Preguntas abiertas
- **P1:** ¿Se siguen pudiendo agregar/quitar procesos desde el formulario de
  edición, o solo desde el detalle? *Recomendación:* solo desde el detalle; el
  form de edición queda para datos personales. Simplifica R1.
- **P2:** ¿Migrar montos a enteros en centavos en Firestore? *Recomendación:* no por ahora; R3 basta.
- **P3:** ¿Sobrepago se bloquea o solo se advierte? (propinas, cargos extra, redondeos de Stripe).
- **P4:** ¿Un recibo anulado debe seguir descargable marcado "ANULADO"?
