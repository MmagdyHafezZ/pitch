import { sleep } from 'k6'
import { buildRampingVusOptions, optionalEnv, optionalNumberEnv } from '../lib/common.js'
import { resolveLightPublicStatsConfig, runLightPublicStatsRequest } from '../lib/workloads.js'

export const options = buildRampingVusOptions({
  vus: 50,
  p95Ms: 2000,
  p99Ms: 5000,
  failureRate: 0.05,
})

const lightConfig = resolveLightPublicStatsConfig()
const cacheState = optionalEnv('CACHE_STATE', 'enabled')
const cacheLayer = optionalEnv('CACHE_LAYER', 'redis')
const thinkTimeSeconds = optionalNumberEnv('THINK_TIME_SEC', 1)

export default function () {
  runLightPublicStatsRequest(lightConfig, {
    scenario_name: 'cache-comparison-light-public-stats',
    workload_type: 'validation',
    validation_type: 'cache-comparison',
    cache_state: cacheState,
    cache_layer: cacheLayer,
  })
  sleep(thinkTimeSeconds)
}
