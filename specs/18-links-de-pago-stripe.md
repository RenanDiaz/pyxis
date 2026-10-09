# 18 — Links de pago con Stripe

**Prioridad:** 🟠 Alta · **Estado:** propuesto · **Tamaño:** L · **Depende de:** 17 (Worker en Cloudflare + staging)

## Problema
Para cobrar un abono hoy, el agente le pasa al cliente las instrucciones de Zelle o de transferencia y después registra el pago a mano. Queremos que el agente genere desde Pyxis un **link de pago de Stripe** por abono y lo copie para mandarlo por WhatsApp o correo. El dinero cae en la cuenta de Stripe **del workspace**.

## Decisiones tomadas
| Tema | Decisión |
|---|---|
| Cuenta Stripe | **Una por workspace**, conectada con Stripe Connect. Pyxis es la plataforma. |
| Backend | Worker de Cloudflare (spec 17). Firebase sigue en Spark, sin Cloud Functions. |
| Quién genera links | **Cualquier miembro** que pueda ver al cliente (mismo `canSee` de las reglas). |
| Granularidad | **Un link = un abono** de un proceso. Se paga una sola vez. |
| Comisión | **Se le suma al cliente** como línea aparte, "Cargo por procesamiento". Configurable por workspace. |
| Conciliación | **Sin webhook en v1.** Botón **"Verificar estado"** que consulta a Stripe en el momento. El abono lo registra el agente con un clic, con datos prellenados. |

## Alcance
- **Owner:**
  - Conectar o desconectar la cuenta Stripe del workspace.
  - Configurar el recargo.
- **Cualquier miembro, en `ProcessCard`:**
  - Generar link, copiar link, verificar estado y desactivar.
  - Registrar como abono un link pagado.

## Fuera de alcance (v1)
- **Webhook y registro automático del abono:** la metadata queda lista para v2.
- **Reembolsos y disputas:** se manejan en el Dashboard de Stripe del workspace.
- **Moneda distinta de USD y métodos de pago distintos de tarjeta.**
- **Envío del link desde Pyxis por correo o SMS:** solo se copia.
- **Comisión de plataforma para Pyxis** (`application_fee`).

## Requisitos

### R1 — Conectar Stripe (owner, `/workspace`)
1. Nueva sección **"Pagos con Stripe"** en `WorkspaceSettings`, debajo de `ReceiptBrandingSection`.
2. **Estados de la sección:**

   | Estado | Qué se ve |
   |---|---|
   | No conectado | Botón **"Conectar Stripe"** |
   | Onboarding incompleto | Aviso **"Falta completar el registro en Stripe"** y botón **"Continuar registro"** |
   | Conectado | Nombre del negocio en Stripe, ✓ "Puede cobrar", botón **"Abrir Dashboard de Stripe"** (link externo) y botón **"Desconectar"** |

3. **"Conectar":**
   - El servidor crea una **cuenta conectada** (Accounts v2) con Dashboard completo de Stripe. El workspace paga las comisiones de Stripe y responde por disputas.
   - Después crea un **Account Link** y redirige al onboarding alojado por Stripe.
   - Al volver a `/workspace?stripe=return`, la UI consulta el estado.
   - *Nota:* OAuth sobre cuentas Standard es la vía **legacy** de Stripe para plataformas nuevas. Con Accounts v2, el owner crea una cuenta nueva desde el onboarding y no puede reusar una cuenta existente. Si un owner lo exige, se evalúa OAuth en otro spec.
4. **"Desconectar":** pide confirmación y borra la conexión en Pyxis. La cuenta de Stripe sigue existiendo y es del workspace. Los links ya generados siguen siendo cobrables hasta que alguien los desactive.
   - El diálogo dice: "Los links activos seguirán funcionando. Desactívalos antes si no quieres recibir más pagos."
5. Los no-owners no ven la sección.

### R2 — Recargo por procesamiento (owner)
1. En la misma sección:
   - Switch **"Sumar la comisión de Stripe al cliente"**, activo por defecto.
   - **Porcentaje**, por defecto `2.9`.
   - **Monto fijo**, por defecto `0.30`.
