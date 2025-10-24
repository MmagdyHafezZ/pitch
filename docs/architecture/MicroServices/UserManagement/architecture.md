# User Management (Identity & Plans) Microservice

## A. Features & Functions

### 1. Identity & Authentication

- User registration (email/password, SSO later)
- Login & JWT issuance (access + refresh tokens)
- Session management & logout
- Password reset, email verification
- Multi-org memberships

### 2. Organizations & Roles

- Org creation & domain association
- Invite users, manage members
- Roles (Admin, Manager, Member)
- UserRole mappings (user ↔ org ↔ role)

### 3. Plansl & Subscriptions

- Define plans (name, quota, features JSON)
- Subscription lifecycle (active, trial, cancelled, expired)
- Quota updates on usage
- Integration with billing provider (Stripe/Railway Billing later)

### 4. Usage Tracking

- UsageRecord entries for events (simulation, call, upload, etc.)
- Quota enforcement (hard/soft limits)
- Event emission: `plan.changed`, `quota.updated`

---

## B. Controllers · Services · DTOs · DB Connections

### 1. Identity & Auth

**Controllers**

- `AuthController`
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/logout`
  - `POST /auth/refresh`
  - `POST /auth/reset-password`

**Services**

- `AuthService` (login/register, tokens, refresh)
- `PasswordService` (hashing, reset)
- `JwtService` (sign/verify tokens)
- `SessionService` (track active sessions)

**DTOs**

- `RegisterDto { email, password, name }`
- `LoginDto { email, password }`
- `ResetPasswordDto { token, newPassword }`
- `AuthResponseDto { accessToken, refreshToken, user }`

**DB**

- **Postgres**: User, Session

---

### 2. Organizations & Roles

**Controllers**

- `OrgController`
  - `POST /orgs` (create org)
  - `GET /orgs/:id`
  - `POST /orgs/:id/invite`
- `MemberController`
  - `GET /orgs/:id/members`
  - `POST /orgs/:id/members` (add member)
  - `PATCH /orgs/:id/members/:id` (update role)

**Services**

- `OrgService` (CRUD, domain mgmt)
- `MemberService` (user ↔ role mappings)
- `RoleService` (Admin, Manager, Member)

**DTOs**

- `CreateOrgDto { name, domain? }`
- `InviteMemberDto { email, role }`
- `MemberDto { userId, orgId, roleId }`

**DB**

- **Postgres**: Org, Role, UserRole

---

### 3. Plans & Subscriptions

**Controllers**

- `PlanController`
  - `GET /plans`
  - `POST /plans` (admin only)
- `SubscriptionController`
  - `POST /subscriptions` (start trial, assign plan)
  - `PATCH /subscriptions/:id` (upgrade/downgrade)
  - `DELETE /subscriptions/:id` (cancel)

**Services**

- `PlanService` (define/manage plans)
- `SubscriptionService` (lifecycle, status mgmt)
- `QuotaService` (enforce limits)

**DTOs**

- `PlanDto { id, name, quota: Json }`
- `CreateSubscriptionDto { orgId, planId }`
- `UpdateSubscriptionDto { planId, status }`

**DB**

- **Postgres**: Plan, Subscription

---

### 4. Usage Tracking

**Controllers**

- `QuotaController`
  - `GET /usage/:orgId`
  - `POST /usage` (record event)

**Services**

- `UsageService` (record usage, aggregate)
- `QuotaService` (enforce quotas)

**DTOs**

- `UsageRecordDto { orgId, eventType, count }`

**DB**

- **Postgres**: UsageRecord

---

## C. Events

- `user.created` (AuthService → published to RabbitMQ)
- `org.created` (OrgService → published to RabbitMQ)
- `plan.changed` (PlanService → published to RabbitMQ)
- `subscription.updated` (SubscriptionService → published to RabbitMQ)
- `quota.updated` (QuotaService → published to RabbitMQ)
