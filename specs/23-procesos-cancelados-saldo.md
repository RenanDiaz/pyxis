# 23 — Procesos cancelados siguen sumando saldo (bug)

**Prioridad:** 🟠 Alta (dinero que ve el cliente) · **Estado:** propuesto · **Tamaño:** S · **Relacionado:** [04](04-reporte-ventas.md) (P3, reembolsos), [15](15-cotizacion.md), [16](16-estado-de-cuenta.md), [03](03-integridad-cliente-pagos.md)

## Problema
Un proceso con etapa `cancelado` se sigue tratando como deuda viva en todo lo
que no es el reporte de ventas. Ejemplo: registro de $579 pagado completo y un
EIN de $150 que se canceló sin pagar.
- El detalle del cliente dice saldo **$150** y la barra de pago no llega al 100 %.
- El estado de cuenta marca el EIN por defecto y le dice al cliente **SALDO PENDIENTE $150**.
- El cliente no pasa a `cerrado`: el saldo agregado nunca llega a 0.
- En Inicio, "Deudas pendientes" y la próxima llamada muestran $150 de saldo.

El reporte de ventas ya trata bien a los cancelados: cuenta lo cobrado menos
`refunded_amount` y no proyecta saldo (spec 04, P3). Este spec lleva esa misma
regla a los saldos.

## Diagnóstico (verificado en el código, 2026-10-14)
1. **Los helpers de saldo no miran la etapa:**
   - `getProcessBalance` (`src/lib/processUtils.ts:112`) = `total − pagado`.
   - `getClientPaymentSummary` (`:229`) suma `total` y pagado de todos los procesos.
   - Los usan `ClientDetail` (cabecera), `Home` (deudas y próxima llamada),
     `PaymentSection`, `StatementDialog` y `accountStatement.ts`.
2. **El status no considera los cancelados:** `summarize()`
   (`src/lib/processMutations.ts:162`) suma todos los procesos para `paidOff`.
3. **Cancelar no recalcula el status:** `clientMutations.updateProcess` solo
   llama `balanceChange` si el patch trae `total`. Cambiar la etapa (o
   `refunded_amount`) no mueve el status aunque cambie lo que se debe.
4. **Estado de cuenta:** `hasPendingBalance` marca por defecto un cancelado con
   saldo, y el PDF lo cobra como cualquier otro proceso.
5. **Cotización: no es bug.** `isQuotableByDefault` (`src/lib/quote.ts:38`) ya
   excluye cancelados por defecto. Se pueden marcar a mano (recotizar un servicio
   cancelado es válido). Queda igual; el spec 04 lo listaba por error.
6. `PaymentSection` muestra "Pendiente" o "Parcial" en un cancelado y deja
   registrar pagos nuevos.

## Regla
Un proceso cancelado **no debe nada**. Del dinero que entró, la empresa se
queda con lo **cobrado neto** = pagado − reembolsado.

| | Proceso vivo | Proceso `cancelado` |
|---|---|---|
| Total efectivo | `total` | cobrado neto |
| Pagado efectivo | pagado | cobrado neto |
| Saldo | `total − pagado` (puede ser negativo: saldo a favor) | **0 siempre** |

- `reembolsado = clamp(refunded_amount ?? 0, 0, pagado)`, igual que
  `salesReportData.ts:122`. Sin capturar = 0.
- Un cancelado nunca genera **saldo a favor**: si se cobró de más, eso se
  resuelve con el reembolso, no con el saldo.
- Montos en centavos (`money.ts`), como el resto.
- **Sin cambios de datos:** es derivado. No se toca Firestore ni hay migración.
- **Fuera de alcance:** el reporte de ventas (ya correcto, no tocar), los recibos
  (`getBalanceAfterPayment` muestra el saldo *al momento de ese pago*, que es
  histórico y está bien) y el modelo legacy (no tiene etapas).

## Requisitos
1. **Helper único** en `processUtils.ts`:
   `getProcessAccount(process) → { total, paid, refunded, balance, cancelled }`
   con la tabla de arriba. `getProcessBalance` y `getClientPaymentSummary` pasan a
   usarlo. `getProcessPaid` **no cambia**: es el pagado bruto, y lo usan el
   reporte, los recibos y la numeración.
