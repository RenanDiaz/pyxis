# 25 — Precios de registro terminados en 9

**Prioridad:** 🟡 Media (dinero en el reporte, error de captura) · **Estado:** pendiente · **Tamaño:** S · **Relacionado:** [04](04-reporte-ventas.md) (comparación de octubre), [15](15-cotizacion.md)

## Problema
En octubre 2026, 2 de 13 registros se capturaron en Pyxis con precio redondo
(VA **550**, WI **580**) cuando el precio de venta era **549** y **579**. El
reporte de ventas salió $1 por encima en cada uno (spec 04, «Comparación octubre
2026»). Nada en la app avisa del error.

**Regla de negocio (Isabel, 2026-11-10):** el precio de un **registro de LLC**
termina en 9: es $1 menos que el número redondo, como técnica de ventas. La regla
aplica **solo a registros** (`type === 'registration'`). Los demás servicios
(annual report, dissolution, amendment, EIN, ITIN 700, `custom`…) no la siguen.

## Alcance
Un **aviso no bloqueante** cuando el precio de un registro no termina en 9.
Nunca impide guardar: hay descuentos y precios negociados legítimos.

**Fuera de alcance:**
- Otros tipos de proceso.
- Corregir datos ya capturados (los dos de octubre los corrige Isabel a mano).
- Cambiar precios del catálogo de estados (ver «Revisión del catálogo»: es una
  decisión de negocio pendiente, no de este spec).

## Regla
- Un precio **cumple** si es un entero en dólares cuyo último dígito es 9:
  `Number.isInteger(x) && x % 10 === 9`. 549, 579, 759 y 1,009 cumplen; 550,
  580, 549.50 y 744.99 no.
- **Precio sugerido:** el siguiente número terminado en 9 a partir de
  `x − 1`, o sea `Math.ceil(x / 10) * 10 − 1`. 550 → 549, 580 → 579, 551 → 559,
  549.50 → 549.
- No se avisa con precio vacío o 0. Hoy todos los `sale_price` del catálogo
  cumplen, así que el precio sugerido que precarga la app no dispara el aviso.

## Requisitos
1. **Helper puro** en `src/lib/processUtils.ts` (testeable, sin React):
   - `isCharmPrice(amount: number): boolean`
   - `suggestCharmPrice(amount: number): number`
   - `getPriceHint(type: ProcessType, amount: number): { suggested: number } | null`
     → `null` si el tipo no es `registration`, si el monto es ≤ 0 o no es
     número, o si ya cumple.
2. **Dónde se muestra el aviso** (todos los lugares donde se escribe el precio de
   un registro):
   - `PaymentSection` → diálogo «Monto total a cobrar»
     (`src/components/clients/PaymentSection.tsx`, input `payment-total`).
   - `QuoteDialog` → precio editable de cada línea de registro
     (`src/components/clients/QuoteDialog.tsx`); ese precio se guarda como
     `total` de los procesos que no tenían uno.
   - `StateEditDialog` → campo «Precio de venta» (`sale_price`) del estado
     (`src/components/states/StateEditDialog.tsx`), solo para admins: el
     catálogo es la fuente del precio sugerido.
3. **Forma del aviso:** texto bajo el input, en ámbar (no rojo, no es error):
   «Los registros suelen terminar en 9. ¿Querías decir **$549**?». El monto es
   un botón que reemplaza el valor del input; no guarda solo. Se recalcula al
   escribir y desaparece cuando el precio cumple. Accesible: asociado al input
   con `aria-describedby`, y el botón con texto completo («Usar $549»).
4. **Sin cambios de datos** ni de Firestore. Sin migración.
5. **Analítica (spec 24):** no se agrega evento. Si se quiere medir cuántas veces
   se acepta la sugerencia, el evento va al catálogo de `AnalyticsEvents` y a la
   tabla del spec 24, **sin el monto** (es PII de negocio según ese spec).

## Criterios de aceptación
- [ ] Registro con total 550 → aviso «¿Querías decir $549?»; al pulsar, el input
      queda en 549 y el aviso desaparece.
- [ ] Registro con total 580 → sugiere 579; con 549 o 759 → sin aviso.
- [ ] Registro con 549.50 → sugiere 549.
- [ ] EIN, dissolution, ITIN y `custom` con total 550 → sin aviso.
- [ ] Se puede guardar 550 igualmente; el aviso no deshabilita «Guardar».
- [ ] El aviso aparece en el diálogo de total, en la cotización (líneas de
      registro) y en «Precio de venta» al editar un estado.
