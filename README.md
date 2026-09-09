# NEXUS

NEXUS is a foundation for a B2B CRM and workflow management platform.

## Architecture

```text
Frontend -> API -> Business Logic -> Database
                         ^
               Integrations / Workers
```

The frontend communicates only with the API. Business logic is kept behind service interfaces so future modules can be added without coupling UI code to persistence. Authentication, authorization, integrations, and workers have dedicated boundaries from the beginning.

## Workspace layout

```text
apps/
  api/                 Express API and composition root
  web/                 React application shell
packages/
  contracts/           Shared API contracts and types
  database/            Database client boundary and schema location
  auth/                Authentication boundary
  permissions/         Authorization and RBAC boundary
  services/            Business logic service boundaries
  integrations/        External system adapters
  workers/             Background job entry points
```

## Run locally

1. Copy `.env.example` to `.env` and adjust values for your environment.
2. Run `npm install`.
3. Run `npm run migrate --workspace @nexus/database`.
4. Run `npm run seed --workspace @nexus/database`.
5. Run `npm run dev`.
6. Open `http://localhost:5173`.

The API health endpoint is available at `http://localhost:4000/api/health`.

The current product surface includes:

- Task Templates administration with reusable task configuration, messaging, assignees, SLAs, completion conditions, validation, and deactivation.
- Tasks with persisted list/detail views, template-driven creation, assignment, due dates, required data, comments, status transitions, completion validation, and status history.
- Workflow Templates with ordered Task Template steps and configurable success/failure outcomes.
- Workflow Instances that can be started for an organization, create the current Task, advance transactionally when that Task completes or fails, create the next Task, and record workflow status history.
- Authentication with hashed internal-user passwords, bearer sessions, current-user lookup, logout, and protected Admin APIs.
- Role and permission foundations for `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `USER`, and `ORG_USER`, including organization scoping and administrative audit logs.
- An Admin area with live metrics, organization management, internal and organization-user views, role permissions, message templates, activity logs, settings foundation, and protected access to existing Task and Workflow administration.

Workflow Templates and Workflow Instances are available from the Workflows area. Admin features are available from the Admin area after signing in. Task Template and Workflow Template routes remain available through their existing product paths, with protected Admin aliases for administrative access.

### Local development accounts

The seed creates development-only accounts, all using the password `NexusDev123!`:

- `superadmin@nexus.local` - `SUPER_ADMIN`
- `admin@nexus.local` - `ADMIN`
- `manager@nexus.local` - `MANAGER`, scoped to Northstar Labs
- `user@nexus.local` - `USER`, scoped to Northstar Labs
- `orguser@nexus.local` - `ORG_USER`, scoped to Northstar Labs

These credentials are for local development only and must not be used in production.

Authentication and authorization are implemented across the authenticated business APIs and Admin API surface. Anonymous access is rejected for Tasks, Workflows, Task Templates, Workflow Templates, Organizations, and Users. External integrations, background workers, fine-grained authentication providers, and the remaining CRM screens are still future work.

The local PostgreSQL instance must accept the credentials in `DATABASE_URL` before migrations and seed data can run.