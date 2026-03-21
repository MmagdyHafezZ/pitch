# Admin Page Implementation

## Overview

The admin section (`/admin`) was built from scratch across the backend API and
frontend web app. The work covered access control, a live service health panel
with Docker container status, a session-scoped API error log, and a full suite
of unit tests.

---

## 1. Admin Access Control

### Problem

Any authenticated user could navigate to `/admin`. There was no check to
restrict it to super-admins.

### Backend — `GET /admin/check`

**File:** `apps/api/src/gateway/controllers/admin/admin-gateway.controller.ts`

Created a new NestJS controller scoped to `@Controller('admin')`. Applied
`@UseGuards(CheckSystemAdmin)` at the class level. The guard reads the
`SUPER_ADMIN_EMAILS` environment variable (comma-separated) and compares it
against the decoded JWT `email` claim. If the email is not in the list it
returns 403 automatically. The endpoint itself simply returns
`{ isAdmin: true }` — any 2xx means the caller is an admin, any 403 means they
are not.

**File:** `apps/api/src/gateway/gateway.module.ts`

Registered `AdminGatewayController` in the `controllers` array so NestJS picks
it up at startup.

**File:** `apps/api/.env`

Added `SUPER_ADMIN_EMAILS=<your-email>` to seed the first super-admin. Multiple
emails are comma-separated:

```
SUPER_ADMIN_EMAILS=admin@example.com,other@example.com
```

### Frontend — Shared admin store

**File:** `apps/web/src/app/admin/stores/admin.store.ts`

Created a Zustand store with state
`{ isAdmin: null | true | false, checking: boolean }`. The `check()` action
calls `api.admin.check()` exactly once per session (guarded by an
`isAdmin !== null || checking` short-circuit). The result is cached for the
lifetime of the browser session.

### Frontend — Layout guard

**File:** `apps/web/src/app/admin/layout.tsx`

On mount the layout calls `check()` from `useAdminStore`. While
`checking === true` or `isAdmin === null` it renders a full-screen `<Loader>` so
child pages never flash. If `isAdmin === false` it calls
`router.replace('/studio/home')` and shows an "Access Denied" notification. Only
when `isAdmin === true` does it render the nav sidebar and page children.

### Frontend — Sidebar visibility

**File:** `apps/web/src/components/ui/AppSideBar.tsx`

The "Admin" nav link is wrapped in `{isAdmin === true && (...)}` — it is
completely absent from the DOM for non-admins, not just redirected. The sidebar
also calls `check()` in a `useEffect` so the store is hydrated as soon as the
user loads any page.

---

## 2. Dashboard Icon Centering Fix

**File:** `apps/web/src/app/admin/page.tsx`

The `RingProgress` `label` prop was wrapping `ThemeIcon` without a centering
container, causing icons to render off-center inside the ring segments. Fixed by
wrapping each `ThemeIcon` in Mantine's `<Center>` component inside the `label`
prop.

---

## 3. Live Service Health + Docker Container Status

### Backend — `GET /admin/health`

**File:** `apps/api/src/gateway/controllers/admin/admin-gateway.controller.ts`

Added a second endpoint to the admin controller. It does two things in parallel:

**Service health fan-out:** Uses `Promise.allSettled` to concurrently fetch four
internal health endpoints with a 3-second `AbortController` timeout each:

- `GET /api/v1/health` → Gateway API
- `GET /api/v1/simulation/sessions/health` → Simulation Sessions
- `GET /api/v1/simulation/invitations/health` → Simulation Invitations
- `GET /api/v1/simulation/llm/health` → LLM Service

Each resolves to `{ name, status: 'online'|'degraded'|'offline', latency }`. A
2xx response = `online`, a non-2xx = `degraded`, a thrown error (network
failure/timeout) = `offline`.

**Docker container listing:** Uses Node's built-in `http` module to call the
Docker Engine API via the Unix socket at `/var/run/docker.sock`. Sends
`GET /containers/json?all=1` to list all containers (running and stopped). Maps
each to `{ id, name, image, state, status }`. If the socket is unavailable
(permissions, not running) the error is caught silently and an empty array is
returned — the panel degrades gracefully.

Response shape:

```json
{
  "services": [
    { "name": "Gateway API", "status": "online", "latency": 12 },
    { "name": "Simulation Sessions", "status": "online", "latency": 34 },
    { "name": "Simulation Invitations", "status": "online", "latency": 28 },
    { "name": "LLM Service", "status": "online", "latency": 91 }
  ],
  "containers": [
    {
      "id": "abc123def456",
      "name": "pitch-api",
      "image": "node:20",
      "state": "running",
      "status": "Up 3 hours"
    }
  ]
}
```

### Fixing 401 on health endpoints

The internal `fetch` calls from the admin controller had no JWT token, so
`GlobalJwtAuthGuard` rejected them with 401.

**Two-part fix:**

