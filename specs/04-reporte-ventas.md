# 04 — Correcciones del reporte de ventas (Excel)

**Prioridad:** 🔴 Alta · **Estado:** 🟡 casi completo — preguntas de negocio resueltas; queda lo de «Pendiente» · **Tamaño:** M (antes S)

## Fuente de verdad
- Excel manual `2026_ISABEL_PAY_SEPT` (hojas June, JULY, AUG, SEPT de 2026).
- Reportes generados por la app: `October 2026 Sales Report.xlsx` (parcial, al 2026-10-09)
  y `September 2026 Sales Report.xlsx` (con los fixes de esta rama).

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
| 3 ✅ | Procesos `cancelado` con pagos se cuentan igual | Ventas infladas si hubo reembolso (P3). El Excel no trae casos. |
| 4 | Clientes legacy sin `processes` (si no se migró) no aparecen | Ventas faltantes. Confirmar si queda alguno en producción. |
| 5 | Comentario en `generateSalesReport.ts` dice "en blanco" pero escribe 0 | Confusión al mantener. |

### B. Fórmulas y formato (`src/lib/generateSalesReport.ts`) vs. Excel actual

| # | App | Excel manual (Ago–Sept) | Notas |
|---|-----|-------------------------|-------|
| ✔ 6 | `TAX_RATE = 0.34` fijo | **0.39** (0.34 en Jun–Jul) | La tasa cambia; debe ser configurable en el diálogo. |
| ✔ 7 ✅ | TAX = `(F-G[-H])*rate` | TAX = `(F-G-H-J)*rate` | El manual resta el Stripe fee **antes** del impuesto (desde Jul). |
| ✔ 8 ✅ | Stripe fee estimado `2.9% + $0.30` | ≈ **4 % del precio base** (CHARGE = base × 1.04; J = CHARGE − base). Excepciones al 2 %. | Parece el *surcharge* que se cobra al cliente, no la comisión real de Stripe. Ver P5. |
| ✔ 9 ✅ | REGISTERED AGENT siempre 0 | 45 cuando aplica | Llenar con un costo configurable (default 45) si `has_registered_agent`. |
| ✔ 10 ✅ | Una fila **por pago**; CHARGE = monto del pago | Una fila **por cuenta**; CHARGE = total acordado; columna **OWES** = saldo pendiente | Diferencia de modelo. Ver P6. |
| ✔ 11 | Columnas A–L, L = OWNER | L = comisión por fila (`K*0.15`), M = OWNER, N = OWES, O = FORMA DE PAGO | El generador replica un formato anterior. Ver P6. |
| ✔ 12 ✅ | Comisión = `(K_total − basePay) × rate` | Comisión = `K_total × 0.15` (desde Jul; June sí restaba 500) | Resuelto (P7). |
| ✔ 13 | TOTAL PAY = comisión + base | TOTAL PAY = base + **bonus** + comisión | La app omite el bonus. |
| ✔ 14 | WHAT I TOOK HOME = `(K − base) − (comisión + base + gastos)` → **resta la base dos veces** | `K − gastos − TOTAL PAY` | **Bug** independiente de P7. |
| ✔ 16 | Con 2+ pagos, **cada fila de pago resta el state fee completo** (`I3=(F3-G2)*rate`, `K3=F3-G2-I3-J3`) | El fee se resta una vez por cuenta | **Bug crítico.** En el reporte de octubre, 2 cuentas a 2 pagos restan 312.40 de más (NY 210 + VA 102.40) → NET subestimado en ≈ 206 y comisión en ≈ 31. Lo mismo aplicaría a H. |
| ✔ 15 | Un proceso = una fila | El manual agrupa servicios en una fila ("ENMIENDA/EIN/BOI", "EIN/BOI") | Aceptable: la app mantiene una fila por proceso. Diferencia esperada, no se corrige. |

### C. Exportación y datos
| # | Hallazgo | Impacto |
|---|----------|---------|
| ✔ 17 | Elegir **septiembre 2026** tumbaba la página (`RangeError: Invalid time value`). **Causa:** no eran los archivados; Safari de escritorio no soporta `<input type="month">` y lo muestra como texto libre; un valor tecleado ("2026-9", "septiembre") pasaba el filtro y `format()` de date-fns fallaba en el render. | ✅ Resuelto: selector de los últimos 24 meses. |
| ✔ 18 | Un nombre de LLC trae un emoji ("… LLC ✅"): el agente lo usa como marca de seguimiento. | Sale tal cual en el reporte (y en .docx y recibos). Higiene de datos, no del reporte: llevar a 13 o a un spec de validaciones. |
| ✔ 19 | Default de base pay en el diálogo = 500; el manual usa 250 desde julio. | Solo un default; confirmar con P7. |

