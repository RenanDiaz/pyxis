# 26 — Navegación por intención y barra inferior en móvil

**Prioridad:** 🟠 Alta · **Estado:** pendiente · **Tamaño:** S/M · **Depende de:** [25](25-consistencia-visual.md) (tokens, `<h1>`) · **Relacionado:** [27](27-busqueda-global.md)

## Problema
El sidebar lista siete ítems planos en este orden: Inicio, Estados, Oficios,
Glosario, Clientes, Agenda, Reportes. Mezcla el trabajo diario (Clientes,
Agenda) con material de consulta, y deja el trabajo diario en quinto y sexto
lugar. En móvil toda la navegación está detrás del menú hamburguesa: cambiar
de Clientes a Agenda cuesta dos toques y abrir un panel.

## Diagnóstico (verificado en el código, 2026-11-10)
- `Sidebar.tsx`: `agentNavItems` (7 ítems sin grupo) y `workspaceNavItems`
  (solo `owner`, con título "Workspace").
- `AppLayout.tsx`: sidebar fijo en `lg+`; debajo de `lg` solo existe el `Sheet`
  que abre el botón de `Header`.
- `Header.tsx`: en desktop es una barra con campana, tema y avatar; el resto
  está vacío.
- Elementos fijos abajo que pueden chocar con una barra inferior:
  `UpdateBanner` (`fixed bottom-4`) y los toasts de `sonner`.

## Requisitos
1. **Grupos del sidebar** (mismas rutas, solo cambia orden y agrupación):

   | Grupo | Ítems | Visible para |
   |---|---|---|
   | (sin título) | Inicio, Clientes, Agenda | todos |
   | Referencia | Estados, Oficios, Glosario | todos |
   | Gestión | Reportes | todos |
   | Gestión | Miembros, Subequipos, Configuración | `owner` |

   El grupo "Workspace" desaparece como título; sus ítems van bajo "Gestión".
2. **Barra inferior en móvil** (`< lg`), componente `BottomNav` en
   `components/layout/`:
   - 5 destinos: Inicio, Clientes, Agenda, Estados, **Más**.
   - "Más" abre el `Sheet` actual con el sidebar completo. El botón hamburguesa
     del `Header` se elimina en móvil.
   - `fixed` abajo, con `padding-bottom: env(safe-area-inset-bottom)`; `<main>`
     reserva ese alto para que el último elemento no quede tapado.
   - Ítem activo con `aria-current="page"`; cada destino con ícono + etiqueta
     visible (no solo ícono); área táctil ≥ 44 px.
   - Una ruta hija marca a su padre (`/clientes/:id` → Clientes;
     `/estados/:abbreviation` → Estados). Rutas fuera de los 4 destinos
     (Oficios, Glosario, Reportes, Workspace) marcan "Más".
3. **Convivencia con elementos fijos:** `UpdateBanner` y los toasts se muestran
   por encima de la barra (no detrás ni tapándola).
4. **Teclado virtual:** con un input enfocado en móvil la barra no debe quedar
   flotando sobre el teclado ni tapar el campo. Verificar en iOS Safari y en la
   PWA instalada (existe web app manifest).
5. **Layout:** se mantienen las reglas de `CLAUDE.md` (scroll nativo del
   documento, sin `overflow`/`height: 100%` en `html/body/#root`, unidades `dvh`).
6. **Analítica:** sin eventos nuevos. Las rutas no cambian, así que los
   `$pageview` siguen siendo comparables antes y después.

## Fuera de alcance
Cambiar rutas, fusionar Oficios y Glosario en una sola página (ver pregunta 2),
sidebar colapsable en desktop, breadcrumbs.

## Criterios de aceptación
- [ ] El sidebar muestra los grupos y el orden de la tabla; un `agent` no ve Miembros, Subequipos ni Configuración.
- [ ] En 375 px hay barra inferior con 5 destinos y no hay botón hamburguesa.
- [ ] Desde Clientes se llega a Agenda con un solo toque.
- [ ] En `/clientes/abc` el destino activo es Clientes; en `/glosario` es Más.
- [ ] "Más" abre el panel con todos los ítems y se cierra al navegar.
- [ ] En iPhone con home indicator la barra respeta el área segura.
- [ ] El último elemento de cada página se puede leer y tocar completo (no queda bajo la barra).
- [ ] El aviso de nueva versión y un toast se ven completos con la barra presente.
- [ ] En `ClientForm` en móvil, con un input enfocado, la barra no tapa el campo ni el botón Guardar.
- [ ] En `lg+` no existe la barra inferior y el sidebar se comporta como hoy.
- [ ] Navegable con teclado y lector de pantalla (`<nav aria-label>`, `aria-current`).
- [ ] `npm run build`, `npm run lint` y `npm test` pasan.

## Preguntas abiertas
1. **Cuarto destino de la barra:** recomiendo Estados (es "la más importante"
   según `CLAUDE.md`). Confirmar con `$pageview` por `route_pattern` en móvil
   (spec 24): si Estados casi no se abre desde el teléfono, ese lugar es de Reportes.
2. **Oficios y Glosario:** si la analítica muestra uso marginal, ¿se fusionan en
   una sola página "Referencia" con pestañas? Recomiendo decidirlo después de
   tener el spec 27 en producción: la búsqueda global puede volverlos casi
   innecesarios como destino de navegación.
3. **Reportes para `agent`:** hoy lo ven todos los roles. ¿Se mantiene?
