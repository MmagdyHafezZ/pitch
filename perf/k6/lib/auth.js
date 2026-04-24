import { optionalEnv } from './common.js'

const DEFAULT_PERF_STATIC_AUTH_TOKEN = 'pitch-perf-static-token'

function resolveAccessToken(candidates, fallbackToken, fallbackSource) {
  for (const [envName, source] of candidates) {
    const accessToken = optionalEnv(envName, '')
    if (accessToken) {
      return {
        accessToken,
        source,
      }
    }
  }

  return {
    accessToken: fallbackToken,
    source: fallbackSource,
  }
}

export function resolveUserAccessToken() {
  return resolveAccessToken(
    [
      ['ACCESS_TOKEN', 'direct-access-token'],
      ['PERF_ACCESS_TOKEN', 'perf-access-token'],
      ['PERF_STATIC_AUTH_TOKEN', 'static-dev-bypass-token'],
    ],
    DEFAULT_PERF_STATIC_AUTH_TOKEN,
    'static-dev-bypass-token'
  )
}

export function resolveSystemAdminAccessToken() {
  return resolveAccessToken(
    [
      ['SYSTEM_ADMIN_ACCESS_TOKEN', 'system-admin-access-token'],
      ['ACCESS_TOKEN', 'direct-access-token'],
      ['PERF_ACCESS_TOKEN', 'perf-access-token'],
      ['PERF_STATIC_AUTH_TOKEN', 'static-dev-bypass-token'],
    ],
    DEFAULT_PERF_STATIC_AUTH_TOKEN,
    'static-dev-bypass-token'
  )
}
