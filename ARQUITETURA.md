# Arquitetura e Stack — Barbearia SaaS

Plataforma multi-tenant de agendamento para barbearias.

## Stack

- **Backend**: NestJS 12 + TypeScript (ESM), Prisma 7 + PostgreSQL (Supabase, driver adapter `pg`), JWT (`@nestjs/jwt`/`passport-jwt`), Swagger em `/docs`.
- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS.
- **Hospedagem planejada**: backend no Render, banco no Supabase, frontend na Vercel.

## Estrutura

```
backend/   API NestJS (multi-tenant: Barbearia, Usuario, Servico, Cliente, Agendamento, Atendimento)
frontend/  App Next.js (painel da barbearia / agendamento do cliente)
```

### Módulos do backend

| Módulo | Responsabilidade |
|---|---|
| `auth` | Registro (cria barbearia + dono) e login, emite JWT com `barbeariaId` |
| `barbearia` | Dados do tenant logado |
| `servicos` | CRUD de serviços oferecidos |
| `clientes` | CRUD de clientes da barbearia |
| `agendamentos` | Criação/edição de agendamentos, com checagem de conflito de horário por profissional |
| `publico` | Endpoints sem autenticação para o cliente final agendar pela página pública (`/publico/:slug/...`) |
| `google` | OAuth com Google para ler planilhas do Google Sheets (escopo `spreadsheets.readonly`) |
| `importacoes` | Importa atendimentos históricos a partir de planilha |
| `atendimentos` | Registro histórico de atendimentos já realizados (vindos de importação) |

## Rodando localmente

### Backend

```bash
cd backend
cp .env.example .env        # ajuste DATABASE_URL (Supabase), JWT_SECRET, credenciais Google
npm install
npm run prisma:migrate      # cria as tabelas no Postgres (Supabase)
npm run start:dev           # http://localhost:3001/api, docs em /docs
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

## Modelo de dados (multi-tenant)

Cada `Barbearia` é um tenant. Todas as entidades (`Usuario`, `Servico`, `Cliente`, `Agendamento`, `Atendimento`) referenciam `barbeariaId`. O isolamento é aplicado na camada de serviço do backend a partir do `barbeariaId` presente no JWT (ou do `slug` público) — nenhuma query deve cruzar tenants.

## Próximos passos sugeridos

- Integração com Stripe para cobrança das assinaturas das barbearias (`planoStatus` já existe no schema).
- Notificações (lembrete de agendamento) via fila/cron.
- `render.yaml` para deploy automático do backend no Render.
