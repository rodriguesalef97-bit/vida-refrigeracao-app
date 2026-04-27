# Vida Refrigeração — Sistema de Gestão de Ordens de Serviço (PWA)

PWA em português para uma empresa brasileira de refrigeração/HVAC. Inclui login, OS, clientes, equipe, agenda, permissões matriciais, notificações push e um sistema completo de produtividade por técnico.

## Stack
- pnpm monorepo
- Backend: Express + Drizzle (PostgreSQL via DATABASE_URL)
- Frontend: React + Vite + Wouter + TanStack Query + Recharts + shadcn/ui
- Geração de cliente API: Orval (OpenAPI → React Query hooks + Zod)

## Pacotes-chave
- `lib/db` — schema Drizzle e re-exports (`export * from "./schema"`)
- `lib/api-spec` — `openapi.yaml` + script `codegen`
- `lib/api-client-react` — hooks gerados (não editar manualmente)
- `artifacts/api-server` — Express, sessão, push scheduler
- `artifacts/vida-refrigeracao` — PWA web

## Convenções obrigatórias
- **Imports estáticos apenas**. Nunca usar `React.lazy()` (causou erros de dyn import no passado).
- **Sub-routers**: usar `requireArea("...","view"|"edit"|"admin")` por rota; NÃO `router.use(requireAuth)` em sibling.
- **db push**: `pnpm --filter @workspace/db run push --force`
- **codegen** após alteração de OpenAPI: `pnpm --filter @workspace/api-spec run codegen`

## Modelo OS
Tabela `service_orders` (campos atuais relevantes):
- Identificação/cliente: `orderNumber`, `clientName`, `clientPhone`, `clientAddress`
- Serviço: `serviceType` (installation/maintenance/repair/cleaning/inspection), `equipmentCapacity`
- Técnicos: `technicians` (jsonb array, preferido) + `technician` (texto legado)
- Agenda: `scheduledDate`, `startTime`, `endTime`, `reminderEnabled`, `reminderMinutes`
- Execução real (cronômetro): `serviceStartedAt`, `serviceCompletedAt`
- Financeiro: `serviceValue` (numeric 12,2)
- Conclusão: `observations`, `checklist` (jsonb), `photos` (jsonb), `technicianSignature`, `clientSignature`, `status`

## Sistema de Produtividade
- Pontos por tipo (constante `SERVICE_POINTS` em `lib/db/src/schema/serviceOrders.ts`):
  cleaning=2, maintenance=3, installation=8, repair=3, inspection=2
- **POST /api/service-orders/:id/start** — registra `serviceStartedAt`, muda status para in_progress
- **POST /api/service-orders/:id/finish** — valida foto+observações+checklist+assinatura+`serviceStartedAt`, registra `serviceCompletedAt` e marca `completed`
- **GET /api/productivity?from=&to=** — agrega por técnico (rateio proporcional quando há múltiplos: divide horas/pontos/faturamento por N)
- **GET /api/productivity/export** — CSV UTF-8 com BOM, separador `;`, vírgula decimal (Excel pt-BR)
- Rota frontend: `/produtividade` (área `reports`, level `view`)

## Validação de conclusão de OS
Tanto via `PUT status=completed` quanto via `POST /finish`, exige:
foto + observações + checklist 100% marcado + assinatura do técnico + serviceStartedAt.

## Test users
- admin / admin123
- mariana / mar123

## Curl rápido
- `https://$REPLIT_DEV_DOMAIN/api/...` (envia cookie de sessão)
