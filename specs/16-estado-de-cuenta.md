# 16 — Estado de cuenta

**Prioridad:** 🟠 Alta (pedido de producción) · **Estado:** implementado

## Problema
La cotización (spec 15) muestra el precio completo, sin descontar pagos. Si el
cliente ya abonó, falta un documento que le diga **cuánto debe** de uno o varios
procesos.

## Requisitos
1. **Dónde:** botón "Estado de cuenta" en el detalle del cliente, junto a "Cotización".
2. **Selección:** el diálogo lista los procesos del cliente.
   - Solo se pueden incluir procesos **con total acordado**. Los demás aparecen
     deshabilitados con la nota "Sin total acordado: defínelo en el proceso".
   - Por defecto se marcan los que tienen saldo pendiente. Si ninguno debe, se
     marcan todos los que tienen total, para emitir un estado "al día".
   - El diálogo muestra el resumen: total, pagado y saldo.
3. **PDF:**
   - **Encabezado:** **ESTADO DE CUENTA**, número `EC-yyMMdd-XXXX-HHmm` y fecha, y el cliente.
   - **Por proceso:**
     - Servicio, con la LLC en los registros.
     - Recuadro con total acordado, pagado y saldo (o "saldo a favor" si pagó de más).
     - Lista de pagos en orden de fecha: fecha, método, **N° de recibo** y monto.
   - **Resumen:** total de servicios y total pagado, y luego **SALDO PENDIENTE**,
     **SALDO A FAVOR** o **CUENTA AL DÍA**.
   - **"Cómo pagar":** solo si hay saldo pendiente y el workspace tiene instrucciones.
   - **Leyenda:** "Este documento no es un recibo ni un comprobante de pago. Saldos al {fecha}."
   - **Sin desglose de fees:** el total de cada línea es el del proceso.
4. **Sin persistencia:** se genera al momento.

## Diseño
- `src/lib/accountStatement.ts` (puro, con tests): `buildAccountStatement`, `canStateAccount`, `hasPendingBalance`.
  - Los montos se suman en centavos (`money.ts`).
  - El N° de recibo de cada pago sale de `getReceiptNumber` (spec 03).
- `src/lib/statementPdf.ts`: dibuja el PDF. Reutiliza `pdfBranding.ts` (encabezado, "Cómo pagar", leyenda).
- `src/components/clients/StatementDialog.tsx`: el diálogo.

## Criterios de aceptación
- [x] Registro de $579 con dos pagos ($100 + $200) y EIN de $150 sin pagos:
      saldos $279 y $150, total pendiente $429; los pagos salen en orden con su N° de recibo.
- [x] Un proceso sin total no se puede incluir.
- [x] Si el cliente pagó de más, el PDF muestra "saldo a favor".
- [x] Sin saldo pendiente, no aparece "Cómo pagar".
