import { sleep } from 'k6'
import { buildRampingVusOptions, optionalNumberEnv } from '../lib/common.js'
import { resolveSystemAdminAccessToken } from '../lib/auth.js'
import { resolveAiLlmTestConfig, runAiLlmTestRequest } from '../lib/workloads.js'

export const options = buildRampingVusOptions({
  vus: 5,
  p95Ms: 30000,
  p99Ms: 60000,
  failureRate: 0.05,
})

const aiConfig = resolveAiLlmTestConfig()
const thinkTimeSeconds = optionalNumberEnv('THINK_TIME_SEC', 0.5)

export function setup() {
  return resolveSystemAdminAccessToken()
}

export default function (authState) {
  runAiLlmTestRequest(aiConfig, authState.accessToken, {
    scenario_name: 'ai-llm-test',
    workload_type: 'ai-intensive',
  })
  sleep(thinkTimeSeconds)
}
