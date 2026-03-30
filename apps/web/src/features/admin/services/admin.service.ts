'use client'

import { API_CONFIG, getAccessToken, refreshAccessToken } from '@/lib/client'

export type ApiConsoleBodyType = 'json' | 'text' | 'binary' | 'empty'

export type ApiConsoleResponse<T = unknown> = {
  ok: boolean
  status: number
  url: string
  bodyType: ApiConsoleBodyType
  body: T
  headers: Record<string, string>
  durationMs: number
}

const VERSIONED_PATH_PATTERN = /\/api\/v\d+$/
const ROOT_PATH_PATTERN = /\/api$/

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const getVersionedBaseUrl = () => {
  const base = trimTrailingSlash(API_CONFIG.baseURL)

  if (VERSIONED_PATH_PATTERN.test(base)) {
    return base
  }

  if (ROOT_PATH_PATTERN.test(base)) {
    return `${base}/v1`
  }

  return `${base}/api/v1`
}

const getRootBaseUrl = () => getVersionedBaseUrl().replace(/\/v\d+$/, '')

const resolveAbsoluteUrl = (path: string) => {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  if (path.startsWith('/api/v1/')) {
    return `${getVersionedBaseUrl()}${path.replace(/^\/api\/v\d+/, '')}`
  }

  if (path.startsWith('/api/')) {
    return `${getRootBaseUrl()}${path.replace(/^\/api/, '')}`
  }

  if (path.startsWith('/')) {
    return `${getVersionedBaseUrl()}${path}`
  }

  return `${getVersionedBaseUrl()}/${path}`
}

const toHeadersObject = (headers: Headers) => {
  return Object.fromEntries(Array.from(headers.entries()))
}

const parseResponseBody = async (response: Response) => {
  if (response.status === 204) {
    return {
      bodyType: 'empty' as const,
      body: null,
    }
  }

  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return {
      bodyType: 'json' as const,
      body: await response.json(),
    }
  }

  if (
    contentType.startsWith('audio/') ||
    contentType.includes('application/octet-stream') ||
    contentType.includes('application/pdf')
  ) {
    const blob = await response.blob()
    return {
      bodyType: 'binary' as const,
      body: {
        size: blob.size,
        contentType,
        disposition: response.headers.get('content-disposition'),
      },
    }
  }

  const text = await response.text()
  return {
    bodyType: text.length > 0 ? ('text' as const) : ('empty' as const),
    body: text.length > 0 ? text : null,
  }
}

const buildRequestInit = (options: RequestInit, token: string | null): RequestInit => {
  const headers = new Headers(options.headers)

  if (!headers.has('Content-Type') && !(options.body instanceof FormData) && options.body != null) {
    headers.set('Content-Type', 'application/json')
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return {
    credentials: 'include',
    ...options,
    headers,
  }
}

export async function requestApiPath<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<ApiConsoleResponse<T>> {
  const url = resolveAbsoluteUrl(path)
  const startedAt = performance.now()
  let didRefresh = false

  const perform = async (tokenOverride: string | null) => {
    const response = await fetch(url, buildRequestInit(options, tokenOverride))
    const parsed = await parseResponseBody(response)

    if (!response.ok) {
      const message =
        typeof parsed.body === 'string'
          ? parsed.body
          : typeof (parsed.body as { message?: unknown })?.message === 'string'
            ? String((parsed.body as { message: string }).message)
            : `HTTP ${response.status}: ${response.statusText}`

      const error = new Error(message) as Error & {
        status?: number
        responseBody?: unknown
      }
      error.status = response.status
      error.responseBody = parsed.body
      throw error
    }

    return {
      ok: response.ok,
      status: response.status,
      url,
      bodyType: parsed.bodyType,
      body: parsed.body as T,
      headers: toHeadersObject(response.headers),
      durationMs: Math.round(performance.now() - startedAt),
    }
  }

  try {
    return await perform(getAccessToken())
  } catch (error) {
    const status = (error as { status?: number })?.status

    if (status === 401 && !didRefresh) {
      didRefresh = true
      const refreshedToken = await refreshAccessToken()
      if (refreshedToken) {
        return perform(refreshedToken)
      }
    }

    throw error
  }
}

export async function requestJsonPath<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await requestApiPath<T>(path, options)
  if (response.bodyType !== 'json') {
    throw new Error(`Expected JSON response from ${path}`)
  }
  return response.body
}

export const adminApi = {
  getMe: () =>
    requestJsonPath<{
      id: string
      email: string
      name?: string
      isSystemAdmin: boolean
    }>('/api/v1/admin/me'),
}
