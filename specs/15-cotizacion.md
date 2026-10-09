# 15 — Cotización

**Prioridad:** 🟠 Alta (pedido de producción) · **Estado:** implementado

## Problema
El agente necesita darle al cliente, antes de que pague, un documento con los
servicios y su precio, "para que sepa cuánto pagar". Hoy solo existe el recibo,
que se emite después de cada pago.

## Decisiones de producto
- **Nombre:** "Cotización" (lo eligió Isabel).
  - Implica una oferta de precio *antes de cerrar la venta*.
  - **No es un estado de cuenta:** si el cliente ya abonó, la cotización igual
    muestra el precio completo (ver R5). Un "Estado de cuenta" con
    total/pagado/saldo queda como posible feature aparte; reutilizaría casi todo esto.
- **Por cliente:** lista los procesos que elija el agente, no un documento por proceso.
- **Sin historial:** se genera al momento y no se guarda en Firestore. Sin descuentos.

## Requisitos
1. **Dónde:** botón "Cotización" en el detalle del cliente, junto a "Exportar .docx".
2. **Selección:** el diálogo lista los procesos del cliente con una casilla.
   - Por defecto se marcan los que no están `cancelado` ni `completado`.
   - Debe quedar al menos uno marcado.
3. **Precio por proceso**, editable en el diálogo.
   - Valor inicial: el total del proceso si existe; si no, el precio sugerido
     del estado (`getSuggestedPrice`).
   - Es obligatorio y debe ser mayor que 0. Los procesos manuales sin total
     arrancan vacíos y el agente los completa.
4. **Guardar precios:** casilla "Guardar estos precios como total de los procesos
   que aún no lo tienen", **marcada por defecto**.
   - Solo afecta procesos **sin** total.
   - Nunca cambia un total ya acordado: si el agente edita ese precio en el
     diálogo, el cambio vale solo para el PDF.
   - Se guarda en **una sola transacción** (`clientMutations.setMissingTotals`).
5. **Pagos previos:** si algún proceso seleccionado ya tiene pagos, el diálogo
   avisa: "Este cliente ya abonó $X en estos procesos. La cotización muestra el
   precio completo, sin descontar lo pagado".
6. **Vigencia:** se elige en días, 15 por defecto (entre 1 y 90). El PDF muestra
   "Válida hasta {fecha}".
7. **Número de cotización:** `COT-yyMMdd-XXXX-HHmm`.
   - `XXXX`: últimos 4 caracteres del id del cliente.
   - Es determinístico por minuto, no se guarda y sirve para que el cliente
     la mencione al pagar.
8. **PDF**, con el mismo diseño que el recibo:
   - **Encabezado:** logo y emisor; título **COTIZACIÓN**, número y fecha.
   - **Cliente:** nombre de la persona; si hay compañías de registro, se listan en cada línea.
   - **Tabla:** servicio (etiqueta y estado, más el nombre de la LLC en
     registros) y precio. Debajo, el **Total a pagar**.
   - **Vigencia.**
   - **Instrucciones de pago:** solo si el workspace las tiene configuradas.
   - **Leyenda:** "Este documento no es un comprobante de pago. Precios sujetos a
     cambio después de la fecha de vigencia."
   - **Archivo:** `{emisor}_{número}.pdf`.
9. **Instrucciones de pago:** nuevo campo `workspace.payment_instructions`
   (texto libre, multilínea, máximo 1000 caracteres).
   - Se edita en la sección de comprobantes de la configuración del workspace (owner).
   - Lo leen todos los miembros, porque las reglas ya permiten leer el workspace.

## Cotización rápida (sin cliente) — pedido posterior de Isabel
Durante una llamada, el cliente espera y todavía no está registrado.
- **Dónde:** botón "Cotización" en el detalle de cada estado (`/estados/:abbr`).
- **Destinatario:** "Para (opcional)" se escribe a mano. Si queda vacío, el PDF
  no muestra la sección "Preparada para".
- **Servicios:**
  - Todo el catálogo de procesos, con el precio sugerido para ese estado.
    Viene marcado "Registro de LLC"; los manuales arrancan vacíos.
  - Más "Otro servicio": nombre y precio libres.
- **Sin persistencia:** no se guarda nada ni se crea un cliente. El número usa un
  código al azar en lugar del id del cliente.
- **Una línea por servicio con su precio total.** Sin desglose de fees ni datos
  del estado; solo la abreviatura junto al servicio ("— FL").

## Diseño
- `src/lib/pdfBranding.ts`: encabezado de marca, colores, moneda y logo. Se
  extrajo de `receiptUtils.ts`, así que el recibo y la cotización comparten diseño.
- `src/lib/quote.ts` (puro, con tests):
  - `buildQuote({ ref, recipient?, lines, now, validDays })`: las líneas son
    `{ label, detail?, price }` y no dependen del modelo de proceso.
  - `processQuoteLine` convierte un proceso del cliente en una línea.
- `src/lib/quotePdf.ts`: dibuja el PDF. La sección "Cómo pagar" y la leyenda
  están en `pdfBranding.ts`, compartidas con el estado de cuenta.
- Diálogos:
  - `src/components/clients/QuoteDialog.tsx`: cotización de un cliente.
  - `src/components/quotes/QuickQuoteDialog.tsx`: cotización rápida.

## Criterios de aceptación
- [x] Cliente con registro FL (sin total) y EIN (manual, sin total): el registro
      viene con el precio sugerido y el EIN vacío; no deja generar hasta completar el EIN.
- [x] Con "Guardar precios" marcado, los procesos sin total quedan con ese total;
      los que ya tenían total no cambian.
- [x] Si un proceso tiene pagos, se muestra el aviso.
- [x] El PDF no menciona pagos y muestra la vigencia y la leyenda.
- [x] Sin instrucciones de pago configuradas, la sección no aparece.
- [x] El recibo de pago se sigue generando igual (refactor del encabezado).
