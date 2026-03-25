import { http, HttpResponse } from 'msw'
import { server } from '../../__tests__/mocks/server'
import {
  API_CONFIG,
  queryClient,
  setAccessToken,
  getAccessToken,
  setAccessTokenListener,
  refreshAccessToken,
  apiRequest,
  apiRequestRoot,
  api,
} from '../client'

const API_BASE_URL = API_CONFIG.baseURL
const API_ROOT_URL = API_BASE_URL.replace(/\/v\d+$/, '')

beforeEach(() => {
  setAccessToken(null)
  setAccessTokenListener(null)
})

describe('API_CONFIG', () => {
  it('has a default baseURL', () => {
    expect(API_CONFIG.baseURL).toBeDefined()
    expect(API_CONFIG.timeout).toBe(10000)
  })
})

describe('queryClient', () => {
  it('is defined with default options', () => {
    expect(queryClient).toBeDefined()
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.staleTime).toBe(300000)
    expect(defaults.mutations?.retry).toBe(false)
  })

  it('retry returns false for 4xx errors', () => {
    const retryFn = queryClient.getDefaultOptions().queries?.retry as Function
    expect(retryFn(0, { status: 400 })).toBe(false)
    expect(retryFn(0, { status: 403 })).toBe(false)
    expect(retryFn(0, { status: 499 })).toBe(false)
  })

  it('retry returns true for 5xx with failureCount < 3', () => {
    const retryFn = queryClient.getDefaultOptions().queries?.retry as Function
    expect(retryFn(0, { status: 500 })).toBe(true)
    expect(retryFn(2, { status: 500 })).toBe(true)
    expect(retryFn(3, { status: 500 })).toBe(false)
  })
})

describe('access token management', () => {
  it('setAccessToken and getAccessToken work', () => {
    expect(getAccessToken()).toBeNull()
    setAccessToken('test-token')
    expect(getAccessToken()).toBe('test-token')
  })

  it('setAccessToken notifies listener', () => {
    const listener = jest.fn()
    setAccessTokenListener(listener)
    setAccessToken('abc')
    expect(listener).toHaveBeenCalledWith('abc')
  })

  it('setAccessToken does not throw when no listener set', () => {
    setAccessTokenListener(null)
    expect(() => setAccessToken('xyz')).not.toThrow()
  })
})

describe('refreshAccessToken', () => {
  it('refreshes and sets the new token', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: 'refreshed-token' })
      )
    )

    const token = await refreshAccessToken()
    expect(token).toBe('refreshed-token')
    expect(getAccessToken()).toBe('refreshed-token')
  })

  it('returns null and clears token on failure', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 }))
    )

    setAccessToken('old-token')
    const token = await refreshAccessToken()
    expect(token).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('returns null on network error', async () => {
    server.use(http.post(`${API_BASE_URL}/auth/refresh`, () => HttpResponse.error()))

    const token = await refreshAccessToken()
    expect(token).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('deduplicates concurrent refresh requests', async () => {
    let callCount = 0
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, async () => {
        callCount++
        await new Promise((r) => setTimeout(r, 20))
        return HttpResponse.json({ accessToken: 'dedup-token' })
      })
    )

    const [t1, t2] = await Promise.all([refreshAccessToken(), refreshAccessToken()])
    expect(t1).toBe('dedup-token')
    expect(t2).toBe('dedup-token')
    expect(callCount).toBe(1)
  })
})