### D. Catálogo de procesos (`src/data/processes.ts`)
Aparecen en el Excel y no existen en el catálogo (hoy serían `custom`):

| Servicio (Excel) | Precio visto | State fee visto |
|------------------|--------------|-----------------|
| ITIN NUMBER | 649–700 | 250 (sin estado real) |
| CERTIFICADO DE AUTORIDAD (foreign qualification) | 270 | 175 — estado "NJ/SC" (dos estados) |
| STATEMENT OF INFORMATION (CA) | 200–249 | 20 |

## Contexto de uso (2026-10)
Isabel lleva **tres registros en paralelo**: el Excel manual, Pyxis y monday.com
(el CRM que exige AH). Pyxis es un apoyo y se llena **tarde e incompleto**.
Mientras sea así, el reporte de la app no va a cuadrar con el manual: esas
diferencias son **de captura, no bugs**, y no hay que perseguirlas en código.
Hacer de Pyxis la fuente única (y, por ejemplo, exportar/sincronizar hacia
monday) es un spec aparte, fuera del 04.

## Respuestas obtenidas del Excel
- **P1 (resuelta):** STATE FEE por tipo, según el manual:
  - Registro → costo de registro del estado (ver 1c).
  - Dissolution NY → 90. Amendment NY → 90, TX → 155.
  - Statement of Information CA → 20.
  - EIN, BOI, Sales Tax Certificate, Resale Certificate → **0**.
  - Annual report: **no hay ejemplos**.