1. **Auth whitelist** (`apps/api/src/gateway/config/auth-whitelist.config.ts`):
   Added the three simulation health paths to `AUTH_WHITELIST_ROUTES` so they
   bypass the global JWT guard at the whitelist level.

2. **Gateway controller route shadowing** (`session-gateway.controller.ts`,
   `invitation-gateway.controller.ts`): The real problem was that the gateway
   controllers' `@Get(':id')` and `@Get('invitations/:id')` routes were catching
   "health" as a parameter value before the health routes in the microservice
   controllers could fire. Added dedicated `@Get('health')` and
   `@Get('invitations/health')` handlers decorated with `@Public()` **before**
   the `/:id` handlers in each gateway controller. NestJS resolves literal
   routes before parameterised ones only when they are declared first in source
   order — so placement matters.

### Frontend — `ServiceStatusPanel` component

**File:** `apps/web/src/app/admin/components/ServiceStatusPanel.tsx`

Polls `GET /admin/health` every 30 seconds via `setInterval` (cleared on
unmount). Renders as a clickable `<Badge>` in the dashboard header. The badge
label and dot colour reflect overall status: "All Systems Online" (teal),
"Degraded" (yellow), "Offline" (red).

Clicking the badge opens a Mantine `<Popover>` with two sections:

- **API Services** — one row per service with a coloured icon (teal check /
  yellow triangle / red X), service name, status badge, and latency in ms.
- **Containers** — one row per Docker container with state-coloured icon,
  container name, image name, and status badge (Running / Exited / Paused /
  Restarting / Dead). A `X/Y running` summary is shown in the section header.
  The list is scrollable (max 180 px) for environments with many containers.
  Shows "Docker not available" if the containers array is empty.

A manual refresh icon sits inline on the badge. Auto-refresh timestamp is shown
at the bottom of the popover.

---

## 4. Session-Scoped API Error Log

### Error interceptor

**File:** `apps/web/src/lib/client.ts`

Added a module-level `apiErrorListener` callback slot and a
`setApiErrorListener(fn)` export. In the `apiRequest` error-handling path, when
`response.status >= 400` the listener is called with
`{ timestamp, method, endpoint, status, message }`. This avoids a circular
import — `client.ts` doesn't import from the store; it only calls whatever
function was registered.

### Error store

**File:** `apps/web/src/app/admin/stores/error-log.store.ts`

Zustand store holding `errors: ApiError[]` (max 200, oldest dropped on
overflow). Exports `initializeErrorInterceptor()` which calls
`setApiErrorListener` once and stores the guard flag in module scope so
re-renders don't double-register. The admin layout calls
`initializeErrorInterceptor()` on mount.

### Errors page

**File:** `apps/web/src/app/admin/errors/page.tsx`

A table page at `/admin/errors` showing: Timestamp | Method (coloured badge) |
Endpoint (monospace) | Status (coloured badge) | Message | Dismiss (×) button.
Features:

- Filter by HTTP method (GET / POST / PUT / PATCH / DELETE)
- Filter by status range (4xx / 5xx)
- "Clear All" button (disabled when list is empty)
- Empty state with icon when no errors have been recorded

---

## 5. Database Migration Fix

The simulation PostgreSQL database at `localhost:5434` had an empty migration
directory (`20260321022228_/`) left over from an aborted `prisma migrate dev`
run. This had been recorded as a failed migration in the `_prisma_migrations`
table, blocking all subsequent migrations.

Steps taken:

```bash
# 1. Mark the failed entry as rolled back in the migrations table
npx prisma migrate resolve --rolled-back 20260321022228_ \
  --schema=src/microservices/simulation/prisma/schema.prisma

# 2. Delete the empty directory
rm -rf apps/api/src/microservices/simulation/prisma/migrations/20260321022228_/

# 3. Apply all 14 real migrations cleanly
npx prisma migrate deploy \
  --schema=src/microservices/simulation/prisma/schema.prisma
```

This created the `public.Session` table and all other simulation schema tables
that had been missing.

---

## 6. Unit Tests (36 total, all passing)

### Backend — 8 tests

**File:**
`apps/api/src/gateway/controllers/admin/admin-gateway.controller.spec.ts`

Tests the controller directly (no `TestingModule`). Mocks `global.fetch` and
Node's `http` module with `jest.mock('http')`. Uses `EventEmitter`-based mock
request/response objects.

| Test                                     | What it verifies                                         |
| ---------------------------------------- | -------------------------------------------------------- |
| `check()` returns `{ isAdmin: true }`    | Basic endpoint contract                                  |
| All services online + containers         | Happy path — fetch 200, Docker socket returns containers |
| One service fetch throws                 | That service gets `status: 'offline'`                    |
| One service returns non-2xx              | That service gets `status: 'degraded'`                   |
| Docker socket errors                     | `containers` is `[]`, rest of response unaffected        |
| Leading `/` stripped from container name | `/pitch-api` → `pitch-api`                               |
| Container ID truncated to 12 chars       | `abcdef123456789012` → `abcdef123456`                    |
| Latency is a number                      | Each service entry has a numeric `latency` field         |

