# 19 — Llamadas a leads (sin crear cliente)

**Prioridad:** 🟠 Alta (pedido de producción) · **Estado:** propuesto · **Tamaño:** M · **Relacionado:** [08](08-agenda.md) (Agenda), [07](07-duplicados-telefono.md) (teléfonos normalizados), [05](05-historial-status-metricas.md) (métricas)

## Problema
Hoy toda llamada exige un `client_id`. Para agendar una llamada con alguien que
todavía es solo un **lead** (un prospecto que no se sabe si va a contratar), el
agente tiene que crear un cliente completo. Eso ensucia la lista de clientes y
las métricas de "nuevos" con personas que muchas veces nunca compran.

> Como agente, necesito agendar llamadas a personas no registradas sin crear un
> cliente. Si el lead se interesa, lo convierto en cliente. Si no, se queda solo
> en la Agenda.

## Decisión de diseño
**El lead vive dentro de la llamada** (`call.lead`), sin colección nueva:
```ts
interface CallLead {
  name: string            // obligatorio: cómo se llama (texto libre)
  phone: string           // obligatorio, formateado como los del cliente
  phone_digits: string    // 10 dígitos, para encontrar sus otras llamadas (07)
  state?: string          // opcional: para la zona horaria y la "buena hora"
  notes?: string          // de dónde vino, qué le interesa
}

interface Call {
  client_id: string | null   // null ⇔ llamada a un lead
  lead?: CallLead            // presente solo si client_id es null
  converted_client_id?: string // se llenó al convertir el lead (trazabilidad)
  // …resto igual
}
```

**Por qué embebido y no una colección `leads`:**
- **"No hace falta crearlos".** Una colección haría de cada lead un registro más
  que mantener, archivar y borrar.
- **Las reglas no cambian.** Las de `calls` (`canSee`/`canHold`) ya cubren al
  lead: lo ve quien ve la llamada.
- **Sin pantallas nuevas.** El lead se ve y se gestiona desde la Agenda.

**Costo aceptado:**
- Si un lead tiene varias llamadas, sus datos se repiten en cada una. "Reagendar"
  los copia, así que el agente no los vuelve a escribir.
- Para agrupar las llamadas de un mismo lead se usa `lead.phone_digits`.
- **Cuándo pasar a colección:** si el negocio pide un embudo de leads (lista,
  estados, fuente, conversión por agente), se migra a `leads/{id}` y las
  llamadas lo referencian. Ver P3.

## Requisitos
1. **Agendar a un lead** (Agenda → "Nueva llamada"):
   - El selector "Cliente" tiene un modo **"Lead (sin registrar)"**.
   - El lead pide nombre, teléfono, estado (opcional) y notas.
   - Con estado, se aplica la captura en hora del cliente de la spec 08 y la
     zona por código de área de la spec 13.
   - El borrador del modal (form-drafts) guarda también los datos del lead.
2. **Aviso de duplicado:** si el teléfono ya es de un **cliente** visible para el
   agente, se avisa "Este número ya es cliente: {nombre}" y se ofrece agendar
   con ese cliente. Usa `phone_digits` de la spec 07; mientras 07 no exista,
   solo se compara con los clientes ya cargados.
3. **En la Agenda, Inicio y la campana:**
   - La llamada a un lead muestra el nombre con un badge **"Lead"**.
   - No enlaza a `/clientes/:id`; abre un panel con sus datos y acciones.
   - Botones de contacto: llamar y WhatsApp.