- **P5 (resuelta, 2026-10-09):** el 4 % es un **recargo que paga el cliente** al pagar
  con Stripe. Pyxis guarda el pago **sin** recargo (el recargo no es venta, spec 18). El
  reporte lo trata como el manual: **CHARGE = venta + 4 % de lo pagado con Stripe** y
  **STRIPE FEE = ese 4 %**, que resta antes del TAX (#7), así que el NET no cambia. El
  saldo pendiente lleva recargo si el primer pago fue con Stripe. Es el default del
  diálogo («Recargo del 4 %»); «Sin recargo» deja ambos en 0. Se quita la estimación
  2.9 % + 0.30. Los «casos al 2 %» del manual no son otra tasa: son el 4 % sobre la
  parte pagada con Stripe (p. ej. OR: 274.50 de 549 → 10.98), y la app los reproduce.
- **P9 (resuelta):** los 2 ITIN, el Certificado de Autoridad y el Amendment de TX de
  septiembre **no se capturaron en Pyxis** (triple captura, ver «Contexto de uso»). Los
  664.29 de diferencia son de captura. ITIN y Certificado de Autoridad deberían entrar
  al catálogo (req. 12); mientras tanto, se capturan como proceso personalizado.
- **P10 (resuelta):** el registro NJ **se vendió en agosto**; Isabel lo capturó en
  Pyxis a inicios de septiembre y el cliente pagó en septiembre. Para el negocio, **la
  venta cuenta en el mes en que se cierra, no en el que se cobra**. Pyxis no tenía ese
  dato (el reporte usaba el primer pago) → nueva **fecha de venta** por proceso (req. 13).
- **P6 (resuelta, 2026-10-09):** **una fila por cuenta, sin OWES** (el saldo no
  interesa para el cálculo). Lo importante es que aparezcan **todas las ventas aunque
  deban**: CHARGE = total acordado. El saldo pendiente es un monto **proyectado**; el
  pago que falta se asume con el **mismo método que el primero** (si fue Stripe, se
  proyecta su Stripe fee). La advertencia de montos proyectados va en el **diálogo de
  exportación, no en el Excel**. Las columnas «comisión por fila» y «FORMA DE PAGO» del
  manual no se agregan.
- **P7 (resuelta, 2026-10-09):** comisión = **NET total × 15 %**, sin descontar la base
  (como el manual desde julio). La fila «profit minus base pay» desaparece y la sección
  de gastos sigue el orden del manual: base pay, bonus, comisión, gastos fijos, TOTAL
  PAY, WHAT I TOOK HOME.
- **P3 (resuelta, 2026-10-10):** un proceso cancelado con pagos cuenta **lo cobrado menos
  lo reembolsado**; si se devolvió todo, no aparece. El **state fee se resta siempre**
  (se asume ya pagado).
- **P8 / P4 (resueltas, 2026-10-09):** costos de la tabla del proveedor
  (`2026_NEW_UPDATED_EXCEL_FOR_LLC`). ITIN: precio 700, costo 250. Certificado de
  Autoridad y demás extraordinarios: `custom` con costo capturado en el proceso.
- **P2 (resuelta en parte):** los manuales del catálogo (Sales Tax, Resale, EIN, BOI) van en 0;
  **sí hay servicios con costo** (ITIN 250, Certificado de Autoridad 175), así que hace
  falta capturar un costo por proceso.

## Comparación septiembre 2026: app vs. manual
NET total: **manual 3,429.53**, app **2,673.59** → la app queda **755.94** por debajo:

| Causa | En NET | Ref. |
|-------|-------:|------|
| 4 servicios del manual **no están en el reporte de Pyxis**: ITIN CT (649/250), ITIN CA (700/250), Certificado de Autoridad NJ/SC (270/175), Amendment TX (300/155) | +664.29 | P9 |
| El manual cuenta la venta completa con OWES; la app, solo lo cobrado (2 registros a medio pagar: MN y MI, 603.50 sin cobrar) | +368.14 | P6 |
| Registro NJ con primer pago en Pyxis el 3-sep; el manual lo puso en **agosto** (28-ago) | −302.26 | P10 |
| Stripe (la app resta 2.9 % + 0.30 sobre el monto base y no lo descuenta antes del TAX; el manual suma el 4 % a CHARGE y lo resta como J, con efecto neutro) y precios distintos (CA 549 vs 579; GA 579 vs 549 + 4 %) | +76.86 | P5 |
| RA de TN: la app marca RA pero pone H = 0; el manual resta 45 | −27.45 | #9 |
| State fee del doc vs. manual (CA 75/110, GA 100/110, MN 160/155, TN 308.25/307) | −23.64 | P4 |
| **Total** | **+755.94** | |

Otras observaciones:
- **El reporte de un mes cerrado cambia después del cierre.** Un registro de GA trae un
  2º pago del **9-oct** dentro de septiembre (la venta cuenta en el mes del primer pago
  y arrastra todos sus pagos). Si se reexporta, septiembre cambia. Refuerza P6.
- **RA:** los dos registros con RA en Pyxis (TN y el NJ de agosto) llevan 45 en el
  manual. Evidencia suficiente para #9: H = 45 cuando `has_registered_agent`.
- **Stripe:** con *Stripe fee = ninguno*, TAX y NET de la app equivalen a los del manual,
  porque `F_app = F_manual − J_manual`. Solo cambia la columna CHARGE (sin el 4 %).
- Coinciden exacto: NV y FL (CHARGE, fee y NET).

## Comparación septiembre 2026, después de P5–P10 y #9
Export de prod con #110–#114. NET: **app 2,788.77**, manual **3,429.53** → faltan **640.76**:

| Causa | En NET |
|-------|-------:|
| 4 servicios que no se capturaron en Pyxis (2 ITIN, Certificado de Autoridad, Amendment TX) — P9, captura | +664.29 |
| GA: la app cobra 579 y el manual 549 (+ 4 %); state fee 100 vs 110 | −24.37 |
| CA: la app cobra 549 y el manual 579; state fee 75 vs 110 | −3.05 |
| MN: state fee 160 vs 155 | +3.05 |
| TN: state fee 308.25 vs 307; el manual aplica el 4 % a los 804 y Pyxis tiene 402 por Stripe | +0.79 |
| Redondeo de CHARGE (TX, AZ) | +0.05 |
| **Total** | **+640.76** |

Las 10 cuentas capturadas en Pyxis quedan a **23.53** del manual: solo diferencias de
precio capturado y de state fee de registro (P4: se corrige editando el estado en
Estados). Ya no hay diferencias de fórmula, de mes ni de formato.

## Objetivo
Que el reporte generado coincida con el Excel manual vigente (Ago–Sept 2026) en
columnas, fórmulas y costos, con diferencias solo por las decisiones de abajo.

## Requisitos
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
5. Procesos cancelados según P3: CHARGE = cobrado − reembolsado (`refunded_amount`),
   sin saldo proyectado; state fee se resta igual.
6. Diálogo de exportación: tasa de TAX configurable (default 0.39), costo de
   Registered Agent (default 45) y lista de advertencias (procesos sin estado,
   procesos con costo manual vacío, clientes legacy con pagos en el mes).
7. **State fee y RA una sola vez por cuenta** (#16), aunque la cuenta tenga varias filas de pago.
8. Fórmulas: TAX = `(F-G-H-J)*rate`; NET = `F-G-H-I-J`; H = costo de RA si aplica, si no 0.
9. Arreglar WHAT I TOOK HOME (#14) y sumar el bonus a TOTAL PAY (#13).
10. Stripe fee, layout por fila/OWES/columnas y comisión según P5–P7.
11. Corregir el error al exportar un mes con clientes archivados (#17).
12. Catálogo: agregar ITIN y Certificado de Autoridad (P9) con su costo (P8).
13. **Fecha de venta por proceso** (`ClientProcess.sold_at`, `yyyy-MM-dd`, **opcional**).
    Sin ella, la venta cuenta en el mes del **primer pago** (`getProcessSaleDate`). Se
    llena solo cuando la venta se cerró antes de cobrarse o se capturó tarde (caso NJ),
    al agregar el proceso o en su tarjeta; borrarla vuelve al primer pago.
    **No se usa `created_at` ni se pone «hoy» por defecto:** un proceso se agrega al
    cotizar a un prospecto, a veces un mes antes de la venta. El export de septiembre
    con esa regla (prod tras #108) metió en septiembre dos ventas de octubre (TX y NY,
    creadas en septiembre, primer pago el 1 y el 3-oct).
14. **Editar un pago** (fecha, monto, método) sin perder su número de recibo. Hoy
    solo se puede eliminar y volver a crear, y eso renumera el recibo. Prioridad baja,
    pero hace falta si se captura tarde.

## Implementado (rama `claude/spec-04-reporte-ventas`)
- #16: state fee y RA solo en la fila del primer pago de cada cuenta.
- #14 y #13: WHAT I TOOK HOME = `K_total − (TOTAL PAY + gastos fijos)`; TOTAL PAY suma el bonus.
- #6: tasa de TAX configurable en el diálogo (default 0.39, `DEFAULT_TAX_RATE`).
- #1 (parcial): sin fallback a `client.state`; los procesos sin estado van en 0 y el
  diálogo los lista. El costo por tipo de proceso (req. 1–2) sigue pendiente de P8.
- #17: selector de mes en vez de `<input type="month">`.
- #5: comentario corregido.
- Req. 13: fecha de venta (`sold_at`) en `AddProcessDialog` y `ProcessCard`; el reporte
  y su vista previa agrupan por `getProcessSaleDate` y ordenan las cuentas por esa fecha.
- P6 / #10 / #16: **una fila por venta**. B = fecha de venta; F = total acordado
  (sin total, lo cobrado; nunca menos de lo cobrado); J = Stripe fee de lo pagado con
  Stripe + el del saldo si el primer pago fue con Stripe. Una **venta** es un proceso
  con al menos un pago (sin pagos es un prospecto o una cotización). La página de
  Reportes muestra Ventas / Total vendido / Por cobrar y el diálogo lista las ventas
  con saldo proyectado.
- P5 / #7 / #8: recargo de Stripe del 4 % en CHARGE y STRIPE FEE (default del
  diálogo; lo guardado en el navegador con el modo viejo se descarta una vez);
  TAX = `(F-G[-H]-J)*rate`, NET = `F-G[-H]-J-I`.
- #9: H = costo del Registered Agent (default 45, editable en el diálogo) cuando el
  registro tiene `has_registered_agent`; si no, 0. TAX y NET restan H siempre, como el
  manual. Verificado con septiembre: las 2 cuentas marcadas en Pyxis (NJ, TN) son las
  que llevan 45 en el manual, y ninguna otra.
- Tests: `tests/unit/sales-report.test.ts`.

- P8 / P4 / req. 1, 2, 12: **costo estatal por proceso**.
  - `ProcessDef.cost` (como `pricing`): registro → `state_fee`; annual report,
    dissolution y amendment → `<sección>.state_cost` del estado (campos nuevos, editables
    en `StateEditDialog`, donde «Fee» pasa a «Precio de venta»); EIN, BOI, Sales Tax,
    Resale, investigación de periódicos → 0; publicaciones, Statement of Formation y
    `custom` → manual.
  - `ClientProcess.state_cost` (captura del agente en `ProcessCard`, «Costo estatal»)
    manda sobre el catálogo. `getProcessStateCost` devuelve el costo o el motivo por el
    que falta (`no_state`, `no_state_value`, `manual`); el diálogo de exportación lista
    esas ventas y su STATE FEE sale en 0.
  - **ITIN** en el catálogo: precio fijo 700, costo fijo 250, sin estado.
  - Datos: tabla del proveedor `2026_NEW_UPDATED_EXCEL_FOR_LLC` (hojas NUEVO LLC,
    REPORTE ANNUAL, DISSOLUTION, AMENDMENTS) → `states.json`. Cuadra con el manual (NY
    dissolution 90, NY y TX amendment 90 / 155, registros de AL, GA, MN, TN, DE, MD…).
    También corrige el `state_fee` de registro de 20 estados (P4). A Firestore con
    `npx tsx scripts/update-state-costs.ts [--dry-run]` (solo toca los campos de costo).

- P3: `ClientProcess.refunded_amount`, que se captura en la tarjeta del proceso cuando
  está «Cancelado». El reporte cuenta lo cobrado menos lo reembolsado, sin proyectar
  saldo, y lo omite si se devolvió todo; el state fee se resta igual. El recargo de
  Stripe solo aplica a lo no reembolsado. El diálogo lista las ventas canceladas y
  marca las que no tienen el reembolso capturado (se toma como 0).

**Pendiente:** #2 (company), #4 y editar pagos (req. 14). Fuera del reporte, un
proceso cancelado sigue sumando su saldo en el estado de cuenta, la cotización y el
status del cliente (spec aparte). Costos por confirmar,
que hoy quedan vacíos (STATE FEE 0 + advertencia) o con un valor base tomado del texto
de la tabla:
- Annual report vacío: **CA** (la tabla solo trae el SOI de $20, y el annual report de
  Pyxis se vende a 969: ¿incluye los $800 de franchise tax?), **AL** (mín. 100, máx.
  15,000), **SC** (0.1 % del capital + 15). AZ, MO, NM, OH y TX no tienen reporte.
- Annual report con valor base del texto: AR 155, DE 300, ID 0, KY 15, MT 0, OK 25,
  WI 26, WY 60.
- Dissolution vacío: CA, DE, PA, TN, TX (la tabla dice «can't file»).

## Criterios de aceptación
- [x] Una venta con fecha de venta en agosto y pagos en septiembre sale en el reporte de agosto, no en el de septiembre.
- [x] Una dissolution de NY resta 90 de state fee, no 290 (precio).
- [x] Un EIN resta 0 de state fee.
- [x] Un proceso con `state_cost` editado usa ese valor, no el del catálogo.
- [x] Un proceso sin estado resta 0 y aparece en las advertencias.
- [x] Una cuenta con 2 pagos en el mes resta el state fee **una sola vez** en el NET total.
- [x] Se puede exportar septiembre 2026 (clientes archivados) sin error.
- [x] Una venta con saldo pendiente sale en una sola fila con CHARGE = total, y el diálogo la lista como proyectada.
- [x] Un proceso sin pagos no aparece en el reporte.
- [ ] TAX de una fila con Stripe resta J antes de aplicar la tasa configurada.
- [x] WHAT I TOOK HOME = K_total − gastos fijos − TOTAL PAY (la base se resta una sola vez).
- [x] Test unitario de `buildReportInput` con un cliente que tiene registro + amendment + EIN en el mismo mes.
- [x] Test de fórmulas del generador (TAX, NET, comisión, TOTAL PAY, take-home) con un input fijo.
- [x] Reporte de **septiembre 2026** generado por la app comparado contra la hoja SEPT
      del Excel manual: cada diferencia queda explicada (nombres, montos, filas agrupadas).

## Preguntas abiertas (bloquean)
Ninguna. Las respuestas están en «Respuestas obtenidas del Excel».