### Frontend — 28 tests across 7 files

All frontend tests use a `MantineProvider` + `Notifications` wrapper and
`jest.clearAllMocks()` in `beforeEach`. Loading states are tested by passing
`new Promise(() => {})` (never resolves) to API mocks so the component stays in
the loading branch.

**`components/__tests__/ServiceStatusPanel.test.tsx`**

- Shows loader before fetch resolves
- Shows "All Systems Online" badge when all services are online
- Shows "Degraded" when a service is offline
- Shows container name and "Running" badge for a running container
- Shows "Docker not available" when containers array is empty

**`__tests__/layout.test.tsx`**

- Shows loader while admin check is in-flight
- Renders children for verified admin user
- Redirects non-admin to `/studio/home`
- Renders "Errors" nav item for admin users
- Does not render children when user is not admin

**`__tests__/page.test.tsx`**

- Shows Mantine Skeleton elements while data is loading
- Renders stat card titles (Total Users, Teams, Sessions, Plans) after load

**`__tests__/users/page.test.tsx`**

- Shows skeletons while loading
- Renders user email addresses in the table after load
- Search input filters users by name/email

**`__tests__/teams/page.test.tsx`**

- Shows skeletons while loading
- Renders team names in the table after load

**`__tests__/plans/page.test.tsx`**

- Shows skeletons while loading
- Renders plan names in the table after load
- "Create Plan" button opens modal with "Plan Name" input field

**`__tests__/sessions/page.test.tsx`**

- Shows skeletons while loading
- Renders session names after load

**`__tests__/errors/page.test.tsx`**

- Shows empty state text when error store is empty
- Renders method, endpoint, status, and message for each error row
- "Clear All" button calls `clearErrors` on the store
- Dismiss (×) button calls `removeError` with the correct error ID
- Method filter hides non-matching errors (tested via store state)
- Status range filter hides non-matching errors (tested via store state)

---

## Files Changed

### Backend (`apps/api/`)

| File                                                                  | Change                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/gateway/controllers/admin/admin-gateway.controller.ts`           | **Created** — `GET /admin/check` and `GET /admin/health` with Docker socket          |
| `src/gateway/gateway.module.ts`                                       | Registered `AdminGatewayController`                                                  |
| `src/gateway/config/auth-whitelist.config.ts`                         | Added 3 simulation health paths to public whitelist                                  |
| `src/gateway/controllers/simulation/session-gateway.controller.ts`    | Added `@Get('health')` with `@Public()` before `@Get(':id')`                         |
| `src/gateway/controllers/simulation/invitation-gateway.controller.ts` | Added `@Get('invitations/health')` with `@Public()` before `@Get('invitations/:id')` |
| `src/gateway/controllers/admin/admin-gateway.controller.spec.ts`      | **Created** — 8 unit tests                                                           |
| `.env`                                                                | Added `SUPER_ADMIN_EMAILS`                                                           |

### Frontend (`apps/web/`)

| File                                                             | Change                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/lib/client.ts`                                              | Added error interceptor listener pattern + `api.admin` namespace      |
| `src/components/ui/AppSideBar.tsx`                               | Admin nav link hidden for non-admins via `useAdminStore`              |
| `src/app/admin/layout.tsx`                                       | Admin check on mount, full-screen loader, redirect, Errors nav item   |
| `src/app/admin/page.tsx`                                         | Icon centering fix, replaced static badge with `ServiceStatusPanel`   |
| `src/app/admin/stores/admin.store.ts`                            | **Created** — shared Zustand store for admin check                    |
| `src/app/admin/stores/error-log.store.ts`                        | **Created** — error log Zustand store + interceptor init              |
| `src/app/admin/components/ServiceStatusPanel.tsx`                | **Created** — live health panel with API services + Docker containers |
| `src/app/admin/errors/page.tsx`                                  | **Created** — session-scoped error log table page                     |
| `src/app/admin/__tests__/layout.test.tsx`                        | **Created** — 5 layout access control tests                           |
| `src/app/admin/__tests__/page.test.tsx`                          | **Created** — 2 dashboard tests                                       |
| `src/app/admin/__tests__/users/page.test.tsx`                    | **Created** — 3 users page tests                                      |
| `src/app/admin/__tests__/teams/page.test.tsx`                    | **Created** — 2 teams page tests                                      |
| `src/app/admin/__tests__/plans/page.test.tsx`                    | **Created** — 3 plans page tests                                      |
| `src/app/admin/__tests__/sessions/page.test.tsx`                 | **Created** — 2 sessions page tests                                   |
| `src/app/admin/__tests__/errors/page.test.tsx`                   | **Created** — 6 error log page tests                                  |
| `src/app/admin/components/__tests__/ServiceStatusPanel.test.tsx` | **Created** — 5 service status panel tests                            |
