# 04 — Correcciones del reporte de ventas (Excel)

**Prioridad:** 🔴 Alta · **Estado:** bloqueado por decisiones de negocio (P3–P8) y por el error de #17 · **Tamaño:** M (antes S)

## Fuente de verdad
- Excel manual `2026_ISABEL_PAY_SEPT` (hojas June, JULY, AUG, SEPT de 2026).
- Reporte generado por la app: `October 2026 Sales Report.xlsx` (parcial, al 2026-10-09).

Ambos analizados el 2026-10-09. **No se versionan** (datos reales de clientes);
las referencias citan solo hoja + tipo + estado.

## Problema
### A. Cálculo (`src/lib/salesReportData.ts`, `buildReportInput`)

| # | Hallazgo | Impacto |
|---|----------|---------|
| ✔ 1 | `stateFee` = `state.state_fee` (fee de **registro**) para **todos** los procesos. Si el proceso no tiene estado, cae a `client.state`. | TAX y NET mal calculados para todo lo que no es registro. |
| ✔ 1b | Los campos `annual_report.fee`, `dissolution.fee` y `amendments.fee` de `states.json` son **precios de venta** (`pricing: { mode: 'state' }` en `processes.ts`), **no costos estatales**. Ej.: NY dissolution 290 / amendment 290 en el doc vs. 90 de state fee en el Excel; CA annual report 969. | El requisito original ("annual report → fee de annual report del estado") restaría el precio como costo y dejaría NET ≈ 0. **No existe hoy en el doc del estado un costo estatal para esos procesos.** |
| ✔ 1c | El `state_fee` de registro del doc no coincide con el que se resta en el Excel en varios estados (Sept/Ago/Jul): DE 260 vs 140, MD 195.70 vs 247, CA 30/70/110 vs 75, GA 110 vs 100, IL 153.38 vs 155.88, MN 155 vs 160, VA 100 vs 102.40, MA 520 vs 525, AL 236 vs 245, ID 104 vs 101, TN 307 vs 308.25. Coinciden: FL, NY, NJ, IN, CT, CO, OH, WA, NV, TX, MI, OR, AZ. | NET de registro difiere del manual. Ver P4. |
| ✔ 2 | `company` cae a `client.llc_name` | 2º registro sin nombre se reporta como la 1ª compañía (ver 03-R7). |
| 3 | Procesos `cancelado` con pagos se cuentan igual | Ventas infladas si hubo reembolso (P3). El Excel no trae casos. |
| 4 | Clientes legacy sin `processes` (si no se migró) no aparecen | Ventas faltantes. Confirmar si queda alguno en producción. |
| 5 | Comentario en `generateSalesReport.ts` dice "en blanco" pero escribe 0 | Confusión al mantener. |

### B. Fórmulas y formato (`src/lib/generateSalesReport.ts`) vs. Excel actual

| # | App | Excel manual (Ago–Sept) | Notas |
|---|-----|-------------------------|-------|
| ✔ 6 | `TAX_RATE = 0.34` fijo | **0.39** (0.34 en Jun–Jul) | La tasa cambia; debe ser configurable en el diálogo. |
| ✔ 7 | TAX = `(F-G[-H])*rate` | TAX = `(F-G-H-J)*rate` | El manual resta el Stripe fee **antes** del impuesto (desde Jul). |
| ✔ 8 | Stripe fee estimado `2.9% + $0.30` | ≈ **4 % del precio base** (CHARGE = base × 1.04; J = CHARGE − base). Excepciones al 2 %. | Parece el *surcharge* que se cobra al cliente, no la comisión real de Stripe. Ver P5. |
| ✔ 9 | REGISTERED AGENT siempre 0 | 45 cuando aplica | Llenar con un costo configurable (default 45) si `has_registered_agent`. |
| ✔ 10 | Una fila **por pago**; CHARGE = monto del pago | Una fila **por cuenta**; CHARGE = total acordado; columna **OWES** = saldo pendiente | Diferencia de modelo. Ver P6. |
| ✔ 11 | Columnas A–L, L = OWNER | L = comisión por fila (`K*0.15`), M = OWNER, N = OWES, O = FORMA DE PAGO | El generador replica un formato anterior. Ver P6. |
| ✔ 12 | Comisión = `(K_total − basePay) × rate` | Comisión = `K_total × 0.15` (desde Jul; June sí restaba 500) | Ver P7. |
| ✔ 13 | TOTAL PAY = comisión + base | TOTAL PAY = base + **bonus** + comisión | La app omite el bonus. |
| ✔ 14 | WHAT I TOOK HOME = `(K − base) − (comisión + base + gastos)` → **resta la base dos veces** | `K − gastos − TOTAL PAY` | **Bug** independiente de P7. |
| ✔ 16 | Con 2+ pagos, **cada fila de pago resta el state fee completo** (`I3=(F3-G2)*rate`, `K3=F3-G2-I3-J3`) | El fee se resta una vez por cuenta | **Bug crítico.** En el reporte de octubre, 2 cuentas a 2 pagos restan 312.40 de más (NY 210 + VA 102.40) → NET subestimado en ≈ 206 y comisión en ≈ 31. Lo mismo aplicaría a H. |
| ✔ 15 | Un proceso = una fila | El manual agrupa servicios en una fila ("ENMIENDA/EIN/BOI", "EIN/BOI") | Aceptable: la app mantiene una fila por proceso. Diferencia esperada, no se corrige. |

