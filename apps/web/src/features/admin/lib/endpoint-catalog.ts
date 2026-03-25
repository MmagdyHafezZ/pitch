export type AdminEndpointMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type AdminEndpointSpec = {
  id: string
  group: string
  method: AdminEndpointMethod
  path: string
  label: string
  pathParams: string[]
  defaultQuery?: Record<string, unknown>
  defaultBody?: Record<string, unknown>
  important?: boolean
}

const RAW_ENDPOINT_GROUPS: Array<{ group: string; lines: string }> = [
  {
    group: 'Health / access',
    lines: `
GET    /api/v1/health
GET    /api/v1/auth/me
GET    /api/v1/auth/validate
GET    /api/v1/simulation/sessions/health
GET    /api/v1/simulation/invitations/health
GET    /api/v1/simulation/llm/health
    `,
  },
  {
    group: 'Users / teams / billing',
    lines: `
GET    /api/v1/users
GET    /api/v1/users/:userId
POST   /api/v1/users
PUT    /api/v1/users/:userId
DELETE /api/v1/users/:userId
GET    /api/v1/teams
GET    /api/v1/teams/:teamId
POST   /api/v1/teams
PUT    /api/v1/teams/:teamId
DELETE /api/v1/teams/:teamId
POST   /api/v1/teams/:teamId/members
PUT    /api/v1/teams/:teamId/members/:userId
DELETE /api/v1/teams/:teamId/members/:userId
POST   /api/v1/teams/:teamId/invitations
GET    /api/v1/plans
GET    /api/v1/plans/:id
POST   /api/v1/plans
PUT    /api/v1/plans/:id
DELETE /api/v1/plans/:id
GET    /api/v1/subscriptions
GET    /api/v1/subscriptions/:id
GET    /api/v1/subscriptions/teams/:teamId
POST   /api/v1/subscriptions
PUT    /api/v1/subscriptions/:id
PUT    /api/v1/subscriptions/:id/upgrade
DELETE /api/v1/subscriptions/:id
    `,
  },
  {
    group: 'Sessions / simulation ops',
    lines: `
GET    /api/v1/simulation/sessions
GET    /api/v1/simulation/sessions/:id
GET    /api/v1/simulation/sessions/:id/timeline
POST   /api/v1/simulation/sessions
PUT    /api/v1/simulation/sessions/:id
POST   /api/v1/simulation/sessions/:id/end
POST   /api/v1/simulation/sessions/:id/restart
DELETE /api/v1/simulation/sessions/:id
GET    /api/v1/simulation/sessions/:id/members
POST   /api/v1/simulation/sessions/:id/members
DELETE /api/v1/simulation/sessions/:id/members/:userId
GET    /api/v1/simulation/sessions/:sessionId/invitations
POST   /api/v1/simulation/sessions/:sessionId/invitations
GET    /api/v1/simulation/invitations/:id
DELETE /api/v1/simulation/invitations/:id/revoke
GET    /api/v1/simulation/invitations/pending-count
GET    /api/v1/simulation/hints/history
POST   /api/v1/simulation/hints/generate
POST   /api/v1/simulation/assessments/run
GET    /api/v1/simulation/assessments/runs/:runId
GET    /api/v1/simulation/assessments/runs/:runId/report
GET    /api/v1/simulation/analytics/dashboard?userId=:userId
GET    /api/v1/simulation/sessions/:id/assessments/latest
POST   /api/v1/challenges/admin/generate
GET    /api/v1/challenges
    `,
  },
  {
    group: 'Developer tooling / content',
    lines: `
GET    /api/v1/simulation/personas
GET    /api/v1/simulation/personas/:id
POST   /api/v1/simulation/personas
GET    /api/v1/simulation/personas/:id/preview-audio
GET    /api/v1/simulation/scenarios
GET    /api/v1/simulation/scenarios/:id
POST   /api/v1/simulation/scenarios/generate
POST   /api/v1/simulation/scenarios/generate/batch
POST   /api/v1/simulation/llm/test
POST   /api/v1/simulation/llm/complete
GET    /api/v1/simulation/llm/providers
POST   /api/v1/rag/documents
GET    /api/v1/rag/documents
DELETE /api/v1/rag/documents/:refId
POST   /api/v1/rag/search
POST   /api/v1/tts/speak
POST   /api/v1/tts/stream
GET    /api/v1/tts/providers
GET    /api/v1/tts/voices
POST   /api/v1/simulation/phone-calls
POST   /api/v1/simulation/phone-calls/twilio
    `,
  },
  {
    group: 'Integrations / storage',
    lines: `
GET    /api/crm/salesforce/connect
GET    /api/crm/salesforce/status
GET    /api/crm/salesforce/contacts
GET    /api/crm/salesforce/accounts
GET    /api/crm/salesforce/opportunities
GET    /api/crm/salesforce/leads
POST   /api/crm/salesforce/query
POST   /api/crm/salesforce/search
DELETE /api/crm/salesforce/disconnect
GET    /api/v1/lti/platforms
GET    /api/v1/lti/platforms/credentials
GET    /api/v1/lti/platforms/:id
POST   /api/v1/lti/platforms
PATCH  /api/v1/lti/platforms/:id
DELETE /api/v1/lti/platforms/:id
GET    /api/v1/lti/platforms/:sessionId/session
PATCH  /api/v1/lti/platforms/:sessionId/session/link
POST   /api/v1/lti/advantage/deep-link
GET    /api/v1/lti/advantage/nrps/:sessionId
POST   /api/v1/lti/advantage/ags/lineitem
GET    /api/v1/lti/advantage/ags/:sessionId/lineitems
POST   /api/v1/lti/advantage/ags/score
POST   /api/v1/lti/advantage/ags/results
POST   /api/v1/s3/presigned/upload
POST   /api/v1/s3/presigned/download
POST   /api/v1/s3/presigned/delete
GET    /api/v1/s3/files
DELETE /api/v1/s3/prefix
    `,
  },
  {
    group: 'Extras',
    lines: `
GET    /api/v1/admin/overview
GET    /api/v1/admin/health/dependencies
GET    /api/v1/admin/version
GET    /api/v1/admin/runtime-config
GET    /api/v1/admin/log-levels
PATCH  /api/v1/admin/log-levels
GET    /api/v1/admin/users/:userId/activity
GET    /api/v1/admin/users/:userId/sessions
POST   /api/v1/admin/users/:userId/impersonate
GET    /api/v1/admin/teams/:teamId/usage
POST   /api/v1/admin/teams/:teamId/transfer-owner
DELETE /api/v1/admin/teams/:teamId/members/:userId
GET    /api/v1/admin/subscriptions/audit
DELETE /api/v1/admin/sessions/:id/members/:userId
GET    /api/v1/admin/sessions/:id/invitations
GET    /api/v1/admin/sessions/:id/assessments/latest
GET    /api/v1/admin/sessions/:id/events
GET    /api/v1/admin/sessions/:id/transcript
GET    /api/v1/admin/sessions/:id/llm-calls
POST   /api/v1/admin/sessions/:id/force-end
POST   /api/v1/admin/sessions/:id/recompute-assessment
POST   /api/v1/admin/sessions/:id/replay
GET    /api/v1/admin/assessments/runs
GET    /api/v1/admin/llm/requests
GET    /api/v1/admin/llm/usage
GET    /api/v1/admin/llm/routing
PATCH  /api/v1/admin/llm/routing
POST   /api/v1/admin/llm/routing/reload
GET    /api/v1/admin/phone-calls
GET    /api/v1/admin/phone-calls/:callId
GET    /api/v1/admin/phone-calls/:callId/events
POST   /api/v1/admin/phone-calls/:callId/redial
GET    /api/v1/admin/jobs
GET    /api/v1/admin/jobs/:jobId
POST   /api/v1/admin/jobs/:jobName/run
GET    /api/v1/admin/queues
POST   /api/v1/admin/queues/:queueName/retry-dead-letters
GET    /api/v1/admin/webhooks
GET    /api/v1/admin/webhooks/:provider/events
POST   /api/v1/admin/webhooks/:provider/events/:id/replay
GET    /api/v1/admin/audit-logs
GET    /api/v1/admin/logs
GET    /api/v1/admin/request-logs
POST   /api/v1/admin/cache/invalidate
POST   /api/v1/admin/data-fixes/:name/preview
POST   /api/v1/admin/data-fixes/:name/apply
    `,
  },
]