2. **Aviso visible** junto al switch: "En algunos estados de EE.UU. está restringido recargar pagos con tarjeta. Las redes de tarjetas limitan el recargo al 3% y no permiten recargar tarjetas de débito. Verifica que tu negocio pueda aplicarlo." El owner decide y Pyxis no valida legalidad.
3. **Fórmula:** el monto a cobrar cubre la comisión sobre el total, no sobre el abono.
   - `cobro = ceil((abono_cents + fijo_cents) / (1 − pct/100))`
   - `recargo = cobro − abono_cents`
   - **Ejemplo:** abono $279.00 → cobro $287.65 → recargo $8.65.
4. Con el switch apagado, `recargo = 0` y el link es solo por el abono.
5. Las tarjetas internacionales pagan más en Stripe, así que el recargo es una aproximación y no se garantiza que cubra toda la comisión. Se documenta en el tooltip.

### R3 — Generar link (cualquier miembro, `ProcessCard`)
1. **Botón:** **"Link de pago"** en el bloque de pagos del proceso (`PaymentSection`), junto a "Registrar pago".
2. **Deshabilitado** con tooltip si:
   - El workspace no tiene Stripe conectado o no puede cobrar: "El owner debe conectar Stripe en Configuración".
   - El proceso no tiene total: "Define el total del proceso".
   - El saldo es 0: "Este proceso no tiene saldo pendiente".
3. **Diálogo:**
   - **Monto del abono:** por defecto el saldo pendiente. Mínimo $1.00, máximo el saldo.
   - **Desglose en vivo:** "Abono $X + Cargo por procesamiento $Y = **El cliente paga $Z**".
   - **Aviso** si el proceso ya tiene links **activos**: "Hay N link(s) activo(s) por $… sin pagar. Si el cliente paga todos, podría pagar de más."
4. **"Generar":**
   - El servidor **recalcula** el saldo y el recargo con los datos de Firestore. No usa los montos que manda el navegador.
   - Crea el Payment Link en la cuenta del workspace y guarda el registro (R7).
   - **Error:** toast con un mensaje en español, sin el error crudo de Stripe.
5. **Resultado:** el diálogo muestra la URL con el botón **"Copiar"**, que la pone en el portapapeles con un toast "Link copiado".
   - Con **Web Share API** disponible (móvil), hay también un botón **"Compartir"**.
6. **Contenido del link en Stripe:**
   - **Línea 1:** `"{getProcessLabel} — Abono"`, más `" · {nombre LLC}"` si es registro y tiene nombre.
   - **Línea 2:** `"Cargo por procesamiento"`, solo si recargo > 0.
   - **Pago:** USD, solo tarjeta, `completed_sessions.limit = 1`.
   - **Mensaje de confirmación:** "Gracias, recibimos tu pago. {nombre del workspace} te contactará."
   - **Metadata** en el link y en `payment_intent_data`: `workspace_id`, `client_id`, `process_id`, `link_doc_id`, `created_by_uid`.

### R4 — Lista de links del proceso
1. **Ubicación:** en `ProcessCard`, debajo de los pagos. La sección **"Links de pago"** aparece solo si hay links.
2. **Cada fila:**
   - Fecha, autor, abono, total cobrado y badge de estado: `Activo` (azul), `Pagado` (verde), `Desactivado` (gris).
   - Badge extra **"Prueba"** si `livemode = false`.
   - **Acciones:** Copiar · Verificar estado · Desactivar (solo `Activo`) · Registrar abono (solo `Pagado` sin registrar).
3. **Orden:** del más nuevo al más viejo.
4. Se lee con una query a la subcolección del cliente, cargada cuando se abre el detalle.

### R5 — Verificar estado
1. **Qué hace:** el servidor consulta las Checkout Sessions del Payment Link en la cuenta conectada.
   - Si hay una `complete` y `paid`, el link pasa a `pagado` y se guardan `paid_at`, `amount_charged` y los IDs de la sesión y del PaymentIntent.
   - Si el link está inactivo en Stripe, pasa a `desactivado`, por ejemplo si lo desactivaron desde el Dashboard.
   - Siempre se actualiza `checked_at`.
2. **Respuesta en la UI:** toast "Pagado el {fecha}" o "Aún no se ha pagado".
3. **Límite:** no se hace verificación automática ni en lote en v1.

### R6 — Registrar abono desde un link pagado
1. "Registrar abono" abre el diálogo de pago existente (`PaymentSection`) **prellenado**:
   - `amount` = abono, **sin el recargo**, porque el recargo no es ingreso del proceso.
   - `method = 'stripe'`.
   - `date = paid_at`.
   - `note = "Link de pago Stripe"`.