### C. Exportación y datos
| # | Hallazgo | Impacto |
|---|----------|---------|
| 17 | Elegir **septiembre 2026** (clientes ya archivados) da error. Los clientes archivados sí se cargan (`useClients({ archived: true })` en `Reports.tsx`), así que el error es otro. **Falta el mensaje exacto** y si sale al elegir el mes o al exportar. | No se puede reportar un mes cerrado → bloquea el último criterio de aceptación. |
| ✔ 18 | Un nombre de LLC trae un emoji ("… LLC ✅"): el agente lo usa como marca de seguimiento. | Sale tal cual en el reporte (y en .docx y recibos). Higiene de datos, no del reporte: llevar a 13 o a un spec de validaciones. |
| ✔ 19 | Default de base pay en el diálogo = 500; el manual usa 250 desde julio. | Solo un default; confirmar con P7. |

### D. Catálogo de procesos (`src/data/processes.ts`)
Aparecen en el Excel y no existen en el catálogo (hoy serían `custom`):

| Servicio (Excel) | Precio visto | State fee visto |
|------------------|--------------|-----------------|
| ITIN NUMBER | 649–700 | 250 (sin estado real) |
| CERTIFICADO DE AUTORIDAD (foreign qualification) | 270 | 175 — estado "NJ/SC" (dos estados) |
| STATEMENT OF INFORMATION (CA) | 200–249 | 20 |

## Respuestas obtenidas del Excel
- **P1 (resuelta):** STATE FEE por tipo, según el manual:
  - Registro → costo de registro del estado (ver 1c).
  - Dissolution NY → 90. Amendment NY → 90, TX → 155.
  - Statement of Information CA → 20.
  - EIN, BOI, Sales Tax Certificate, Resale Certificate → **0**.
  - Annual report: **no hay ejemplos**.
- **P5 (evidencia parcial, octubre):** un registro de NY de 659 se pagó en dos
  pagos de 329.50 por Stripe, sin el 4 % → **Pyxis guarda el monto base**, y la app le
  estima 2.9 % + 0.30 (9.86 por pago). En el manual esa cuenta tendría CHARGE ≈ 685.36
  y J ≈ 26.36. Falta confirmar si el cliente pagó el recargo.
- **P2 (resuelta en parte):** los manuales del catálogo (Sales Tax, Resale, EIN, BOI) van en 0;
  **sí hay servicios con costo** (ITIN 250, Certificado de Autoridad 175), así que hace
  falta capturar un costo por proceso.

## Objetivo
Que el reporte generado coincida con el Excel manual vigente (Ago–Sept 2026) en
columnas, fórmulas y costos, con diferencias solo por las decisiones de abajo.

## Requisitos (propuesta, sujeta a P3–P8)
1. **Costo por proceso.** Nuevo campo opcional `ClientProcess.state_cost?: number`
   (costo que se paga al estado/proveedor). Se prellena al crear el proceso y el
   agente lo puede editar. El reporte usa `state_cost` y, si falta, el default del catálogo.