const IMPORTANT_ENDPOINTS = new Set([
  'GET /api/v1/admin/overview',
  'GET /api/v1/admin/health/dependencies',
  'GET /api/v1/admin/version',
  'GET /api/v1/admin/runtime-config',
  'GET /api/v1/users',
  'GET /api/v1/teams',
  'GET /api/v1/subscriptions',
  'GET /api/v1/simulation/sessions',
  'GET /api/v1/simulation/llm/providers',
  'GET /api/v1/tts/providers',
  'GET /api/crm/salesforce/status',
])

const ENDPOINT_DEFAULTS: Record<string, Partial<AdminEndpointSpec>> = {
  'GET /api/v1/admin/overview': { label: 'Platform overview' },
  'GET /api/v1/admin/health/dependencies': { label: 'Dependency health' },
  'GET /api/v1/admin/version': { label: 'Build + version' },
  'GET /api/v1/admin/runtime-config': { label: 'Runtime config' },
  'POST /api/v1/admin/cache/invalidate': {
    label: 'Invalidate cache',
    defaultBody: {
      pattern: 'admin:*',
    },
  },
  'PATCH /api/v1/admin/llm/routing': {
    label: 'Update LLM routing',
    defaultBody: {
      scope: 'global',
      name: 'default',
      isActive: true,
      config: {},
    },
  },
  'POST /api/v1/admin/llm/routing/reload': {
    label: 'Reload LLM routing',
    defaultBody: {},
  },
  'POST /api/v1/admin/jobs/:jobName/run': {
    label: 'Run job',
    defaultBody: {},
  },
  'POST /api/v1/admin/queues/:queueName/retry-dead-letters': {
    label: 'Retry dead letters',
    defaultBody: {
      maxMessages: 25,
    },
  },
  'POST /api/v1/admin/data-fixes/:name/preview': {
    label: 'Preview data fix',
    defaultBody: {},
  },
  'POST /api/v1/admin/data-fixes/:name/apply': {
    label: 'Apply data fix',
    defaultBody: {},
  },
}