2. El pago guarda `payment_link_id`.
   - El link se muestra como "Registrado" si existe un pago con ese `payment_link_id` en el proceso.
   - El botón no aparece dos veces.
3. Va por la mutación transaccional existente (`clientMutations` / `runClientMutation`), así que el status del cliente se actualiza igual que con cualquier pago.

### R7 — Desactivar
"Desactivar" pide confirmación. El servidor desactiva el link en Stripe y el registro pasa a `desactivado`. No hay reactivación: se genera uno nuevo.

## Diseño

### Datos
```ts
// src/types/index.ts
interface Workspace {
  // …
  /** Spec 18. Ausente = defaults (enabled, 2.9, 0.30). */
  card_surcharge?: { enabled: boolean; percent: number; fixed: number }
}

interface Payment {
  // …
  /** Spec 18: pago registrado desde un link de Stripe. */
  payment_link_id?: string
}

/** workspaces/{wId}/integrations/stripe_{live|test} — solo lo escribe el Worker. */
interface StripeConnection {
  account_id: string            // acct_…
  livemode: boolean
  business_name?: string
  charges_enabled: boolean
  details_submitted: boolean
  connected_by_uid: string
  connected_at: Timestamp
  updated_at: Timestamp
}

type PaymentLinkStatus = 'activo' | 'pagado' | 'desactivado'

/** workspaces/{wId}/clients/{cId}/payment_links/{id} — solo lo escribe el Worker. */
interface PaymentLinkRecord {
  id: string
  process_id: string
  status: PaymentLinkStatus
  url: string
  amount: number               // abono (USD) — lo que se registra como pago
  surcharge: number            // recargo (USD)
  total: number                // amount + surcharge
  currency: 'usd'
  livemode: boolean
  stripe_account_id: string
  stripe_payment_link_id: string
  created_by_uid: string
  created_by_name: string
  created_at: Timestamp
  checked_at?: Timestamp
  paid_at?: string             // ISO, mismo formato que Payment.date
  amount_charged?: number
  stripe_checkout_session_id?: string
  stripe_payment_intent_id?: string
  deactivated_at?: Timestamp
}
```
**Decisiones del modelo:**
- **Subcolección, no array dentro del cliente:**
  - El Worker solo escribe docs nuevos o propios, sin pelear con las transacciones de `processes[]`.
  - Las reglas pueden prohibir que el cliente los escriba.
  - Así un monto o una URL no se pueden falsificar desde el navegador.
- **La conexión se separa por modo:** `stripe_live` / `stripe_test`. Staging (claves de prueba) y producción comparten el proyecto de Firebase, y así no se pisan.

### Reglas (`firestore.rules`)
```
match /workspaces/{workspaceId}/integrations/{doc} {
  allow read: if isWorkspaceMember(workspaceId);
  allow write: if false;            // solo el Worker (service account)
}
// dentro de match /clients/{clientId}:
match /payment_links/{linkId} {
  allow read: if isWorkspaceMember(workspaceId) && canSee(workspaceId, clientData());
  allow write: if false;
}
```
`card_surcharge` vive en el workspace, así que ya lo edita solo el owner con las reglas actuales.

### Worker (`worker/`)
| Módulo | Responsabilidad |
|---|---|
| `auth.ts` | Verifica el Firebase ID token (`Authorization: Bearer`) con `jose` contra el JWKS de `securetoken@system.gserviceaccount.com`. Valida `aud` = project id, `iss` y `exp`. Devuelve `uid`, `name` y `email`. |
| `firestore.ts` | Cliente REST mínimo de Firestore, con encode/decode de tipos. **Lecturas con el ID token del usuario**: Firestore aplica las reglas, así que `canSee` no se duplica en el Worker y un 403 de Firestore se vuelve 403 de la API. **Escrituras con la service account**: JWT RS256 firmado con WebCrypto/`jose`, intercambiado por un access token (scope `datastore`) y cacheado en memoria hasta que expira. |
| `stripe.ts` | SDK `stripe` con `httpClient: Stripe.createFetchHttpClient()`. Todas las llamadas de cobro llevan `stripeAccount: account_id`. El modo se deduce del prefijo de la clave (`sk_test_` / `sk_live_`). |
| `routes/connect.ts` | Endpoints de R1. |
| `routes/paymentLinks.ts` | Endpoints de R3, R5 y R7. |
| `errors.ts` | Mapea errores a `{ error: { code, message_es } }` con el status HTTP correcto. Nunca reenvía mensajes crudos de Stripe al cliente. |