2. **Status:** `summarize()` usa `getProcessAccount`. `updateProcess` recalcula el
   status (`balanceChange`) cuando el patch trae `total`, `stage` o
   `refunded_amount`. Con eso:
   - Si al cancelar no queda saldo y el total efectivo es > 0 → `full_payment` → `cerrado`
     (respeta `perdido` y `deuda_pendiente`, como hoy).
   - Si se reactiva un cancelado y vuelve a haber saldo en un cliente `cerrado`
     que estaba saldado → `en_proceso` (regla existente).
   - Si se cancela **todo** sin cobrar nada (total efectivo 0) → no cambia el
     status. Pasarlo a `perdido` es decisión del agente.
3. **Estado de cuenta:**
   - `hasPendingBalance` es falso para cancelados: no se marcan por defecto.
   - Se pueden incluir a mano solo si tienen pagos (cobrado bruto > 0); si no,
     aparecen deshabilitados con "Cancelado sin pagos".
   - En el PDF, la línea dice "(cancelado)" junto al servicio y el recuadro muestra
     pagado, **reembolsado** (si es > 0) y saldo $0.00. Los pagos se listan igual.
   - El resumen del diálogo y del PDF usa los montos efectivos.
4. **Detalle del cliente (`PaymentSection` en un cancelado):**
   - Badge "Cancelado" en vez de pendiente/parcial/pagado, y saldo $0.00.
   - Se oculta "Registrar pago". Editar y borrar pagos existentes sigue
     disponible (corregir errores de captura).
   - Cabecera y barra de progreso: con el resumen efectivo. Un cliente con todo
     saldado salvo un cancelado queda al 100 %.
5. **Inicio:** sin cambios de código; toma el resumen corregido.
6. **Tests** (`tests/unit/money-processes.test.ts`, `account-statement.test.ts`):
   todos los casos de los criterios. `sales-report.test.ts` debe pasar **sin cambios**.

## Criterios de aceptación
- [ ] Registro de $579 pagado + EIN de $150 cancelado sin pagos: saldo del cliente $0, barra al 100 %.
- [ ] En ese cliente, marcar el EIN como `cancelado` pasa el status de `en_proceso` a `cerrado`.
- [ ] Volver el EIN a `pendiente` regresa el status a `en_proceso` y el saldo a $150.
- [ ] Un cliente `deuda_pendiente` o `perdido` no cambia de status al cancelar.
- [ ] Cancelado con $300 pagados y `refunded_amount` 200: saldo 0, cobrado neto $100 en el total del cliente.
- [ ] Cancelado con `refunded_amount` mayor que lo pagado: se toma como lo pagado (nunca negativo).
- [ ] Cancelar todos los procesos sin pagos no cambia el status.
- [ ] Estado de cuenta: el cancelado no viene marcado; sin pagos está deshabilitado; con pagos, al incluirlo sale "(cancelado)", su reembolso y saldo $0.00, y no suma al SALDO PENDIENTE.
- [ ] Un proceso cancelado no muestra "Registrar pago"; sus pagos se pueden editar o borrar.
- [ ] Inicio → "Deudas pendientes" no muestra el saldo de procesos cancelados.
- [ ] El reporte de ventas da exactamente lo mismo que antes (`sales-report.test.ts` sin cambios).
- [ ] La cotización sigue sin marcar cancelados por defecto y permite marcarlos.

## Preguntas abiertas
- **P1:** Cancelado con pagos y `refunded_amount` sin capturar: ¿se asume que no se
  devolvió nada (cobrado neto = pagado) o se avisa en el detalle?
  *Recomendación:* asumir 0, como el reporte. El detalle ya dice "sin capturar
  (pon 0 si no se devolvió nada)".
- **P2:** Clientes que hoy están `en_proceso` solo por un cancelado no se cierran
  hasta su próximo cambio de saldo. ¿Hace falta un script que los recalcule?
  *Recomendación:* no. Que pidan a los agentes revisar sus clientes con procesos
  cancelados; si salen muchos, un script `--dry-run` que los liste.
- **P3:** ¿Bloquear pagos nuevos en un cancelado es demasiado estricto (p. ej. una
  penalidad por cancelar)? *Recomendación:* sí bloquear. Si se cobra una
  penalidad, se agrega un proceso `custom` para que tenga su propio precio y recibo.
