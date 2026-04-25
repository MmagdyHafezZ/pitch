import { sleep } from 'k6'
import { buildStressVusOptions, optionalNumberEnv } from '../lib/common.js'
import { resolveLightPublicStatsConfig, runLightPublicStatsRequest } from '../lib/workloads.js'

export const options = buildStressVusOptions({
  startVus: 10,
  stepVus: 50,
  maxVus: 500,
  p95Ms: 10000,
  p99Ms: 30000,
  failureRate: 0.2,
})

const lightConfig = resolveLightPublicStatsConfig()
const thinkTimeSeconds = optionalNumberEnv('THINK_TIME_SEC', 0.1)

export default function () {
  runLightPublicStatsRequest(lightConfig, {
    scenario_name: 'stress-light-public-stats',
    workload_type: 'stress',
    experiment_family: 'stress',
  })
  sleep(thinkTimeSeconds)
}