describe('apiRequest', () => {
  it('makes GET request and returns data', async () => {
    server.use(http.get(`${API_BASE_URL}/test-endpoint`, () => HttpResponse.json({ result: 'ok' })))

    const data = await apiRequest<{ result: string }>('/test-endpoint')
    expect(data).toEqual({ result: 'ok' })
  })

  it('sends authorization header when token is set', async () => {
    setAccessToken('my-token')
    let capturedAuth: string | null = null

    server.use(
      http.get(`${API_BASE_URL}/protected`, ({ request }) => {
        capturedAuth = request.headers.get('authorization')
        return HttpResponse.json({ ok: true })
      })
    )

    await apiRequest('/protected')
    expect(capturedAuth).toBe('Bearer my-token')
  })

  it('does not send authorization header when token is null', async () => {
    let capturedAuth: string | null = 'should-be-null'

    server.use(
      http.get(`${API_BASE_URL}/public`, ({ request }) => {
        capturedAuth = request.headers.get('authorization')
        return HttpResponse.json({ ok: true })
      })
    )

    await apiRequest('/public')
    expect(capturedAuth).toBeNull()
  })

  it('throws Error with message from error response', async () => {
    server.use(
      http.get(
        `${API_BASE_URL}/fail`,
        () =>
          new HttpResponse(JSON.stringify({ message: 'Custom error' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    )

    await expect(apiRequest('/fail')).rejects.toThrow('Custom error')
  })

  it('throws Error with HTTP status when no message in error body', async () => {
    server.use(
      http.get(
        `${API_BASE_URL}/fail-no-msg`,
        () =>
          new HttpResponse('{}', {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    )

    await expect(apiRequest('/fail-no-msg')).rejects.toThrow(/HTTP 500/)
  })

  it('throws Request timeout on abort', async () => {
    server.use(
      http.get(`${API_BASE_URL}/slow`, async () => {
        await new Promise((r) => setTimeout(r, 5000))
        return HttpResponse.json({})
      })
    )

    await expect(apiRequest('/slow', { timeoutMs: 50 })).rejects.toThrow('Request timeout')
  })

  it('retries with refreshed token on 401', async () => {
    let requestCount = 0
    server.use(
      http.get(`${API_BASE_URL}/guarded`, ({ request }) => {
        requestCount++
        const auth = request.headers.get('authorization')
        if (auth === 'Bearer refreshed-token') {
          return HttpResponse.json({ guarded: true })
        }
        return new HttpResponse(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: 'refreshed-token' })
      )
    )

    const data = await apiRequest<{ guarded: boolean }>('/guarded')
    expect(data).toEqual({ guarded: true })
    expect(requestCount).toBe(2)
  })

  it('does not retry refresh for /auth/refresh endpoint', async () => {
    server.use(
      http.post(
        `${API_BASE_URL}/auth/refresh`,
        () =>
          new HttpResponse(JSON.stringify({ message: 'Token expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    )

    await expect(apiRequest('/auth/refresh', { method: 'POST' })).rejects.toThrow('Token expired')
  })

  it('handles POST with JSON body', async () => {
    let capturedBody: any = null
    server.use(
      http.post(`${API_BASE_URL}/items`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ id: '1' })
      })
    )

    await apiRequest('/items', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
    })
    expect(capturedBody).toEqual({ name: 'test' })
  })

  it('omits Content-Type header for FormData bodies', async () => {
    let capturedContentType: string | null = null
    server.use(
      http.put(`${API_BASE_URL}/upload`, ({ request }) => {
        capturedContentType = request.headers.get('content-type')
        return HttpResponse.json({ ok: true })
      })
    )

    const formData = new FormData()
    formData.append('file', new Blob(['data']), 'test.txt')

    await apiRequest('/upload', { method: 'PUT', body: formData })
    expect(capturedContentType).not.toBe('application/json')
  })

  it('throws original Error if retry after refresh also fails', async () => {
    server.use(
      http.get(
        `${API_BASE_URL}/always-fail`,
        () =>
          new HttpResponse(JSON.stringify({ message: 'Still unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
      ),
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: 'refreshed-token' })
      )
    )

    await expect(apiRequest('/always-fail')).rejects.toThrow('Still unauthorized')
  })

  it('throws "Request failed" for unexpected non-Error throws', async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockRejectedValue('string-error')

    await expect(apiRequest('/anything')).rejects.toThrow('Request failed')

    global.fetch = originalFetch
  })
})

describe('apiRequestRoot', () => {
  it('uses root URL without versioned path', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API_ROOT_URL}/crm/salesforce/status`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ connected: true })
      })
    )

    await apiRequestRoot('/crm/salesforce/status')
    expect(capturedUrl).toContain('/crm/salesforce/status')
    expect(capturedUrl).not.toContain('/v1/crm')
  })

  it('retries with refresh on 401', async () => {
    let requestCount = 0
    server.use(
      http.get(`${API_ROOT_URL}/crm/test`, ({ request }) => {
        requestCount++
        if (request.headers.get('authorization') === 'Bearer refreshed-token') {
          return HttpResponse.json({ ok: true })
        }
        return new HttpResponse(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: 'refreshed-token' })
      )
    )

    const data = await apiRequestRoot<{ ok: boolean }>('/crm/test')
    expect(data).toEqual({ ok: true })
    expect(requestCount).toBe(2)
  })

  it('throws Error with errorData message on failure', async () => {
    server.use(
      http.get(
        `${API_ROOT_URL}/crm/fail`,
        () =>
          new HttpResponse(JSON.stringify({ message: 'CRM error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    )

    await expect(apiRequestRoot('/crm/fail')).rejects.toThrow('CRM error')
  })
})

describe('api namespace methods', () => {
  describe('api.auth', () => {
    it('login sends credentials and returns token + user', async () => {
      const result = await api.auth.login({ email: 'test@example.com', password: 'password123' })
      expect(result.accessToken).toBe('mock-jwt-token')
      expect(result.user.email).toBe('test@example.com')
    })

    it('register sends user data', async () => {
      const result = await api.auth.register({
        email: 'new@example.com',
        password: 'pass123',
        name: 'New',
      })
      expect(result.accessToken).toBe('mock-jwt-token')
      expect(result.user.email).toBe('new@example.com')
    })

    it('logout returns success', async () => {
      await expect(api.auth.logout()).resolves.toBeDefined()
    })

    it('me returns user when authenticated', async () => {
      setAccessToken('mock-jwt-token')
      const user = await api.auth.me()
      expect(user.id).toBe('1')
    })

    it('refreshToken returns token or throws', async () => {
      const result = await api.auth.refreshToken()
      expect(result.accessToken).toBe('new-mock-jwt-token')
    })

    it('refreshToken throws when refresh fails', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 }))
      )
      await expect(api.auth.refreshToken()).rejects.toThrow('Refresh token invalid or expired')
    })

    it('checkEmail sends POST with email', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/check-email`, () =>
          HttpResponse.json({ exists: true, message: 'Found' })
        )
      )
      const result = await api.auth.checkEmail('a@b.com')
      expect(result.exists).toBe(true)
    })
  })

  describe('api.users', () => {
    it('getMySettings returns settings', async () => {
      const result = await api.users.getMySettings()
      expect(result).toBeDefined()
    })

    it('updateMySettings sends PUT', async () => {
      const result = await api.users.updateMySettings({ theme: 'dark' })
      expect(result).toBeDefined()
    })

    it('updateMyAvatar with file sends FormData', async () => {
      const file = new File(['data'], 'avatar.png', { type: 'image/png' })
      const result = await api.users.updateMyAvatar({ file })
      expect(result.avatar).toBeDefined()
    })

    it('updateMyAvatar with URL sends JSON', async () => {
      const result = await api.users.updateMyAvatar({ avatarUrl: 'https://example.com/img.png' })
      expect(result.avatar).toBeDefined()
    })
  })

  describe('api.teams', () => {
    it('getUserTeams returns teams array', async () => {
      const result = await api.teams.getUserTeams()
      expect(Array.isArray(result)).toBe(true)
      expect(result[0].id).toBe('team_1')
    })
  })

  describe('api.sessions', () => {
    it('getAll builds query string from params', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/simulation/sessions`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json({ sessions: [], total: 0, limit: 10, offset: 0 })
        })
      )

      await api.sessions.getAll({ userId: 'u1', status: 'active', limit: 5 })
      expect(capturedUrl).toContain('userId=u1')
      expect(capturedUrl).toContain('status=active')
      expect(capturedUrl).toContain('limit=5')
    })

    it('getAll with no params omits query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/simulation/sessions`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json({ sessions: [], total: 0, limit: 10, offset: 0 })
        })
      )

      await api.sessions.getAll()
      expect(capturedUrl).not.toContain('?')
    })

    it('create sends POST', async () => {
      const result = await api.sessions.create({ type: 'practice' })
      expect(result.id).toBe('session_123')
    })

    it('end sends POST with reason', async () => {
      server.use(
        http.post(`${API_BASE_URL}/simulation/sessions/:id/end`, () =>
          HttpResponse.json({ id: 'session_123', status: 'ended' })
        )
      )
      const result = await api.sessions.end('session_123', { reason: 'done' })
      expect(result.status).toBe('ended')
    })

    it('timeline appends limit param', async () => {
      server.use(
        http.get(`${API_BASE_URL}/simulation/sessions/:id/timeline`, ({ request }) =>
          HttpResponse.json({ events: [] })
        )
      )
      const result = await api.sessions.timeline('s1', 5)
      expect(result).toBeDefined()
    })
  })

  describe('api.notifications', () => {
    it('list builds query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/notifications`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      await api.notifications.list({ recipientUserId: 'u1', unreadOnly: true, limit: 10 })
      expect(capturedUrl).toContain('recipientUserId=u1')
      expect(capturedUrl).toContain('unreadOnly=true')
      expect(capturedUrl).toContain('limit=10')
    })

    it('list with no params omits query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/notifications`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      await api.notifications.list()
      expect(capturedUrl).not.toContain('?')
    })
  })

  describe('api.tts', () => {
    it('listProviders returns providers', async () => {
      const result = await api.tts.listProviders()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('speak makes POST and returns Blob', async () => {
      server.use(
        http.post(
          `${API_BASE_URL}/tts/speak`,
          () =>
            new HttpResponse(new Uint8Array([1, 2, 3]), {
              headers: { 'Content-Type': 'audio/mpeg' },
            })
        )
      )
      const blob = await api.tts.speak({ text: 'hello', provider: 'openai', voice: 'alloy' })
      expect(blob.constructor.name).toBe('Blob')
    })

    it('speak throws on error response', async () => {
      server.use(
        http.post(
          `${API_BASE_URL}/tts/speak`,
          () =>
            new HttpResponse(JSON.stringify({ message: 'TTS failed' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            })
        )
      )
      await expect(
        api.tts.speak({ text: 'hello', provider: 'openai', voice: 'alloy' })
      ).rejects.toThrow('TTS failed')
    })

    it('speak throws generic message when error body is not JSON', async () => {
      server.use(
        http.post(
          `${API_BASE_URL}/tts/speak`,
          () => new HttpResponse('Internal Server Error', { status: 500 })
        )
      )
      await expect(
        api.tts.speak({ text: 'hello', provider: 'openai', voice: 'alloy' })
      ).rejects.toThrow(/HTTP 500/)
    })
  })

  describe('api.personas', () => {
    it('getAll returns personas', async () => {
      const result = await api.personas.getAll()
      expect(result.personas.length).toBe(2)
    })

    it('getPreviewAudio returns Blob', async () => {
      server.use(
        http.get(
          `${API_BASE_URL}/simulation/personas/:id/preview-audio`,
          () =>
            new HttpResponse(new Uint8Array([1, 2]), {
              headers: { 'Content-Type': 'audio/wav' },
            })
        )
      )
      const blob = await api.personas.getPreviewAudio('persona_1')
      expect(blob.constructor.name).toBe('Blob')
    })

    it('getPreviewAudio throws on error', async () => {
      server.use(
        http.get(
          `${API_BASE_URL}/simulation/personas/:id/preview-audio`,
          () =>
            new HttpResponse(JSON.stringify({ message: 'Not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            })
        )
      )
      await expect(api.personas.getPreviewAudio('bad')).rejects.toThrow('Not found')
    })
  })

  describe('api.challenges', () => {
    it('list builds query string from params', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/challenges`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      await api.challenges.list({ period: 'DAILY', difficulty: 'hard', limit: 10, offset: 5 })
      expect(capturedUrl).toContain('period=DAILY')
      expect(capturedUrl).toContain('difficulty=hard')
      expect(capturedUrl).toContain('limit=10')
      expect(capturedUrl).toContain('offset=5')
    })
  })

  describe('api.invitations', () => {
    it('getMyInvitations appends status query', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/simulation/invitations/me`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      await api.invitations.getMyInvitations('pending')
      expect(capturedUrl).toContain('status=pending')
    })

    it('getMyInvitations without status has no query', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/simulation/invitations/me`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      await api.invitations.getMyInvitations()
      expect(capturedUrl).not.toContain('?')
    })
  })

  describe('api.oauth', () => {
    it('getProviders returns array', async () => {
      server.use(
        http.get(`${API_BASE_URL}/auth/oauth/providers`, () =>
          HttpResponse.json([
            { name: 'google', displayName: 'Google', icon: '', color: '', authUrl: '' },
          ])
        )
      )
      const providers = await api.oauth.getProviders()
      expect(providers[0].name).toBe('google')
    })
  })

  describe('api.crm.salesforce', () => {
    it('status uses root URL', async () => {
      const result = await api.crm.salesforce.status()
      expect(result).toHaveProperty('connected')
    })
  })

  describe('api.hints', () => {
    it('history builds query with sessionId', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/simulation/hints/history`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      await api.hints.history('s1', 5, 'coach')
      expect(capturedUrl).toContain('sessionId=s1')
      expect(capturedUrl).toContain('limit=5')
      expect(capturedUrl).toContain('type=coach')
    })
  })

  describe('api.assessments', () => {
    it('getLatestForSession builds query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/simulation/sessions/:id/assessments/latest`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json({})
        })
      )

      await api.assessments.getLatestForSession('s1', {
        iterationId: 'it1',
        sessionMemberId: 'sm1',
      })
      expect(capturedUrl).toContain('iterationId=it1')
      expect(capturedUrl).toContain('sessionMemberId=sm1')
    })
  })

  describe('api.admin', () => {
    it('users.list builds query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/admin/users`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      await api.admin.users.list({ limit: 20, offset: 5, search: 'john' })
      expect(capturedUrl).toContain('limit=20')
      expect(capturedUrl).toContain('offset=5')
      expect(capturedUrl).toContain('search=john')
    })

    it('sessions.list builds query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/admin/sessions`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      await api.admin.sessions.list({ userId: 'u1', status: 'active', limit: 10 })
      expect(capturedUrl).toContain('userId=u1')
      expect(capturedUrl).toContain('status=active')
    })
  })
})
