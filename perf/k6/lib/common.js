import exec from 'k6/execution'
import { Counter, Rate, Trend } from 'k6/metrics'

export const steadyHttpReqDuration = new Trend('steady_http_req_duration', true)
export const steadyHttpReqFailed = new Rate('steady_http_req_failed')
export const steadyHttpReqs = new Counter('steady_http_reqs')

function parseDurationMs(raw) {
  const value = String(raw || '').trim()
  const match = value.match(/^(\d+)(ms|s|m|h)$/)

  if (!match) {
    throw new Error(`Unsupported duration "${value}". Use one of: 500ms, 30s, 5m, 1h.`)
  }

  const amount = Number(match[1])
  const unit = match[2]

  if (unit === 'ms') {
    return amount
  }

  if (unit === 's') {
    return amount * 1000
  }

  if (unit === 'm') {
    return amount * 60 * 1000
  }

  return amount * 60 * 60 * 1000
}

function buildThresholds({ p95Ms, p99Ms, failureRate, includeSteadyThresholds = false }) {
  const thresholds = {
    http_req_failed: [`rate<${failureRate}`],
    http_req_duration: [`p(95)<${p95Ms}`, `p(99)<${p99Ms}`],
  }

  if (includeSteadyThresholds) {
    thresholds.steady_http_req_failed = [`rate<${failureRate}`]
    thresholds.steady_http_req_duration = [`p(95)<${p95Ms}`, `p(99)<${p99Ms}`]
  }

  return thresholds
}

export function requiredEnv(name) {
  const value = __ENV[name]
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`)
  }
  return value
}

export function optionalEnv(name, fallback) {
  const value = __ENV[name]
  return value === undefined || value === '' ? fallback : value
}

export function optionalNumberEnv(name, fallback) {
  const value = __ENV[name]
  if (value === undefined || value === '') {
    return fallback
  }

  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    throw new Error(`Environment variable ${name} must be numeric`)
  }

  return numeric
}

export function normalizeBaseUrl(rawUrl) {
  return String(rawUrl || '').replace(/\/+$/, '')
}

export function csvEnv(name, fallback = []) {
  const raw = __ENV[name]
  if (!raw) {
    return fallback
  }

  return String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeWeights(weightMap) {
  const entries = Object.entries(weightMap).map(([key, value]) => [key, Number(value)])
  const total = entries.reduce((sum, [, value]) => sum + value, 0)

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('At least one workload weight must be greater than zero.')
  }

  const normalized = {}
  for (const [key, value] of entries) {
    normalized[key] = value / total
  }

  return normalized
}

export function pickWeighted(weightMap) {
  const normalized = normalizeWeights(weightMap)
  const roll = Math.random()
  let cursor = 0

  for (const [key, value] of Object.entries(normalized)) {
    cursor += value
    if (roll <= cursor) {
      return key
    }
  }

  return Object.keys(normalized)[Object.keys(normalized).length - 1]
}

export function scenarioPhase() {
  const warmupDuration = optionalEnv('WARMUP_DURATION', '2m')
  const steadyDuration = optionalEnv('STEADY_DURATION', '5m')
  const elapsedMs = Date.now() - exec.scenario.startTime
  const warmupMs = parseDurationMs(warmupDuration)
  const steadyMs = parseDurationMs(steadyDuration)

  if (elapsedMs < warmupMs) {
    return 'warmup'
  }

  if (elapsedMs < warmupMs + steadyMs) {
    return 'steady'
  }

  return 'cooldown'
}

export function recordSteadyState(response) {
  if (scenarioPhase() !== 'steady') {
    return
  }

  steadyHttpReqDuration.add(response.timings.duration)
  steadyHttpReqFailed.add(response.status >= 400)
  steadyHttpReqs.add(1)
}

export function buildStageVusOptions({
  stages,
  p95Ms = 2000,
  p99Ms = 5000,
  failureRate = 0.05,
  startVUs = 0,
  includeSteadyThresholds = false,
}) {
  return {
    scenarios: {
      workload: {
        executor: 'ramping-vus',
        startVUs,
        stages,
        gracefulRampDown: optionalEnv('GRACEFUL_RAMP_DOWN', '30s'),
      },
    },
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
    thresholds: buildThresholds({
      p95Ms,
      p99Ms,
      failureRate,
      includeSteadyThresholds,
    }),
  }
}

export function buildRampingVusOptions({
  vus = 10,
  p95Ms = 2000,
  p99Ms = 5000,
  failureRate = 0.05,
}) {
  const targetVus = optionalNumberEnv('VUS', vus)
  const warmupDuration = optionalEnv('WARMUP_DURATION', '2m')
  const steadyDuration = optionalEnv('STEADY_DURATION', '5m')
  const cooldownDuration = optionalEnv('COOLDOWN_DURATION', '1m')

  return buildStageVusOptions({
    p95Ms,
    p99Ms,
    failureRate,
    includeSteadyThresholds: true,
    stages: [
      { duration: warmupDuration, target: targetVus },
      { duration: steadyDuration, target: targetVus },
      { duration: cooldownDuration, target: 0 },
    ],
  })
}

export function buildSpikeVusOptions({
  baselineVus = 20,
  spikeVus = 200,
  p95Ms = 4000,
  p99Ms = 12000,
  failureRate = 0.1,
}) {
  const baseline = optionalNumberEnv('BASELINE_VUS', baselineVus)
  const spike = optionalNumberEnv('SPIKE_VUS', spikeVus)

  return buildStageVusOptions({
    p95Ms,
    p99Ms,
    failureRate,
    stages: [
      { duration: optionalEnv('WARMUP_DURATION', '1m'), target: baseline },
      {
        duration: optionalEnv('BASELINE_HOLD_DURATION', '1m'),
        target: baseline,
      },
      { duration: optionalEnv('SPIKE_RAMP_DURATION', '10s'), target: spike },
      { duration: optionalEnv('SPIKE_HOLD_DURATION', '30s'), target: spike },
      {
        duration: optionalEnv('RECOVERY_RAMP_DURATION', '10s'),
        target: baseline,
      },
      {
        duration: optionalEnv('RECOVERY_HOLD_DURATION', '1m'),
        target: baseline,
      },
      { duration: optionalEnv('COOLDOWN_DURATION', '30s'), target: 0 },
    ],
  })
}

export function buildStressVusOptions({
  startVus = 10,
  stepVus = 50,
  maxVus = 500,
  p95Ms = 10000,
  p99Ms = 30000,
  failureRate = 0.2,
}) {
  const start = optionalNumberEnv('START_VUS', startVus)
  const step = optionalNumberEnv('STEP_VUS', stepVus)
  const max = optionalNumberEnv('MAX_VUS', maxVus)

  if (step <= 0) {
    throw new Error('STEP_VUS must be greater than zero.')
  }

  if (max < start) {
    throw new Error('MAX_VUS must be greater than or equal to START_VUS.')
  }

  const stages = [{ duration: optionalEnv('INITIAL_RAMP_DURATION', '30s'), target: start }]

  for (let target = start + step; target <= max; target += step) {
    stages.push({
      duration: optionalEnv('STEP_DURATION', '2m'),
      target,
    })
  }

  stages.push({
    duration: optionalEnv('FINAL_HOLD_DURATION', '1m'),
    target: max,
  })
  stages.push({
    duration: optionalEnv('COOLDOWN_DURATION', '1m'),
    target: 0,
  })

  return buildStageVusOptions({
    p95Ms,
    p99Ms,
    failureRate,
    stages,
  })
}

export function jsonHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}
