# Spec — Borradores de formularios (localStorage)

**Estado:** implementado · **Rama:** `claude/webapp-review-analysis-fayc4o`

## Problema
Un agente llena el formulario de un cliente durante la llamada. Si recarga la
página, se cierra el navegador o se le cae la sesión, pierde todo lo escrito.

## Objetivo
Autoguardar en `localStorage` los formularios en curso y restaurarlos al volver,
sin exponer datos sensibles ni pisar cambios hechos por otros mientras tanto.

## Alcance
| Formulario | `formId` | Archivo |
|---|---|---|
| Cliente nuevo | `client-form:new` | `src/pages/ClientForm.tsx` |
| Editar cliente | `client-form:edit:{clientId}` | `src/pages/ClientForm.tsx` |
| Agendar llamada (modal) | `schedule:new-call` | `src/pages/Schedule.tsx` |
| Notas del cliente | `client-notes:{clientId}` | `src/pages/ClientDetail.tsx` (`ClientNotesCard`) |

Fuera de alcance: diálogos cortos (pago, total, agregar proceso, metas, edición
de estados), sincronización entre dispositivos y entre pestañas.

## Comportamiento
1. **Autoguardado:** con debounce de 600 ms tras el último cambio. Además se
   vuelca de inmediato en `pagehide`, en `visibilitychange → hidden` (móvil) y al
   desmontar el componente (navegar a otra ruta).
2. **Solo si hay cambios:** si el formulario vuelve a su valor inicial, el
   borrador se elimina. Los campos vacíos no cuentan como cambio.
3. **Restauración:** al abrir el formulario, si hay borrador se aplica y se
   muestra `DraftBanner`: "Recuperamos un borrador sin guardar de hace X" +
   botón "Descartar borrador". El modal de Agenda se reabre solo.
4. **Indicador:** "Borrador guardado en este navegador" junto a los botones
   (formulario de cliente y notas).
5. **Se elimina el borrador al:** guardar con éxito, presionar "Cancelar",
   "Descartar borrador", cerrar sesión, o pasar 7 días (TTL).
6. **Conflicto (solo registros existentes):** el borrador guarda `base`, la
   versión del dato original (`updated_at` del cliente, o el texto de notas
   guardado). Si al volver no coincide, el borrador **no se aplica solo**: el
   banner ofrece "Restaurar borrador" o "Descartar". Mientras no se decida, no
   se sobrescribe el borrador.
   - Motivo: el formulario guarda `processes` completo; restaurar procesos
     viejos borraría pagos registrados después desde el detalle.
   - Al reasignar un cliente (agrega nota `[SISTEMA]`) el card de notas se
     remonta; un borrador de notas previo aparece como conflicto.

## Seguridad y privacidad
- **Nunca se guarda SSN/ITIN** (campo `ssn_itin` del cliente y de cada socio).
  Al restaurar sobre un cliente existente se toman del original (socios por
  índice, solo si coincide el nombre). El banner lo indica.
- Key por usuario: `pyxis:draft:{uid}:{formId}`; otro usuario en el mismo
  navegador no ve borradores ajenos.
- `clearUserDrafts(uid)` al cerrar sesión (navegadores compartidos en call
  center). Costo aceptado: cerrar sesión con un formulario a medias lo pierde.

## Diseño técnico
- `src/lib/formDraft.ts` — `draftKey`, `readDraft`, `writeDraft`, `removeDraft`,
  `clearUserDrafts`, `pruneExpiredDrafts`. Formato
  `{ v: 1, savedAt, base, data }`; versión o TTL inválidos ⇒ se borra.
  Serializa `Timestamp` (`{__ts}`) y `Date` (`{__date}`) para que procesos y
  pagos sobrevivan el JSON. Errores de storage (cuota, modo privado) se ignoran:
  el borrador es best-effort.
- `src/hooks/useFormDraft.ts` — `useFormDraft({ formId, value, initial, base })`
  → `{ read, clear, savedAt, dirty }`. `initial = null` pausa el guardado
  (cargando o conflicto pendiente). No restaura: cada formulario lee el
  borrador al inicializar con `useState` lazy (sin `setState` en effects).
- `src/components/shared/DraftBanner.tsx` — aviso con restaurar/descartar.
- `AuthContext` llama `pruneExpiredDrafts()` al montar y `clearUserDrafts()`
  en `signOut`.

### Cambios colaterales en `ClientForm`
- `ClientFormPage` carga el cliente y monta `ClientForm` con `key={id}`: el
  formulario se inicializa una sola vez. Antes, un refetch (foco de ventana
  tras 5 min, invalidaciones) reiniciaba lo que se estaba editando.
- "Editar" de un cliente inexistente muestra "Cliente no encontrado" en vez de
  quedarse en "Cargando…".
- Al editar ya no se envía `notes` (se gestionan en el detalle); antes pisaba
  notas agregadas mientras el formulario estaba abierto.

## Criterios de aceptación
- [x] Nuevo cliente: escribir nombre + teléfono, recargar ⇒ valores restaurados y banner visible.
- [x] SSN/ITIN escrito no aparece en `localStorage` ni tras recargar.
- [x] Escribir y recargar de inmediato (< 600 ms) ⇒ se restaura (flush en `pagehide`).
- [x] Escribir y luego borrar lo escrito ⇒ no queda borrador.
- [x] "Descartar borrador" ⇒ formulario vuelve al valor inicial y se borra la key.
- [x] Agenda: escribir notas en el modal, recargar ⇒ modal abierto con las notas.
- [x] `Timestamp` de procesos/pagos sobrevive el ciclo guardar/leer.
- [x] Cerrar sesión ⇒ no quedan keys `pyxis:draft:{uid}:*`.
- [ ] Editar cliente, registrar un pago desde otra pestaña, volver ⇒ banner de conflicto, no se aplica solo. *(requiere Firebase real; no probado)*
- [ ] Guardar con éxito ⇒ key eliminada. *(requiere Firebase real; no probado)*

## Pendientes / riesgos
- Dos pestañas editando el mismo formulario se pisan el borrador (gana la última escritura).
- El conflicto en notas compara contra las notas guardadas actuales, no contra las del inicio de la edición.
- El riesgo de fondo (escrituras de `processes` completo sin transacción) sigue abierto; el conflicto solo evita que el borrador lo agrave.