`firebase-admin` **no** se usa en el Worker: depende de APIs de Node y gRPC que Workers no soporta bien.

### Endpoints
Todos requieren un ID token. Los marcados *owner* leen `members/{uid}` y exigen `role == 'owner'`.

| Método y ruta | Quién | Hace |
|---|---|---|
| `GET /api/stripe/status?workspaceId` | miembro | Devuelve `{ mode, connected, charges_enabled, details_submitted, business_name }`. Si es owner y hay cuenta, refresca la conexión desde Stripe. |
| `POST /api/stripe/connect` `{ workspaceId }` | owner | Crea la cuenta si no existe (y guarda `account_id` **antes** de redirigir, para que un reintento no cree otra), crea el Account Link y devuelve `{ url }`. |
| `POST /api/stripe/disconnect` `{ workspaceId }` | owner | Borra `integrations/stripe_{mode}`. |
| `POST /api/payment-links` `{ workspaceId, clientId, processId, amount }` | miembro con `canSee` | Lee el cliente y el workspace con el token del usuario y valida el proceso, el total, `1 ≤ amount ≤ saldo` y la conexión. Calcula el recargo, crea el Payment Link y el doc. Devuelve el `PaymentLinkRecord`. |
| `POST /api/payment-links/:id/refresh` `{ workspaceId, clientId }` | miembro con `canSee` | R5. Devuelve el registro actualizado. |
| `POST /api/payment-links/:id/deactivate` `{ workspaceId, clientId }` | miembro con `canSee` | R7. |

### Código compartido (`src/lib/paymentLinks.ts`, puro, con tests)
- `computeSurcharge(abonoCents, cfg) → { surchargeCents, totalCents }`.
- `resolveSurchargeConfig(workspace) → cfg`, con los defaults.
- `getPendingBalance(process)`: reusa `money.ts` y `getProcessPaid`.
- `isLinkRegistered(process, linkId)`.

El Worker importa este módulo y `getProcessLabel` (`src/lib/processUtils.ts`) con el alias `@` del spec 17. Ninguno de los dos debe importar el SDK de Firebase en runtime: hoy `processUtils` solo importa tipos y `@/data/processes`. Verificarlo al implementar.

### Frontend
| Archivo | Cambio |
|---|---|
| `src/lib/api.ts` | `apiFetch(path, body)`: agrega el ID token (`auth.currentUser.getIdToken()`) y convierte errores a `Error` con `message_es`. |
| `src/hooks/useStripeStatus.ts` | React Query, `staleTime` 5 min. |
| `src/hooks/usePaymentLinks.ts` | React Query sobre la subcolección. Mutations: crear, refrescar, desactivar. Invalida la query al terminar. |
| `src/components/workspace/StripeSection.tsx` | R1 + R2. |
| `src/components/clients/PaymentLinkDialog.tsx` | R3. |
| `src/components/clients/PaymentLinkList.tsx` | R4–R7. |
| `PaymentSection.tsx` | Botón nuevo y prellenado del diálogo de pago (R6). |

### Secretos y variables (Cloudflare → Worker → Settings → Variables & Secrets)
| Nombre | Tipo | Producción | Staging |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | secreto | `sk_live_…` de la plataforma | `sk_test_…` de la plataforma |
| `FIREBASE_SA_CLIENT_EMAIL` | secreto | service account con rol *Cloud Datastore User* | la misma |
| `FIREBASE_SA_PRIVATE_KEY` | secreto | clave PEM, con `\n` escapados | la misma |
| `FIREBASE_PROJECT_ID` | variable | id del proyecto | el mismo |
| `APP_URL` | variable | `https://mipyxis.com` | `https://staging.mipyxis.com` |

- **Service account dedicada** (`pyxis-worker@…`), no la de `firebase-admin` de los scripts. Rol mínimo: Cloud Datastore User.
- **Local:** `.dev.vars` (ignorado por git) y `.dev.vars.example` con los nombres.

