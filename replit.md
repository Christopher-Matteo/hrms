# Red Fox Hotel HRMS

A comprehensive Hotel Employee Management System (HRMS & Payroll) for Red Fox Hotel. Full-stack React + Vite frontend with Express 5 backend and PostgreSQL.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, path `/api`)
- `pnpm --filter @workspace/hotel-hrms run dev` — run the frontend (port 18896, path `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server exec tsx src/seed.ts` — run the seed script
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4, Wouter routing, shadcn/ui components, Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (16 tables)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/index.ts` — DB schema (source of truth, 16 tables)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (do not edit)
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/hotel-hrms/src/pages/` — all frontend pages
- `artifacts/hotel-hrms/src/index.css` — CSS variables + burgundy Red Fox brand theme

## Authentication

- SHA-256 + salt ("hrms_salt_2024"), in-memory Map sessions
- Token stored in localStorage, sent as `Authorization: Bearer <token>`
- `setAuthTokenGetter` called in `main.tsx` to wire token into all API calls
- Default logins:
  - admin@redfoxhotel.com / admin123 (super_admin)
  - hr@redfoxhotel.com / hr123 (hr_manager)
  - manager@redfoxhotel.com / manager123 (branch_manager)

## Product

Full-featured HRMS for Red Fox Hotel:
- **Multi-role auth** — super_admin, hr_manager, branch_manager, employee
- **Dashboard** — KPI cards, attendance trend chart, payroll trend chart, department pie chart, upcoming birthdays, recent activity
- **Employee management** — list, detail, create, edit with full profile (personal, employment, bank details)
- **Branches, Departments, Shifts, Weekly Off** — full CRUD
- **Attendance** — list + calendar view per employee, mark attendance with status/check-in/check-out
- **Leaves** — create, approve/reject, filter by status
- **Advances** — salary advance requests, approve/reject
- **Continue Duty** — track additional duty entries with amounts
- **Payroll** — generate monthly payroll, approve, view detailed payslips
- **Announcements** — create and publish company announcements
- **Reports** — attendance, payroll, and leave reports with branch/month filters
- **Settings** — company info, payroll config (OT rate, deductions), holidays management
- **Audit Logs** — full activity trail

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks
- All money values stored as `numeric()` in DB, converted with `Number()` for display
- Date columns use `date({ mode: "string" })` for string-based comparison
- Express 5 wildcard: `/{*splat}` syntax; route params need Array.isArray check
- Payroll generation calculates from attendance records: absent/late deductions, advance recovery, continue duty amounts, overtime
- Auth middleware checks `Authorization: Bearer <token>` header against in-memory session Map

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Always run `pnpm --filter @workspace/db run push` after changing DB schema
- `numeric()` columns from Drizzle return strings — always wrap with `Number()`
- Express 5: use `/{*splat}` for catch-all routes, not `/*`
- Do not run `pnpm dev` at workspace root — run individual artifact workflows instead

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