- [ ] Tests unitarios de `isCharmPrice`, `suggestCharmPrice` y `getPriceHint`
      (incluye 0, negativos, `NaN` y decimales).

## Revisión del catálogo vs. Excel del proveedor (2026-11-10)
Antes de escribir este spec se comparó `src/data/states.json` con
`2026_NEW_UPDATED_EXCEL_FOR_LLC` (el Excel que Chris le pasó a Isabel en la
última actualización de precios). **No se revisó Firestore**: si un admin editó
algún estado desde la app, ese valor manda sobre el JSON.

**Costos: al día.** El `state_fee` de registro y los `state_cost` de annual
report, dissolution y amendment coinciden con las hojas NUEVO LLC, REPORTE
ANNUAL, DISSOLUTION y AMENDMENTS en los 50 estados. Las únicas diferencias son
celdas de texto del Excel («$155 mínimo…», «$60+ según activos») que el JSON
resume en un número. Excepción: **DC** tiene `state_fee` 220 en Pyxis y la celda
«LLC Fee» de DC está **vacía** en el Excel (la de Corp dice 99): hay que
confirmarlo.

**Precios de venta: el Excel no los trae directamente.** La única columna de
precio es «LLC Fee w/Bundle» (termina en .99). En **27 estados** el precio de
Pyxis es exactamente `w/Bundle − 45.99` (AL, AK, AZ, AR, CO, FL, ID, IL, IN, LA,
MS, MO, NV, NJ, NM, NY, NC, ND, OH, OR, PA, SC, TN, TX, WA, WI, WY), lo que
sugiere que el precio sale de ahí (¿bundle menos el Registered Agent?). En los
**otros 23** no cuadra:

| Estado | Pyxis | w/Bundle | w/Bundle − 45.99 | Diferencia |
|---|---:|---:|---:|---:|
| DC | 669 | 594.99 | 549 | +120 |
| KS | 649 | 594.99 | 549 | +100 |
| VT | 599 | 564.99 | 519 | +80 |
| MT | 549 | 544.99 | 499 | +50 |
| VA | 549 | 544.99 | 499 | +50 |
| MD | 699 | 704.99 | 659 | +40 |
| CA | 549 | 564.99 | 519 | +30 |
| UT | 549 | 564.99 | 519 | +30 |
| MA | 979 | 999 | 953.01 | +25.99 |
| MN | 609 | 644.99 | 599 | +10 |
| OK | 559 | 594.99 | 549 | +10 |
| GA | 549 | 599 | 553.01 | −4.01 |
| WV | 559 | 610.99 | 565 | −6 |
| CT | 569 | 624.99 | 579 | −10 |
| MI | 499 | 564.99 | 519 | −20 |
| NH | 559 | 624.99 | 579 | −20 |
| RI | 599 | 664.99 | 619 | −20 |
| SD | 599 | 664.99 | 619 | −20 |
| IA | 499 | 574.99 | 529 | −30 |
| KY | 499 | 594.99 | 549 | −50 |
| ME | 649 | 744.99 | 699 | −50 |
| NE | 549 | 644.99 | 599 | −50 |
| DE | 589 | 694.99 | 649 | −60 |

Lo que se cobró en octubre **coincide con Pyxis, no con la fórmula**: CA 549,
GA 549, NE 549 y VA 549. Así que la fórmula no es la regla, o Isabel vende con
precios propios en esos estados. Los `sale_price` de `states.json` no cambian
desde la carga inicial (mayo 2026).

### Pregunta abierta (no bloquea este spec)
- **P1:** ¿De dónde salen los precios de venta? ¿Hay una lista de precios de
  Chris aparte de este Excel? Si la fórmula es `w/Bundle − 45.99`, ¿los 23
  estados de la tabla están desactualizados en Pyxis o tienen precio propio a
  propósito? Y DC: ¿state fee 220 o 99?

  Si hay que corregir precios, se hace desde la app (Estados → editar, admins) o
  con un script tipo `scripts/update-state-costs.ts` para `sale_price`. Ningún
  precio de la tabla rompe la regla de este spec: todos terminan en 9.