### Setup manual de Stripe (una vez, en la cuenta de plataforma)
- [ ] Crear la cuenta de **plataforma**. Ver la pregunta abierta 1 sobre la entidad legal y el país.
- [ ] Activar **Connect** y completar el *platform profile*. Soporte: `soporte@mipyxis.com`.
- [ ] **Branding:** nombre "Pyxis", ícono y color. Es lo que ve el owner en el onboarding.
- [ ] Copiar las claves de test y live a los secretos de staging y producción.
- [ ] En **modo test**, conectar un workspace de staging y generar un link. Pagar con `4242 4242 4242 4242` y probar R5–R7.

## Criterios de aceptación
**Recargo (unit):**
- [ ] Abono $279.00 con 2.9% + $0.30 → recargo $8.65 y total $287.65.
- [ ] Switch apagado → recargo $0.
- [ ] Siempre redondea hacia arriba al centavo.

**Validación en el servidor:**
- [ ] Un `amount` mayor al saldo devuelve 400.
- [ ] Un proceso sin total devuelve 400.
- [ ] Si el navegador manda un monto manipulado, el link usa el recalculado o se rechaza. Nunca usa el del navegador sin validar.

**Permisos:**
- [ ] Un agente **no** puede generar un link para un cliente de otro agente: Firestore rechaza la lectura y la API responde 403.
- [ ] Un supervisor sí puede hacerlo para un cliente de su subequipo.
- [ ] Un agente no puede llamar a `/api/stripe/connect` (403).
- [ ] Un token inválido o vencido devuelve 401.

**Reglas (`tests/rules`):**
- [ ] Ningún cliente puede escribir `payment_links` ni `integrations`.
- [ ] La lectura de `payment_links` sigue a `canSee` del cliente.

**Flujo en staging (modo test):**
- [ ] El owner conecta Stripe, completa el onboarding y ve "Puede cobrar".
- [ ] El agente genera un link por $100 con recargo. El checkout de Stripe muestra 2 líneas con el total correcto y solo acepta tarjeta.
- [ ] El link se copia y abre en una ventana privada.
- [ ] Antes de pagar, "Verificar estado" → "Aún no se ha pagado". Después de pagar → `Pagado`, con la fecha.
- [ ] Un segundo intento de pago con el mismo link no es posible.
- [ ] "Registrar abono" crea un pago de $100 (sin recargo) con método Stripe y su recibo. El link queda "Registrado" y el botón desaparece.
- [ ] Desactivar un link activo → Stripe ya no lo acepta y el badge pasa a `Desactivado`.
- [ ] Los links de staging muestran el badge "Prueba".

**Errores:**
- [ ] Sin conexión de Stripe, el botón está deshabilitado con su tooltip.
- [ ] Un error de Stripe (por ejemplo, la clave revocada) muestra un toast en español y no deja ningún doc a medias.
  - **Orden:** primero se crea el link en Stripe y luego el doc. Si falla el doc, se desactiva el link.

**Código:**
- [ ] `tsc -b`, `npm run lint`, `npm test` y `npm run test:emulator` pasan.
- [ ] `CLAUDE.md` documenta la arquitectura del Worker, las colecciones nuevas y los secretos.

## Preguntas abiertas
1. **🔴 Bloquea el setup de Stripe (no el código): entidad y país de la cuenta de plataforma.**
   - Stripe exige que la plataforma Connect esté en un país soportado. Hasta donde sé, **Panamá no lo está**. Verificarlo en la lista de países de Stripe.
   - **Opciones:**
     - Una LLC de EE.UU. a nombre del dueño del producto.
     - Que la plataforma sea la empresa de uno de los workspaces.
   - Esto también define quién firma los términos de Connect y responde ante Stripe.
2. ✅ **Resuelta (2026-10-09): checkbox "Entiendo y acepto".** ~~Texto legal del recargo:~~ ¿el aviso de R2 es suficiente o se quiere un checkbox "Entiendo y acepto" al activarlo? *(Recomendación: checkbox, para dejar constancia de que lo decidió el owner).*
3. ✅ **Resuelta (2026-10-09): no se muestra en el recibo de Pyxis.** ~~¿El recargo se muestra en el recibo de Pyxis?~~
   - **Propuesta v1:** no. El recibo es del abono, y el comprobante del recargo es el de Stripe.
   - Confirmar con negocio y con el reporte de ventas (spec 04): el recargo no es venta.
