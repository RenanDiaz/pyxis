# Specs — Pyxis

Specs de features y correcciones (SDD). Cada spec es autocontenido: problema,
alcance, requisitos, diseño propuesto, criterios de aceptación y preguntas
abiertas. Un agente debería poder implementar uno sin leer los demás, salvo
las dependencias indicadas.

## Origen
Los specs `01`–`13` salen de la auditoría del 2026-10-09 (rama
`claude/webapp-review-analysis-fayc4o`). Los hallazgos marcados **✔** se
verificaron leyendo el código; los demás vienen de una revisión automática y
**hay que confirmarlos antes de implementar** (las líneas pueden haberse movido).

## Índice y orden recomendado

| # | Spec | Prioridad | Depende de | Tamaño |
|---|------|-----------|------------|--------|
| 01 | [Reglas de seguridad Firestore/Storage](01-seguridad-reglas.md) | 🔴 Crítica · ✅ hotfix | — (se implementa junto con 02) | L |
| 02 | [Invitaciones y onboarding](02-invitaciones-onboarding.md) | 🔴 Crítica · 🟡 parcial | 01 | M |
| 03 | [Integridad de escrituras del cliente y dinero](03-integridad-cliente-pagos.md) | 🔴 Alta · ✅ | — | L |
| 04 | [Correcciones del reporte de ventas](04-reporte-ventas.md) | 🔴 Alta · ✅ | — | M |
| 05 | [Historial de status y métricas confiables](05-historial-status-metricas.md) | 🟠 Alta · ✅ | — | M |
| 06 | [Administración del workspace](06-administracion-workspace.md) | 🟠 Alta · ✅ | 01 | M |
| 07 | [Detección de teléfonos duplicados](07-duplicados-telefono.md) | 🟡 Media · ✅ | 01 | S |
| 08 | [Agenda](08-agenda.md) | 🟡 Media · ✅ | 05 (intentos de contacto) | M |
| 09 | [Manejo de errores y sesión](09-errores-sesion.md) | 🟡 Media · ✅ | — | M |
| 10 | [Rendimiento](10-rendimiento.md) | 🟡 Media · ✅ | — | M |
| 11 | [Metas por agente](11-metas.md) | 🟢 Media/Baja | 05 | M |
| 12 | [Infra: índices, scripts y migraciones](12-infra-scripts.md) | 🟡 Media · ✅ (desplegar índices) | — | S |
| 13 | [UX, accesibilidad y limpieza](13-ux-accesibilidad.md) | 🟢 Baja · ✅ salvo flashcards | — | M |
| 14 | [Aviso de nueva versión](14-aviso-nueva-version.md) | 🟠 Alta · ✅ | — | S |
| 15 | [Cotización](15-cotizacion.md) | 🟠 Alta · ✅ | — | M |
| 16 | [Estado de cuenta](16-estado-de-cuenta.md) | 🟠 Alta · ✅ | 15 | S |
| 17 | [Migración a Cloudflare y dominio propio](17-migracion-cloudflare.md) | 🔴 Alta · ✅ código, runbook en curso | — | M |
| 18 | [Links de pago con Stripe](18-links-de-pago-stripe.md) | 🟠 Alta | 17 (22 recomendado) | L |
| 19 | [Llamadas a leads (sin crear cliente)](19-leads-agenda.md) | 🟠 Alta · ✅ | 08 (Agenda); 07 opcional | M |
| 20 | [Notificaciones vencidas que nunca se borran (bug)](20-notificaciones-vencidas.md) | 🟠 Alta · ✅ | 08, 19 | S |
| 21 | [Avisos de llamadas (5 min antes y a la hora)](21-avisos-de-llamadas.md) | 🟠 Alta · ✅ fases 1 y 2 (setup pendiente) | 08; fase 2: 17 | M |
| 22 | [Cerrar la creación de workspaces](22-creacion-workspaces.md) | 🟠 Alta | — | S |
| 23 | [Procesos cancelados siguen sumando saldo (bug)](23-procesos-cancelados-saldo.md) | 🟠 Alta · ✅ | — (04 P3) | S |
| 24 | [Analítica de uso (qué se usa y qué no)](24-analytics-uso.md) | 🟡 Media · ✅ código, activar con el runbook | 17 | M |
| 25 | [Consistencia visual (base del rediseño)](25-consistencia-visual.md) | 🟠 Alta | — | M |
| 26 | [Navegación por intención y barra inferior en móvil](26-navegacion.md) | 🟡 Media (fase 2 en espera) | 25 | S + M |
| 27 | [Búsqueda global (Ctrl/⌘+K)](27-busqueda-global.md) | 🔴 Alta | 25 | M |
| 28 | [Clientes como lista de trabajo](28-clientes-lista-de-trabajo.md) | 🟡 Media (fase 2 en espera) | 25 | M + L |
| 29 | [Ficha del estado en panel lateral](29-ficha-estado-panel.md) | 🔴 Alta | 25 | M |
| — | [Borradores de formularios](form-drafts.md) | ✅ Implementado | — | — |

**Por qué este orden:** 01+02 cierran un hueco que permite tomar control de
cualquier workspace y leer SSN de clientes ajenos; se deben hacer juntos porque
el flujo actual de invitaciones *solo funciona gracias al hueco*. 03 y 04
afectan dinero (pagos que se pierden, TAX/NET mal calculados). 05 es base para
08 y 11.

**Rediseño (25–29):** mejoras de UX sin overhaul, propuestas el 2026-11-10.
Orden recomendado: **25 → 27 → 29 → 28 (fase 1) → 26 (fase 1)**. El 25 da los
tokens y componentes base; 27 y 29 atacan el flujo dominante (consultar estados
mientras se trabaja un cliente). Las fases 2 de 26 y 28 quedan en espera.

**Datos que respaldan ese orden** (PostHog, 30 días al 2026-11-10; 1 agente y
1 owner activos, así que describen el flujo de una persona, no una tendencia):

| Módulo | Vistas | Nota |
|---|---|---|
| Estados (lista + ficha) | 115 + 94 | 159 búsquedas, 40 estados distintos |
| Clientes (lista + detalle) | 81 + 63 | 15 búsquedas, 9 altas, 5 ediciones |
| Agenda | 7 | 7 llamadas agendadas, todas a leads |
| Inicio | 6 | 3 del agente |
| Reportes | 3 | 2 exportaciones |
| Oficios, Glosario | 0 | sin vistas ni búsquedas |

Móvil: 12 de 385 vistas (3 %). Sin uso en el periodo: cotización, estado de
cuenta y opt-in de avisos de llamadas.

## Convenciones
- Archivo: `NN-tema.md` (kebab-case, español).
- Criterios de aceptación como checklist `- [ ]`; se marcan al implementar.
- "Preguntas abiertas" bloquean la implementación de la parte afectada: no asumir.
- Al implementar: actualizar el estado del spec y, si cambia arquitectura, `CLAUDE.md`.
