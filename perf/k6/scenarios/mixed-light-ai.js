import { sleep } from 'k6'
import {
  buildRampingVusOptions,
  normalizeWeights,
  optionalNumberEnv,
  pickWeighted,
} from '../lib/common.js'
import { resolveUserAccessToken } from '../lib/auth.js'
import {
  resolveAiScenarioGenerateConfig,
  resolveLightPublicStatsConfig,
  runAiScenarioGenerateRequest,
  runLightPublicStatsRequest,
} from '../lib/workloads.js'

export const options = buildRampingVusOptions({
  vus: 10,
  p95Ms: 20000,
  p99Ms: 45000,
  failureRate: 0.05,
})

const lightConfig = resolveLightPublicStatsConfig()
const aiConfig = resolveAiScenarioGenerateConfig()
const mixWeights = normalizeWeights({
  light: optionalNumberEnv('LIGHT_WEIGHT', 0.7),
  ai: optionalNumberEnv('AI_WEIGHT', 0.3),
})
const thinkTimeSeconds = optionalNumberEnv('THINK_TIME_SEC', 0.5)

export function setup() {
  return resolveUserAccessToken()
}

export default function (authState) {
  const selected = pickWeighted(mixWeights)

  if (selected === 'light') {
    runLightPublicStatsRequest(lightConfig, {
      scenario_name: 'mixed-light-ai',
      workload_type: 'mixed',
      mix_component: 'light',
    })
  } else {
    runAiScenarioGenerateRequest(aiConfig, authState.accessToken, {
      scenario_name: 'mixed-light-ai',
      workload_type: 'mixed',
      mix_component: 'ai',
    })
  }

  sleep(thinkTimeSeconds)
}
