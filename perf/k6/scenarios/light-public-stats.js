import { sleep } from 'k6'
import { buildRampingVusOptions, optionalNumberEnv } from '../lib/common.js'
import { resolveLightPublicStatsConfig, runLightPublicStatsRequest } from '../lib/workloads.js'

export const options = buildRampingVusOptions({
  vus: 10,
  p95Ms: 2000,
  p99Ms: 5000,
  failureRate: 0.05,
})

const lightConfig = resolveLightPublicStatsConfig()
const thinkTimeSeconds = optionalNumberEnv('THINK_TIME_SEC', 1)

export default function () {
  runLightPublicStatsRequest(lightConfig, {
    scenario_name: 'light-public-stats',
    workload_type: 'light',
  })
  sleep(thinkTimeSeconds)
}
