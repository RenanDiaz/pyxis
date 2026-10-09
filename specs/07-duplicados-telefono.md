# 07 — Detección de teléfonos duplicados

**Prioridad:** 🟡 Media · **Estado:** propuesto · **Depende de:** [01](01-seguridad-reglas.md)

## Problema
✔ `findClientsByPhone` (`src/lib/firestore.ts`) consulta `where('phone', '==', número crudo)`:
- Se guarda formateado (`+1 (xxx) xxx-xxxx`): solo coincide si el agente escribe exactamente ese formato.
- No busca en `phones[]` (teléfonos secundarios).
- La query no incluye el filtro de rol ⇒ para agente/supervisor Firestore la
  rechaza (las reglas no pueden probarse sobre el conjunto) y el error se traga.
  **Hoy solo funciona para owners, y casi nunca.**

## Requisitos
1. Campo denormalizado `phone_digits: string[]` (todos los teléfonos, solo dígitos, normalizados a 10 dígitos US) escrito en create/update.
2. Query `where('phone_digits', 'array-contains', normalizado)` + filtro de rol
   (owner sin filtro; supervisor `subteam_id`; agente `owner_uid`). Ver P1.
3. Script de backfill de `phone_digits`.
4. Detectar también en edición (excluyendo el propio cliente) y en teléfonos secundarios.
5. Errores de la query se loguean y no rompen el formulario.

## Criterios de aceptación
- [ ] Escribir `305-555-1234`, `3055551234` o `+1 (305) 555-1234` detecta al cliente existente.
- [ ] Un teléfono secundario de otro cliente también se detecta.
- [ ] Agente y supervisor reciben resultados (sin permission-denied).

## Preguntas abiertas
- **P1:** ¿Un agente debe enterarse de que el número ya es cliente **de otro agente**? Es lo más útil para evitar doble venta, pero las reglas de 01 no le dejan leerlo. Opciones: (a) solo su alcance; (b) colección `phone_index/{digits}` → `{ exists, owner_display_name }` legible por miembros, sin datos del cliente. *Recomendación:* (b).
