# 11 — Metas por agente

**Prioridad:** 🟢 Media/Baja · **Estado:** propuesto · **Depende de:** [05](05-historial-status-metricas.md)

## Problema
- Las metas diarias hay que recrearlas cada día; `GoalModal` crea un doc nuevo cada vez y no precarga el valor actual.
- `useWorkspaceGoalsForPeriod` y la prop `targetName` existen pero no se usan: **falta la UI para que owner/supervisor asignen metas a sus agentes**.
- `useGoals`: `subteam_id` de la meta es el de quien la fija, no del agente (owner ⇒ `null`). Las reglas de `goals` dejan que un supervisor escriba metas de cualquiera del workspace.
- Owner/supervisor comparan métricas del equipo contra su meta personal (ver 05).

## Requisitos
1. Metas **recurrentes**: `{ agent_uid, type: 'daily'|'monthly', metric: 'closed'|'revenue'|'contacted', value, effective_from }`. La vigente es la última con `effective_from ≤ hoy`. Sin recrear cada día.
2. Doc ID determinístico por `agent_uid + type + metric` (upsert, no duplicados); historial opcional.
3. Pantalla "Metas del equipo" (owner: todos; supervisor: su subequipo) con tabla editable por agente y progreso actual.
4. `subteam_id` de la meta = el del agente. Reglas: supervisor solo para agentes de su subequipo.
5. Dashboard: agente ve su meta; owner/supervisor ven suma del equipo (o meta de equipo, ver P1).

## Criterios de aceptación
- [ ] El owner fija 5 cierres/mes para un agente; el agente lo ve en su dashboard sin hacer nada más.
- [ ] Cambiar la meta no crea un doc duplicado.
- [ ] Un supervisor no puede fijar metas a agentes de otro subequipo (test de reglas).

## Preguntas abiertas
- **P1:** ¿Meta de equipo propia o suma de metas individuales?
- **P2:** ¿Métricas: cierres, monto cobrado, contactos? ¿Cuáles usa hoy el negocio?