2. **Defaults en el catálogo.** `ProcessDef` gana `cost` junto a `pricing`:
   - `registration` → `{ mode: 'state', key: 'state_fee' }`
   - `annual_report` / `dissolution` / `amendment` → `{ mode: 'state', key: '<tipo>.state_cost' }`
     — **campos nuevos en `states`**, editables desde `StateEditDialog` (ver P8).
   - `ein`, `boi`, `sale_tax_license`, `resale_certificate`, `newspaper_research` → `{ mode: 'fixed', amount: 0 }`
   - `newspaper_publication`, `statement_of_formation`, `custom` → `{ mode: 'manual' }`
   - Helper `getProcessStateCost(process, state)` en `processUtils.ts`.
3. Sin `process.state` en un proceso con costo derivado del estado ⇒ **0 y advertencia**
   (no caer a `client.state`).
4. `company` con `getProcessCompanyName` sin fallback al cliente.
5. Procesos cancelados según P3.
6. Diálogo de exportación: tasa de TAX configurable (default 0.39), costo de
   Registered Agent (default 45) y lista de advertencias (procesos sin estado,
   procesos con costo manual vacío, clientes legacy con pagos en el mes).
7. **State fee y RA una sola vez por cuenta** (#16), aunque la cuenta tenga varias filas de pago.
8. Fórmulas: TAX = `(F-G-H-J)*rate`; NET = `F-G-H-I-J`; H = costo de RA si aplica, si no 0.
9. Arreglar WHAT I TOOK HOME (#14) y sumar el bonus a TOTAL PAY (#13).
10. Stripe fee, layout por fila/OWES/columnas y comisión según P5–P7.
11. Corregir el error al exportar un mes con clientes archivados (#17).
12. Catálogo: agregar ITIN y Certificado de Autoridad si P8 lo confirma.

## Criterios de aceptación
- [ ] Una dissolution de NY resta 90 de state fee, no 290 (precio).
- [ ] Un EIN resta 0 de state fee.
- [ ] Un proceso con `state_cost` editado usa ese valor, no el del catálogo.
- [ ] Un proceso sin estado resta 0 y aparece en las advertencias.
- [ ] Una cuenta con 2 pagos en el mes resta el state fee **una sola vez** en el NET total.
- [ ] Se puede exportar septiembre 2026 (clientes archivados) sin error.
- [ ] TAX de una fila con Stripe resta J antes de aplicar la tasa configurada.
- [ ] WHAT I TOOK HOME = K_total − gastos fijos − TOTAL PAY (la base se resta una sola vez).
- [ ] Test unitario de `buildReportInput` con un cliente que tiene registro + amendment + EIN en el mismo mes.
- [ ] Test de fórmulas del generador (TAX, NET, comisión, TOTAL PAY, take-home) con un input fijo.
- [ ] Reporte de **septiembre 2026** generado por la app comparado contra la hoja SEPT
      del Excel manual: cada diferencia queda explicada (nombres, montos, filas agrupadas).

## Preguntas abiertas (bloquean)
- **P3:** Un proceso cancelado con pagos, ¿se reembolsó? ¿Se reporta como venta, como negativo o se excluye? *(El Excel no trae casos.)*
- **P4:** El state fee de registro en el Excel varía respecto del doc del estado (1c). ¿Cuál es el correcto: el del doc (hay que actualizarlo) o el del Excel (costo real del caso, p. ej. expedite)? CA aparece con 30, 70 y 110 en meses distintos: ¿de qué depende?
- **P5:** La columna STRIPE FEE, ¿es la comisión real de Stripe o el recargo del 4 % que se le cobra al cliente? ¿El monto del pago que se registra en Pyxis **incluye** ese 4 %? ¿Por qué algunos casos son 2 %?
- **P6:** ¿El reporte debe pasar a una fila por cuenta con CHARGE = total y OWES = saldo (como el Excel actual), o se mantiene una fila por pago? ¿Se agregan las columnas comisión por fila y FORMA DE PAGO? **Recomendación: una fila por cuenta**: elimina #16 de raíz y es el formato que el negocio usa hoy. Con una fila por pago, #16 se arregla restando G/H solo en la primera fila del bloque.
- **P7:** La comisión, ¿es `NET total × 15 %` (Jul–Sept) o `(NET total − base) × 15 %` (June, y lo que hace hoy la app)?
- **P8:** ¿Cuál es el costo estatal de annual report, dissolution y amendment por estado? (Para llenar los campos nuevos; hoy solo conocemos NY y TX.) ¿ITIN y Certificado de Autoridad entran al catálogo con costos fijos de 250 y 175?
