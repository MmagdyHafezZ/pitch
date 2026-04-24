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
const targetService = optionalEnv('SCALING_TARGET_SERVICE', 'gateway')
const replicaCount = optionalEnv('REPLICA_COUNT', '1')
const thinkTimeSeconds = optionalNumberEnv('THINK_TIME_SEC', 1)

export default function () {
  runLightPublicStatsRequest(lightConfig, {
    scenario_name: 'replica-scaling-light-public-stats',
    workload_type: 'validation',
    validation_type: 'replica-scaling',
    scaling_target_service: targetService,
    replica_count: replicaCount,
  })
  sleep(thinkTimeSeconds)
}