const toTitle = (value: string) =>
  value
    .replace(/[:?]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const inferLabel = (path: string) => {
  const [pathOnly] = path.split('?')
  const cleaned = pathOnly
    .replace(/^\/api\/v\d+\//, '')
    .replace(/^\/api\//, '')
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.replace(/^:/, 'By '))
    .slice(-3)

  return cleaned.length > 0 ? cleaned.map(toTitle).join(' / ') : path
}

const parseDefaultQuery = (path: string) => {
  const [pathOnly, queryString] = path.split('?')
  if (!queryString) {
    return {
      pathOnly,
      defaultQuery: undefined,
    }
  }

  const params = new URLSearchParams(queryString)
  const defaultQuery = Object.fromEntries(params.entries())
  return {
    pathOnly,
    defaultQuery,
  }
}

const parsePathParams = (path: string) => {
  return Array.from(path.matchAll(/:([A-Za-z0-9_]+)/g)).map((match) => match[1])
}

export const ADMIN_ENDPOINTS: AdminEndpointSpec[] = RAW_ENDPOINT_GROUPS.flatMap(
  ({ group, lines }) => {
    return lines
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/)
        if (!match) {
          throw new Error(`Unable to parse admin endpoint line: ${line}`)
        }

        const method = match[1] as AdminEndpointMethod
        const rawPath = match[2].trim()
        const key = `${method} ${rawPath}`
        const { pathOnly, defaultQuery } = parseDefaultQuery(rawPath)
        const override = ENDPOINT_DEFAULTS[key] ?? {}

        return {
          id: key,
          group,
          method,
          path: pathOnly,
          label: override.label ?? inferLabel(rawPath),
          pathParams: parsePathParams(pathOnly),
          defaultQuery,
          defaultBody:
            override.defaultBody ?? (method === 'GET' || method === 'DELETE' ? undefined : {}),
          important: IMPORTANT_ENDPOINTS.has(key),
        }
      })
  }
)

export const ADMIN_ENDPOINT_GROUPS = Array.from(new Set(ADMIN_ENDPOINTS.map((item) => item.group)))
