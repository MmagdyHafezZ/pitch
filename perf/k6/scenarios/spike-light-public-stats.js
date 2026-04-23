import { sleep } from 'k6'
import { buildSpikeVusOptions, optionalNumberEnv } from '../lib/common.js'
import { resolveLightPublicStatsConfig, runLightPublicStatsRequest } from '../lib/workloads.js'

export const options = buildSpikeVusOptions({
  baselineVus: 20,
  spikeVus: 200,
  p95Ms: 4000,
  p99Ms: 12000,
  failureRate: 0.1,
})

const lightConfig = resolveLightPublicStatsConfig()
const thinkTimeSeconds = optionalNumberEnv('THINK_TIME_SEC', 0.2)

export default function () {
  runLightPublicStatsRequest(lightConfig, {
    scenario_name: 'spike-light-public-stats',
    workload_type: 'spike',
    experiment_family: 'spike',
  })
  sleep(thinkTimeSeconds)
}
