import http from 'k6/http'
import exec from 'k6/execution'
import { check } from 'k6'
import {
  csvEnv,
  jsonHeaders,
  normalizeBaseUrl,
  optionalEnv,
  optionalNumberEnv,
  recordSteadyState,
  requiredEnv,
} from './common.js'

const scenarioNameSeeds = [
  'Quarterly pipeline review',
  'Enterprise security review',
  'Renewal negotiation',
  'New logo discovery call',
]

const scenarioObjectives = [
  'uncover the buyer blockers and secure a concrete next step',
  'handle objections without losing timeline control',
  'diagnose risk and align on a decision process',
  'protect the deal while increasing stakeholder confidence',
]

const scenarioContexts = [
  'The buyer is interested but time-constrained and skeptical about implementation effort.',
  'A senior stakeholder joined late and wants stronger proof before approving the next phase.',
  'The customer sees value but procurement pressure is pushing the deal off schedule.',
  'The learner should focus on discovery, objection handling, and clear next-step control.',
]

function tagsWithDefaults(tags, defaults) {
  return {
    ...defaults,
    ...tags,
  }
}

function pickSeed(values, fallback) {
  if (!values.length) {
    return fallback
  }

  const index = exec.scenario.iterationInTest % values.length
  return values[index]
}

export function resolveLightPublicStatsConfig() {
  return {
    baseUrl: normalizeBaseUrl(optionalEnv('BASE_URL', 'http://localhost:8000')),
  }
}

export function runLightPublicStatsRequest(config, tags = {}) {
  const response = http.get(`${config.baseUrl}/api/v1/stats/public`, {
    headers: {
      Accept: 'application/json',
    },
    tags: tagsWithDefaults(tags, {
      endpoint: '/api/v1/stats/public',
    }),
  })

  check(response, {
    'light endpoint returned success': (r) => r.status === 200,
    'light endpoint returned activeUsers': (r) => r.json('activeUsers') !== undefined,
    'light endpoint returned activeSessions': (r) => r.json('activeSessions') !== undefined,
  })

  recordSteadyState(response)
  return response
}

export function resolveAiScenarioGenerateConfig() {
  return {
    baseUrl: normalizeBaseUrl(optionalEnv('BASE_URL', 'http://localhost:8000')),
    orgId: requiredEnv('SCENARIO_ORG_ID'),
    type: optionalEnv('SCENARIO_TYPE', 'text'),
    language: optionalEnv('SCENARIO_LANGUAGE', 'en-US'),
    durationMinutes: optionalNumberEnv('SCENARIO_DURATION_MINUTES', 30),
    difficulty: optionalNumberEnv('SCENARIO_DIFFICULTY', 6),
    tags: csvEnv('SCENARIO_TAGS', ['sales', 'onboarding']),
    count: optionalNumberEnv('SCENARIO_COUNT', 1),
    requestTimeout: optionalEnv('REQUEST_TIMEOUT', '45s'),
  }
}

export function runAiScenarioGenerateRequest(config, accessToken, tags = {}) {
  if (!accessToken) {
    throw new Error('An access token is required for scenario generation.')
  }

  const nameSeed = optionalEnv('SCENARIO_NAME_SEED', pickSeed(scenarioNameSeeds, 'Pipeline review'))
  const objective = optionalEnv(
    'SCENARIO_OBJECTIVE',
    pickSeed(scenarioObjectives, 'uncover the buyer blockers and secure a next step')
  )
  const context = optionalEnv(
    'SCENARIO_CONTEXT',
    pickSeed(
      scenarioContexts,
      'The learner should manage objections and keep control of the conversation.'
    )
  )
  const uniqueSuffix = `vu-${exec.vu.idInTest}-iter-${exec.scenario.iterationInTest}`
  const payload = {
    orgId: config.orgId,
    name: `${nameSeed} ${uniqueSuffix}`,
    type: config.type,
    tags: config.tags,
    language: config.language,
    sessionConfig: {
      difficulty: config.difficulty,
      durationMinutes: config.durationMinutes,
    },
    objective,
    context,
  }
  const isBatch = config.count > 1
  const endpoint = isBatch
    ? '/api/v1/simulation/scenarios/generate/batch'
    : '/api/v1/simulation/scenarios/generate'

  if (isBatch) {
    payload.count = config.count
  }

  const response = http.post(`${config.baseUrl}${endpoint}`, JSON.stringify(payload), {
    headers: jsonHeaders(accessToken),
    tags: tagsWithDefaults(tags, {
      endpoint,
    }),
    timeout: config.requestTimeout,
  })

  check(response, {
    'ai scenario endpoint returned success': (r) => r.status === 200 || r.status === 201,
    'ai scenario draft returned content': (r) =>
      isBatch ? Array.isArray(r.json('scenarios')) : !!r.json('draftId'),
  })

  recordSteadyState(response)
  return response
}

export function resolveAiLlmTestConfig() {
  return {
    simulationBaseUrl: normalizeBaseUrl(
      optionalEnv('SIMULATION_BASE_URL', 'http://localhost:3001')
    ),
    prompt: optionalEnv(
      'AI_PROMPT',
      'Explain in two paragraphs why tail latency matters in distributed systems.'
    ),
    requestTimeout: optionalEnv('REQUEST_TIMEOUT', '70s'),
  }
}

export function runAiLlmTestRequest(config, accessToken, tags = {}) {
  if (!accessToken) {
    throw new Error('A system-admin access token is required for llm/test.')
  }

  const response = http.post(
    `${config.simulationBaseUrl}/simulation/llm/test`,
    JSON.stringify({
      text: config.prompt,
    }),
    {
      headers: jsonHeaders(accessToken),
      tags: tagsWithDefaults(tags, {
        endpoint: '/simulation/llm/test',
      }),
      timeout: config.requestTimeout,
    }
  )

  check(response, {
    'ai endpoint returned success': (r) => r.status === 200,
    'ai endpoint returned response text': (r) => !!r.json('response'),
    'ai endpoint returned performance latency': (r) =>
      r.json('performance.latencyMs') !== undefined,
  })

  recordSteadyState(response)
  return response
}
