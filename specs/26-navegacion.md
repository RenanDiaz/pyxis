# 26 — Navegación por intención y barra inferior en móvil

**Prioridad:** 🟡 Media (fase 1) · 🟢 Baja (fase 2, en espera) · **Estado:** pendiente · **Tamaño:** S + M · **Depende de:** [25](25-consistencia-visual.md) (tokens, `<h1>`) · **Relacionado:** [27](27-busqueda-global.md)

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

## Datos de uso
Según la analítica del 2026-11-10 (30 días, 1 agente y 1 owner activos; ver `README.md`):
- **Estados es el módulo más usado**, por encima de Clientes: 115 vistas de la
  lista y 94 de fichas, contra 81 y 63 de Clientes. No es "referencia": es trabajo diario.
- **Oficios y Glosario: 0 vistas y 0 búsquedas.**
- **Inicio: 3 vistas del agente.** Agenda: 7.
- **Móvil: 12 vistas de 385 (3 %)**, la mitad del owner.

Consecuencias: Estados sube al grupo principal, Oficios y Glosario bajan, y la
barra inferior en móvil pasa a fase 2 en espera (hoy no la usaría nadie).

## Fase 1 — Requisitos
1. **Grupos del sidebar** (mismas rutas, solo cambia orden y agrupación):

   | Grupo | Ítems | Visible para |
   |---|---|---|
   | (sin título) | Inicio, Estados, Clientes, Agenda | todos |
   | Referencia | Oficios, Glosario | todos |
   | Gestión | Reportes | todos |
   | Gestión | Miembros, Subequipos, Configuración | `owner` |

   El grupo "Workspace" desaparece como título; sus ítems van bajo "Gestión".
## Fase 2 — Barra inferior en móvil (en espera)
No implementar hasta que el uso móvil lo justifique (ver pregunta 1).

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
### Fase 1
- [ ] El sidebar muestra los grupos y el orden de la tabla; un `agent` no ve Miembros, Subequipos ni Configuración.
- [ ] En móvil el menú hamburguesa sigue funcionando como hoy, con los grupos nuevos.
- [ ] `npm run build`, `npm run lint` y `npm test` pasan.

### Fase 2
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
1. **¿Cuándo se activa la fase 2?** Recomiendo: cuando móvil supere ~15 % de las
   vistas de agentes en 30 días, o cuando un workspace nuevo trabaje desde el
   teléfono. El cuarto destino ya está resuelto por los datos: Estados.
2. **Oficios y Glosario (0 vistas en 30 días):** ¿el agente no los necesita o no
   sabe que existen? Preguntarle antes de decidir. Recomiendo no quitarlos
   todavía: el spec 27 los expone en el buscador sin costo de navegación; si
   tras 60 días con el 27 siguen en cero, se retiran del sidebar.
3. **Reportes para `agent`:** hoy lo ven todos los roles. ¿Se mantiene?