4. **Reagendar:** al marcar una llamada a lead como `reagendada` (o con "Agendar
   otra"), el modal se abre con los datos del lead precargados.
5. **Convertir en cliente:**
   - Acción "Convertir en cliente" en la llamada a lead.
   - Abre `/clientes/nuevo` precargado: nombre (repartido en `first_name` y
     `last_name`), teléfono, estado y notas.
   - Al guardar el cliente, en una sola operación:
     - Las llamadas del lead **visibles para el agente** con el mismo
       `lead.phone_digits` pasan a `client_id = nuevo`.
     - Se llena `converted_client_id` y se borra `lead`.
   - El status del cliente nuevo arranca en `contactado` si alguna de esas
     llamadas está completada, y si no en `nuevo` (consistente con la spec 05).
6. **Descartar:**
   - Marcar la llamada como completada o no contestó sin convertir es suficiente.
   - No hay "borrar lead": el lead desaparece de la vista Pendientes cuando sus
     llamadas dejan de estar pendientes.
   - El historial conserva la llamada.
7. **Métricas:**
   - Las llamadas a leads **no** cuentan como clientes nuevos.
   - Sí cuentan en "llamadas del día" y en las métricas de llamadas del agente.
   - Los reportes de ventas (spec 04) no cambian: un lead no tiene procesos ni
     pagos.
8. **Validación en reglas:**
   - `client_id == null` ⇔ `lead` presente, con `name` y `phone` no vacíos.
   - El resto de las reglas de `calls` no cambia.

## Fuera de alcance (v1)
- Lista o módulo de leads, fuentes de lead y embudo de conversión (ver P3).
- Importar leads masivamente (CSV).
- Cotización o estado de cuenta para un lead. La cotización rápida de Estados
  (spec 15) ya cubre "sin cliente registrado".

## Diseño
- **Tipos:** `Call.client_id: string | null`, `CallLead` y `converted_client_id`.
- **Código que hoy asume `client_id` presente:** `Schedule.tsx`, `Home.tsx`,
  `NotificationCenter`, `useCalls({ clientId })` y la cascada de borrar cliente
  (spec 06). Un helper `getCallDisplayName(call, clientsById)` centraliza el
  nombre.
- **Agenda:** `filterAgenda` no cambia. La tarjeta distingue lead y cliente.
  Panel de lead: datos, botones de contacto, "Convertir en cliente" y
  "Agendar otra".
- **Conversión:**
  - `ClientForm` acepta `?fromCall={callId}` y precarga desde `call.lead`.
  - Tras crear el cliente, `convertLeadCalls(ctx, leadDigits, clientId)`:
    - hace una query de llamadas con `lead.phone_digits ==` dentro del alcance
      del rol;
    - aplica `batch.update`.
  - Índice: `calls(lead.phone_digits, owner_uid)` y la variante por
    `subteam_id`. Agregarlos a `firestore.indexes.json` y al test de índices de
    la spec 12.
  - Si el cliente se crea pero el batch falla: se avisa y se puede reintentar
    desde la llamada ("Vincular con cliente existente").
- **Duplicados:** reusar la normalización de dígitos de `clientSearch.ts`.
- **Reglas:**
  ```
  function validCallTarget(d) {
    return (d.client_id is string && !('lead' in d))
        || (d.client_id == null && d.lead.name is string && d.lead.name.size() > 0
            && d.lead.phone is string && d.lead.phone.size() > 0);
  }
  ```
  Se aplica en `create` y `update` de `calls`, con tests de emulador.

## Criterios de aceptación
- [ ] Un agente agenda "Juan Pérez, 305-555-1234, FL" sin crear cliente.
      `/clientes` no cambia y la Agenda la muestra con el badge "Lead".
- [ ] La hora se captura en la zona del lead (FL → Eastern) y se muestran ambas horas.
- [ ] Si ese teléfono ya es de un cliente visible, aparece el aviso con su nombre.
- [ ] "Convertir en cliente" abre el formulario precargado. Al guardar, las 2
      llamadas del lead quedan vinculadas al cliente nuevo y salen en su historial.
- [ ] Un agente no ve las llamadas a leads de otro agente: rules + test.
- [ ] Una llamada con `client_id: null` sin `lead.name` es rechazada por las reglas.
- [ ] Inicio, la campana y la Agenda no muestran "Cliente no disponible" para leads.
- [ ] Un lead no aparece en los conteos de clientes nuevos.

## Preguntas abiertas
- **P1:** ¿Un supervisor u owner también agenda a leads para sus agentes
  (asignar el lead a otro agente)? *Recomendación:* sí, con el mismo selector de
  agente que ya existe para clientes.
- **P2:** ¿Qué datos mínimos pide un lead? *Recomendación:* nombre y teléfono
  obligatorios; estado y notas opcionales.
- **P3:** ¿Hace falta ver una lista de leads (todos los que no se convirtieron,
  por fuente) para seguimiento o métricas de conversión? Si sí, se diseña la
  colección `leads` desde el inicio en vez de embebido.
