import { sleep } from 'k6'
import { buildRampingVusOptions, optionalNumberEnv } from '../lib/common.js'
import { resolveUserAccessToken } from '../lib/auth.js'
import { resolveAiScenarioGenerateConfig, runAiScenarioGenerateRequest } from '../lib/workloads.js'

export const options = buildRampingVusOptions({
  vus: 5,
  p95Ms: 30000,
  p99Ms: 60000,
  failureRate: 0.05,
})

const aiConfig = resolveAiScenarioGenerateConfig()
const thinkTimeSeconds = optionalNumberEnv('THINK_TIME_SEC', 0.5)

export function setup() {
  return resolveUserAccessToken()
}

export default function (authState) {
  runAiScenarioGenerateRequest(aiConfig, authState.accessToken, {
    scenario_name: 'ai-scenario-generate',
    workload_type: 'ai-intensive',
  })
  sleep(thinkTimeSeconds)
}
