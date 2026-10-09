# 04 — Correcciones del reporte de ventas (Excel)

**Prioridad:** 🔴 Alta · **Estado:** bloqueado por preguntas de negocio

## Problema
`src/lib/salesReportData.ts` (`buildReportInput`):

| # | Hallazgo | Impacto |
|---|----------|---------|
| ✔ 1 | `stateFee` = `state.state_fee` (fee de **registro**) para **todos** los procesos: annual report, EIN, BOI, custom… Si el proceso no tiene estado, cae a `client.state`. | TAX y NET mal calculados para todo lo que no es registro. |
| ✔ 2 | `company` cae a `client.llc_name` | 2º registro sin nombre se reporta como la 1ª compañía (ver 03-R7). |
| 3 | Procesos `cancelado` con pagos se cuentan igual | Ventas infladas si hubo reembolso (ver P3). |
| 4 | Clientes legacy sin `processes` (si no se migró) no aparecen | Ventas faltantes. Confirmar si queda alguno en producción. |
| 5 | Comentario en `generateSalesReport.ts` dice "en blanco" pero escribe 0 | Confusión al mantener. |

## Objetivo
Que TAX/NET reflejen el costo real de cada servicio según el estado y el tipo de proceso.

## Requisitos
1. Nuevo helper `getProcessStateFee(process, state): number`:
   - `registration` → `state_fee`
   - `annual_report` → fee de annual report del estado
   - `dissolution` / `amendment` → su fee en el doc del estado
   - procesos sin costo estatal (EIN, BOI, investigación de periódicos…) → 0
   - `manual`/`custom` → ver P2
   - Sin `process.state` ⇒ **0 y advertencia** en el diálogo de exportación (no caer a `client.state` en silencio). Ver P1.
2. Definir en `src/data/processes.ts` qué campo del estado es el fee de cada tipo
   (junto a `pricing`), para no duplicar el mapeo.
3. `company` con `getProcessCompanyName` sin fallback al cliente.
4. Procesos cancelados según P3.
5. Antes de exportar, el diálogo lista advertencias: procesos sin estado,
   clientes con pagos en el mes sin `processes` (legacy).

## Criterios de aceptación
- [ ] Un annual report de FL resta el fee de annual report de FL, no el de registro.
- [ ] Un EIN resta 0 de state fee.
- [ ] Un proceso sin estado resta 0 y aparece en las advertencias.
- [ ] Test unitario de `buildReportInput` con un cliente que tiene registro + annual report + EIN en el mismo mes.
- [ ] Reporte de un mes ya cerrado comparado contra el Excel manual de ese mes: diferencias explicadas.

## Preguntas abiertas (bloquean)
- **P1:** El reporte original (manual), ¿qué ponía en STATE FEE para annual report, amendment, dissolution, EIN? Necesitamos un ejemplo real.
- **P2:** ¿Los procesos con precio manual (Sale Tax License, Resale Certificate, publicaciones) tienen un costo estatal que haya que capturar por proceso (campo `state_fee` manual)?
- **P3:** Un proceso cancelado con pagos, ¿se reembolsó? ¿Se reporta como venta, como negativo, o se excluye?
