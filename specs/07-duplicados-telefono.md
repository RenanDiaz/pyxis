# 07 — Detección de teléfonos duplicados

**Prioridad:** 🟡 Media · **Estado:** implementado · **Depende de:** [01](01-seguridad-reglas.md) · **Relacionado:** [19](19-leads-agenda.md)

## Problema
✔ `findClientsByPhone` (`src/lib/firestore.ts`) consulta `where('phone', '==', número crudo)`:
- Se guarda formateado (`+1 (xxx) xxx-xxxx`): solo coincide si el agente escribe exactamente ese formato.
- No busca en `phones[]` (teléfonos secundarios).
- La query no incluye el filtro de rol ⇒ para agente/supervisor Firestore la
  rechaza (las reglas no pueden probarse sobre el conjunto) y el error se traga.
  **Hoy solo funciona para owners, y casi nunca.**

## Decisión (2026-10-10)
**P1:** sí, el agente se entera de que el número ya es cliente **de otro agente**,
sin ver nada de ese cliente (ni nombre ni de quién es). Mensaje: "Este número ya
es cliente de otro agente del equipo. Consulta con tu supervisor".

## Implementación (2026-10-10)
- **Índice por número:** `workspaces/{wId}/phone_index/{10 dígitos}` →
  `{ client_ids: { [clientId]: true }, last_client_id }`.
  - Un doc por número (no por cliente) para que el miembro pueda **leer un
    número por su id pero no listar** el índice: así no puede recorrer los
    teléfonos del workspace. Listar y borrar es solo del owner (que ya ve todo).
  - Varios clientes pueden compartir número (familia, socios).
- **Cliente:** `phone_digits: string[]` con todos sus teléfonos (principal y
  secundarios), en 10 dígitos (`clientPhoneDigits`).
- **Escrituras** (`src/lib/phoneIndex.ts`, `writePhoneIndex`), siempre en el
  mismo batch o transacción que el cliente:
  - crear: `runClientCreate` (antes `addDoc`);
  - editar teléfonos: `runClientUpdate` pasa por transacción, lee los dígitos
    anteriores, quita al cliente de los que ya no usa y lo agrega a los nuevos;
  - borrar cliente (owner): `deleteClientCascade` lo quita del índice en el
    batch que borra al cliente;
  - borrar workspace: borra también `phone_index`.
- **Reglas:** cada escritura cambia un solo cliente (`last_client_id`) y solo
  esas dos claves.
  - Agregar: el cliente existe al terminar el batch, el usuario lo ve y su
    `phone_digits` incluye ese número.
  - Quitar: el cliente ya no tiene ese número, o fue borrado (solo owner).
  - No se puede agregar ni quitar un cliente que el usuario no ve.
- **Búsqueda** (`findPhoneMatches`): lee los docs del índice de los números
  escritos y luego cada cliente. Si la lectura del cliente da
  `permission-denied`, cuenta como "de otro agente". Hook `usePhoneMatches`:
  si algo falla, se loguea y el formulario sigue.
- **UI:**
  - `ClientForm`: revisa todos los teléfonos del formulario, también al editar
    (sin contarse a sí mismo). Cliente visible: nombre y "Ver cliente →".
    Cliente ajeno: el aviso de P1.
  - Agenda, lead nuevo (spec 19): además de los clientes cargados, encuentra
    archivados y clientes de otros agentes.
- **Se quitó** `findClientsByPhone` (la query vieja por `phone` crudo).
- **Backfill:** `npx tsx scripts/backfill-phone-index.ts [--dry-run]` escribe
  `phone_digits` en los clientes existentes y arma el índice. Idempotente.
  **Hasta correrlo, los clientes viejos no se detectan** (sí los creados o
  editados desde el deploy).
- **Tests:** unit (`clientPhoneDigits`), reglas (leer sin listar, coherencia
  con el cliente, no tocar clientes ajenos, claves extra) y emulador (crear,
  cambiar teléfono, borrar, qué ve cada rol).

**Costo aceptado:** un miembro puede preguntar por un número concreto y saber
si es cliente, aunque no lo vea. Es justo lo que pide P1; enumerar los 10^10
números de a uno no es práctico.

## Requisitos
1. Campo denormalizado `phone_digits: string[]` (todos los teléfonos, solo dígitos, normalizados a 10 dígitos US) escrito en create/update.
2. Query `where('phone_digits', 'array-contains', normalizado)` + filtro de rol
   (owner sin filtro; supervisor `subteam_id`; agente `owner_uid`). Ver P1.
3. Script de backfill de `phone_digits`.
4. Detectar también en edición (excluyendo el propio cliente) y en teléfonos secundarios.
5. Errores de la query se loguean y no rompen el formulario.

## Criterios de aceptación
- [x] Escribir `305-555-1234`, `3055551234` o `+1 (305) 555-1234` detecta al cliente existente.
- [x] Un teléfono secundario de otro cliente también se detecta.
- [x] Agente y supervisor reciben resultados (sin permission-denied).

## Preguntas abiertas
- ~~**P1:**~~ (decidido: sí, ver Decisión) ¿Un agente debe enterarse de que el número ya es cliente **de otro agente**? Es lo más útil para evitar doble venta, pero las reglas de 01 no le dejan leerlo. Opciones: (a) solo su alcance; (b) colección `phone_index/{digits}` → `{ exists, owner_display_name }` legible por miembros, sin datos del cliente. *Recomendación:* (b).
