import { optionalEnv } from './common.js'

const DEFAULT_PERF_STATIC_AUTH_TOKEN = 'pitch-perf-static-token'

function resolveStaticAccessToken() {
  const accessToken = optionalEnv('PERF_STATIC_AUTH_TOKEN', DEFAULT_PERF_STATIC_AUTH_TOKEN)

  return {
    accessToken,
    source: 'static-dev-bypass-token',
  }
}

export function resolveUserAccessToken() {
  return resolveStaticAccessToken()
}

export function resolveSystemAdminAccessToken() {
  return resolveStaticAccessToken()
}
