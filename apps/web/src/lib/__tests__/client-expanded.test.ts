import { http, HttpResponse } from 'msw'
import { server } from '../../__tests__/mocks/server'
import { API_CONFIG, setAccessToken, api, apiRequestRoot } from '../client'

const API_BASE_URL = API_CONFIG.baseURL
const API_ROOT_URL = API_BASE_URL.replace(/\/v\d+$/, '')

beforeEach(() => {
  setAccessToken(null)
})

describe('apiRequestRoot edge cases', () => {
  it('throws errorData.message when retry after refresh also fails', async () => {
    server.use(
      http.get(
        `${API_ROOT_URL}/crm/edge`,
        () =>
          new HttpResponse(JSON.stringify({ message: 'edge-error' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
      ),
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: 'refreshed-token' })
      )
    )

    await expect(apiRequestRoot('/crm/edge')).rejects.toThrow('edge-error')
  })

  it('throws raw error when errorData has no message', async () => {
    server.use(
      http.get(
        `${API_ROOT_URL}/crm/raw-throw`,
        () =>
          new HttpResponse('{}', {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    )

    await expect(apiRequestRoot('/crm/raw-throw')).rejects.toBeDefined()
  })
})

describe('api.users (expanded)', () => {
  it('getAll fetches /users', async () => {
    server.use(http.get(`${API_BASE_URL}/users`, () => HttpResponse.json([{ id: '1' }])))
    const result = await api.users.getAll()
    expect(result).toEqual([{ id: '1' }])
  })

  it('getById fetches /users/:id', async () => {
    server.use(http.get(`${API_BASE_URL}/users/u1`, () => HttpResponse.json({ id: 'u1' })))
    const result = await api.users.getById('u1')
    expect(result.id).toBe('u1')
  })

  it('getMyPhoneVerification fetches verification status', async () => {
    server.use(
      http.get(`${API_BASE_URL}/users/me/phone-verification`, () =>
        HttpResponse.json({ verified: true })
      )
    )
    const result = await api.users.getMyPhoneVerification()
    expect(result.verified).toBe(true)
  })

  it('create sends POST to /users', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/users`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'new-user' })
      })
    )
    await api.users.create({ name: 'John', email: 'j@e.com' })
    expect(body).toEqual({ name: 'John', email: 'j@e.com' })
  })

  it('update sends PUT to /users/:id', async () => {
    let body: any
    server.use(
      http.put(`${API_BASE_URL}/users/u1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'u1' })
      })
    )
    await api.users.update('u1', { name: 'Updated' })
    expect(body).toEqual({ name: 'Updated' })
  })

  it('requestPhoneVerification sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/users/me/phone-verification/request`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ sid: 'ver_1' })
      })
    )
    await api.users.requestPhoneVerification({ phoneNumber: '+1234' })
    expect(body).toEqual({ phoneNumber: '+1234' })
  })

  it('resendPhoneVerification sends POST', async () => {
    server.use(
      http.post(`${API_BASE_URL}/users/me/phone-verification/resend`, () =>
        HttpResponse.json({ sid: 'ver_2' })
      )
    )
    const result = await api.users.resendPhoneVerification()
    expect(result.sid).toBe('ver_2')
  })

  it('verifyPhoneVerification sends POST with code', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/users/me/phone-verification/verify`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ verified: true })
      })
    )
    await api.users.verifyPhoneVerification({ code: '1234', saveForFutureUse: true })
    expect(body).toEqual({ code: '1234', saveForFutureUse: true })
  })

  it('delete sends DELETE to /users/:id', async () => {
    server.use(http.delete(`${API_BASE_URL}/users/u1`, () => HttpResponse.json({ deleted: true })))
    const result = await api.users.delete('u1')
    expect(result.deleted).toBe(true)
  })
})

describe('api.businesses', () => {
  it('getAll fetches /businesses', async () => {
    server.use(http.get(`${API_BASE_URL}/businesses`, () => HttpResponse.json([{ id: 'b1' }])))
    const result = await api.businesses.getAll()
    expect(result).toEqual([{ id: 'b1' }])
  })

  it('getById fetches /businesses/:id', async () => {
    server.use(http.get(`${API_BASE_URL}/businesses/b1`, () => HttpResponse.json({ id: 'b1' })))
    const result = await api.businesses.getById('b1')
    expect(result.id).toBe('b1')
  })

  it('create sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/businesses`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'b2' })
      })
    )
    await api.businesses.create({ name: 'Acme' })
    expect(body).toEqual({ name: 'Acme' })
  })

  it('update sends PUT', async () => {
    server.use(http.put(`${API_BASE_URL}/businesses/b1`, () => HttpResponse.json({ id: 'b1' })))
    const result = await api.businesses.update('b1', { name: 'Updated' })
    expect(result.id).toBe('b1')
  })

  it('delete sends DELETE', async () => {
    server.use(
      http.delete(`${API_BASE_URL}/businesses/b1`, () => HttpResponse.json({ deleted: true }))
    )
    const result = await api.businesses.delete('b1')
    expect(result.deleted).toBe(true)
  })
})

describe('api.oauth (expanded)', () => {
  it('getLinkedAccounts returns array', async () => {
    server.use(
      http.get(`${API_BASE_URL}/auth/oauth/linked-accounts`, () =>
        HttpResponse.json([{ provider: 'google', email: 'a@b.com' }])
      )
    )
    const result = await api.oauth.getLinkedAccounts()
    expect(result[0].provider).toBe('google')
  })

  it('unlinkAccount sends DELETE', async () => {
    server.use(
      http.delete(`${API_BASE_URL}/auth/oauth/unlink/google`, () =>
        HttpResponse.json({ message: 'unlinked' })
      )
    )
    const result = await api.oauth.unlinkAccount('google')
    expect(result.message).toBe('unlinked')
  })

  it('refreshToken sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/auth/oauth/refresh`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ access_token: 'new', refresh_token: 'new_r' })
      })
    )
    await api.oauth.refreshToken('old_r')
    expect(body).toEqual({ refresh_token: 'old_r' })
  })
})

describe('api.notifications (expanded)', () => {
  it('create sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/notifications`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'n1' })
      })
    )
    await api.notifications.create({
      recipientUserId: 'u1',
      title: 'Hello',
      message: 'World',
      type: 'info',
      sourceType: 'SYSTEM',
    })
    expect(body.recipientUserId).toBe('u1')
  })

  it('createBatch sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/notifications/batch`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ count: 2 })
      })
    )
    await api.notifications.createBatch({
      recipientUserIds: ['u1', 'u2'],
      title: 'Batch',
      message: 'Msg',
      type: 'info',
      sourceType: 'SYSTEM',
    })
    expect(body.recipientUserIds).toEqual(['u1', 'u2'])
  })

  it('unreadCount fetches count', async () => {
    server.use(
      http.get(`${API_BASE_URL}/notifications/unread-count/u1`, () =>
        HttpResponse.json({ count: 5 })
      )
    )
    const result = await api.notifications.unreadCount('u1')
    expect(result.count).toBe(5)
  })

  it('markRead sends PATCH', async () => {
    let body: any
    server.use(
      http.patch(`${API_BASE_URL}/notifications/mark-read`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ matched: 2, modified: 2 })
      })
    )
    await api.notifications.markRead({ notificationIds: ['n1', 'n2'] })
    expect(body.notificationIds).toEqual(['n1', 'n2'])
  })

  it('markAllRead sends PATCH', async () => {
    server.use(
      http.patch(`${API_BASE_URL}/notifications/mark-all-read/u1`, () =>
        HttpResponse.json({ matched: 10, modified: 10 })
      )
    )
    const result = await api.notifications.markAllRead('u1')
    expect(result.matched).toBe(10)
  })
})

describe('api.teams (expanded)', () => {
  it('getAll fetches /teams', async () => {
    server.use(http.get(`${API_BASE_URL}/teams`, () => HttpResponse.json([{ id: 't1' }])))
    const result = await api.teams.getAll()
    expect(result[0].id).toBe('t1')
  })

  it('getById fetches /teams/:id', async () => {
    server.use(http.get(`${API_BASE_URL}/teams/t1`, () => HttpResponse.json({ id: 't1' })))
    const result = await api.teams.getById('t1')
    expect(result.id).toBe('t1')
  })

  it('create sends POST', async () => {
    server.use(http.post(`${API_BASE_URL}/teams`, () => HttpResponse.json({ id: 't2' })))
    const result = await api.teams.create({ name: 'Team A' })
    expect(result.id).toBe('t2')
  })

  it('update sends PUT', async () => {
    server.use(http.put(`${API_BASE_URL}/teams/t1`, () => HttpResponse.json({ id: 't1' })))
    const result = await api.teams.update('t1', { name: 'Updated' })
    expect(result.id).toBe('t1')
  })

  it('delete sends DELETE', async () => {
    server.use(http.delete(`${API_BASE_URL}/teams/t1`, () => HttpResponse.json({ deleted: true })))
    const result = await api.teams.delete('t1')
    expect(result.deleted).toBe(true)
  })

  it('addMember sends POST to /teams/:id/members', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/teams/t1/members`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ok: true })
      })
    )
    await api.teams.addMember('t1', { userId: 'u1' })
    expect(body.userId).toBe('u1')
  })

  it('inviteMember sends POST to /teams/:id/invitations', async () => {
    server.use(
      http.post(`${API_BASE_URL}/teams/t1/invitations`, () => HttpResponse.json({ ok: true }))
    )
    const result = await api.teams.inviteMember('t1', { email: 'a@b.com' })
    expect(result.ok).toBe(true)
  })

  it('sendSignupInvite sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/teams/t1/invitations/signup`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ok: true })
      })
    )
    await api.teams.sendSignupInvite('t1', { email: 'new@e.com', role: 'member' })
    expect(body.email).toBe('new@e.com')
  })

  it('claimInvite sends POST', async () => {
    server.use(
      http.post(`${API_BASE_URL}/teams/t1/invitations/claim`, () =>
        HttpResponse.json({ claimed: true })
      )
    )
    const result = await api.teams.claimInvite('t1')
    expect(result.claimed).toBe(true)
  })

  it('acceptInvite sends POST', async () => {
    server.use(
      http.post(`${API_BASE_URL}/teams/t1/invitations/accept`, () =>
        HttpResponse.json({ accepted: true })
      )
    )
    const result = await api.teams.acceptInvite('t1')
    expect(result.accepted).toBe(true)
  })

  it('updateMember sends PUT', async () => {
    server.use(
      http.put(`${API_BASE_URL}/teams/t1/members/u1`, () => HttpResponse.json({ ok: true }))
    )
    const result = await api.teams.updateMember('t1', 'u1', { role: 'admin' })
    expect(result.ok).toBe(true)
  })

  it('deleteMember sends DELETE', async () => {
    server.use(
      http.delete(`${API_BASE_URL}/teams/t1/members/u1`, () => HttpResponse.json({ ok: true }))
    )
    const result = await api.teams.deleteMember('t1', 'u1', {})
    expect(result.ok).toBe(true)
  })
})

describe('api.plans', () => {
  it('getAll returns plans', async () => {
    server.use(http.get(`${API_BASE_URL}/plans`, () => HttpResponse.json([{ id: 'p1' }])))
    const result = await api.plans.getAll()
    expect(result[0].id).toBe('p1')
  })

  it('getById returns plan', async () => {
    server.use(http.get(`${API_BASE_URL}/plans/p1`, () => HttpResponse.json({ id: 'p1' })))
    const result = await api.plans.getById('p1')
    expect(result.id).toBe('p1')
  })

  it('create sends POST', async () => {
    server.use(http.post(`${API_BASE_URL}/plans`, () => HttpResponse.json({ id: 'p2' })))
    const result = await api.plans.create({ name: 'Basic' })
    expect(result.id).toBe('p2')
  })

  it('update sends PUT', async () => {
    server.use(http.put(`${API_BASE_URL}/plans/p1`, () => HttpResponse.json({ id: 'p1' })))
    const result = await api.plans.update('p1', { name: 'Pro' })
    expect(result.id).toBe('p1')
  })

  it('delete sends DELETE', async () => {
    server.use(http.delete(`${API_BASE_URL}/plans/p1`, () => HttpResponse.json({ deleted: true })))
    const result = await api.plans.delete('p1')
    expect(result.deleted).toBe(true)
  })
})

describe('api.subscriptions', () => {
  it('getAll returns subscriptions', async () => {
    server.use(http.get(`${API_BASE_URL}/subscriptions`, () => HttpResponse.json([{ id: 's1' }])))
    const result = await api.subscriptions.getAll()
    expect(result[0].id).toBe('s1')
  })

  it('getById returns subscription', async () => {
    server.use(http.get(`${API_BASE_URL}/subscriptions/s1`, () => HttpResponse.json({ id: 's1' })))
    const result = await api.subscriptions.getById('s1')
    expect(result.id).toBe('s1')
  })

  it('getByTeamId returns subscription for team', async () => {
    server.use(
      http.get(`${API_BASE_URL}/subscriptions/teams/t1`, () =>
        HttpResponse.json({ id: 's1', teamId: 't1' })
      )
    )
    const result = await api.subscriptions.getByTeamId('t1')
    expect(result.teamId).toBe('t1')
  })

  it('create sends POST', async () => {
    server.use(http.post(`${API_BASE_URL}/subscriptions`, () => HttpResponse.json({ id: 's2' })))
    const result = await api.subscriptions.create({ planId: 'p1' })
    expect(result.id).toBe('s2')
  })

  it('update sends PUT', async () => {
    server.use(http.put(`${API_BASE_URL}/subscriptions/s1`, () => HttpResponse.json({ id: 's1' })))
    const result = await api.subscriptions.update('s1', { planId: 'p2' })
    expect(result.id).toBe('s1')
  })

  it('upgrade sends PUT to /subscriptions/:id/upgrade', async () => {
    server.use(
      http.put(`${API_BASE_URL}/subscriptions/s1/upgrade`, () =>
        HttpResponse.json({ id: 's1', upgraded: true })
      )
    )
    const result = await api.subscriptions.upgrade('s1', { planId: 'p3' })
    expect(result.upgraded).toBe(true)
  })

  it('delete sends DELETE', async () => {
    server.use(
      http.delete(`${API_BASE_URL}/subscriptions/s1`, () => HttpResponse.json({ deleted: true }))
    )
    const result = await api.subscriptions.delete('s1')
    expect(result.deleted).toBe(true)
  })
})

describe('api.s3', () => {
  it('presignUpload sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/s3/presigned/upload`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ url: 'https://s3.example.com/upload' })
      })
    )
    const result = await api.s3.presignUpload({
      bucket: 'my-bucket',
      key: 'file.txt',
      expiresIn: 300,
    })
    expect(result.url).toBe('https://s3.example.com/upload')
    expect(body.bucket).toBe('my-bucket')
    expect(body.expiresInSeconds).toBe(300)
  })
})

describe('api.sessions (expanded)', () => {
  it('getById fetches session', async () => {
    server.use(
      http.get(`${API_BASE_URL}/simulation/sessions/s1`, () =>
        HttpResponse.json({ id: 's1', status: 'active' })
      )
    )
    const result = await api.sessions.getById('s1')
    expect(result.id).toBe('s1')
  })

  it('getUserSessions builds query with userId', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API_BASE_URL}/simulation/sessions`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      })
    )
    await api.sessions.getUserSessions('u1', { limit: 5, offset: 10 })
    expect(capturedUrl).toContain('userId=u1')
    expect(capturedUrl).toContain('limit=5')
    expect(capturedUrl).toContain('offset=10')
  })

  it('getOrgSessions builds query with orgId', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API_BASE_URL}/simulation/sessions`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      })
    )
    await api.sessions.getOrgSessions('org1', { limit: 3 })
    expect(capturedUrl).toContain('orgId=org1')
    expect(capturedUrl).toContain('limit=3')
  })

  it('update sends PUT', async () => {
    let body: any
    server.use(
      http.put(`${API_BASE_URL}/simulation/sessions/s1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 's1' })
      })
    )
    await api.sessions.update('s1', { name: 'Updated' })
    expect(body.name).toBe('Updated')
  })

  it('restart sends POST', async () => {
    server.use(
      http.post(`${API_BASE_URL}/simulation/sessions/s1/restart`, () =>
        HttpResponse.json({ id: 's1', status: 'active' })
      )
    )
    const result = await api.sessions.restart('s1', { reason: 'redo' })
    expect(result.status).toBe('active')
  })

  it('restart without data sends empty object', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/simulation/sessions/s1/restart`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 's1' })
      })
    )
    await api.sessions.restart('s1')
    expect(body).toEqual({})
  })

  it('delete sends DELETE', async () => {
    server.use(
      http.delete(`${API_BASE_URL}/simulation/sessions/s1`, () =>
        HttpResponse.json({ deleted: true })
      )
    )
    const result = await api.sessions.delete('s1')
    expect(result.deleted).toBe(true)
  })
})

describe('api.phoneCalls', () => {
  it('start sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/simulation/phone-calls`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ callId: 'c1' })
      })
    )
    await api.phoneCalls.start({ sessionId: 's1', phoneNumber: '+1234' })
    expect(body.sessionId).toBe('s1')
    expect(body.phoneNumber).toBe('+1234')
  })

  it('end sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/simulation/phone-calls/end`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ended: true })
      })
    )
    await api.phoneCalls.end({ sessionId: 's1', reason: 'done' })
    expect(body.sessionId).toBe('s1')
  })
})

describe('api.assessments', () => {
  it('run sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/simulation/assessments/run`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ runId: 'r1' })
      })
    )
    await api.assessments.run({ sessionId: 's1', mode: 'final' })
    expect(body.sessionId).toBe('s1')
    expect(body.mode).toBe('final')
  })

  it('getRunStatus fetches run status', async () => {
    server.use(
      http.get(`${API_BASE_URL}/simulation/assessments/runs/r1`, () =>
        HttpResponse.json({ runId: 'r1', status: 'complete' })
      )
    )
    const result = await api.assessments.getRunStatus('r1')
    expect(result.status).toBe('complete')
  })

  it('getReport fetches report', async () => {
    server.use(
      http.get(`${API_BASE_URL}/simulation/assessments/runs/r1/report`, () =>
        HttpResponse.json({ score: 85 })
      )
    )
    const result = await api.assessments.getReport('r1')
    expect(result.score).toBe(85)
  })
})

describe('api.lti', () => {
  it('getCredentials returns credentials', async () => {
    server.use(
      http.get(`${API_BASE_URL}/lti/platforms/credentials`, () =>
        HttpResponse.json({
          v13: {
            launchUrl: '/launch',
            oidcLoginUrl: '/login',
            jwksUrl: '/jwks',
            redirectUri: '/redirect',
            publicKeyPem: null,
          },
          v11: { launchUrl: '/v11-launch' },
        })
      )
    )
    const result = await api.lti.getCredentials()
    expect(result.v13.launchUrl).toBe('/launch')
    expect(result.v11.launchUrl).toBe('/v11-launch')
  })

  it('registerPlatform sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/lti/platforms`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'lti_1' })
      })
    )
    await api.lti.registerPlatform({
      name: 'Canvas',
      issuer: 'https://canvas.example.com',
      clientId: 'cid',
      authLoginUrl: '/login',
      authTokenUrl: '/token',
      keysetUrl: '/keys',
      deploymentId: 'dep1',
    })
    expect(body.name).toBe('Canvas')
    expect(body.issuer).toBe('https://canvas.example.com')
  })
})

describe('api.scenarios (expanded)', () => {
  it('getById fetches scenario', async () => {
    server.use(
      http.get(`${API_BASE_URL}/simulation/scenarios/sc1`, () =>
        HttpResponse.json({ id: 'sc1', name: 'Discovery' })
      )
    )
    const result = await api.scenarios.getById('sc1')
    expect(result.id).toBe('sc1')
  })

  it('generate sends POST with timeout', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/simulation/scenarios/generate`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'gen1' })
      })
    )
    await api.scenarios.generate({ prompt: 'a scenario' })
    expect(body.prompt).toBe('a scenario')
  })

  it('generateBatch sends POST', async () => {
    server.use(
      http.post(`${API_BASE_URL}/simulation/scenarios/generate/batch`, () =>
        HttpResponse.json({ count: 3 })
      )
    )
    const result = await api.scenarios.generateBatch({ count: 3 })
    expect(result.count).toBe(3)
  })
})

describe('api.hints (expanded)', () => {
  it('generate sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/simulation/hints/generate`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ hint: 'Try asking about budget' })
      })
    )
    await api.hints.generate({ sessionId: 's1', type: 'coach' })
    expect(body.sessionId).toBe('s1')
  })
})

describe('api.crm.salesforce (expanded)', () => {
  it('connect fetches connect endpoint', async () => {
    server.use(
      http.get(`${API_ROOT_URL}/crm/salesforce/connect`, () =>
        HttpResponse.json({ authUrl: 'https://sf.com/auth' })
      )
    )
    const result = await api.crm.salesforce.connect()
    expect(result.authUrl).toBe('https://sf.com/auth')
  })

  it('accounts fetches with optional limit', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API_ROOT_URL}/crm/salesforce/accounts`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      })
    )
    await api.crm.salesforce.accounts(10)
    expect(capturedUrl).toContain('limit=10')
  })

  it('contacts fetches with optional limit', async () => {
    server.use(http.get(`${API_ROOT_URL}/crm/salesforce/contacts`, () => HttpResponse.json([])))
    const result = await api.crm.salesforce.contacts()
    expect(result).toEqual([])
  })

  it('opportunities fetches with optional limit', async () => {
    server.use(
      http.get(`${API_ROOT_URL}/crm/salesforce/opportunities`, () => HttpResponse.json([]))
    )
    const result = await api.crm.salesforce.opportunities()
    expect(result).toEqual([])
  })

  it('leads fetches with optional limit', async () => {
    server.use(http.get(`${API_ROOT_URL}/crm/salesforce/leads`, () => HttpResponse.json([])))
    const result = await api.crm.salesforce.leads()
    expect(result).toEqual([])
  })

  it('search sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_ROOT_URL}/crm/salesforce/search`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ results: [] })
      })
    )
    await api.crm.salesforce.search('Acme')
    expect(body).toEqual({ query: 'Acme' })
  })
})

describe('api.invitations (expanded)', () => {
  it('createForSession sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/simulation/sessions/s1/invitations`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'inv1' })
      })
    )
    await api.invitations.createForSession('s1', { inviteeIds: ['u1', 'u2'] })
    expect(body.inviteeIds).toEqual(['u1', 'u2'])
  })

  it('getSessionInvitations fetches invitations for session', async () => {
    server.use(
      http.get(`${API_BASE_URL}/simulation/sessions/s1/invitations`, () =>
        HttpResponse.json([{ id: 'inv1' }])
      )
    )
    const result = await api.invitations.getSessionInvitations('s1')
    expect(result[0].id).toBe('inv1')
  })

  it('getSentInvitations appends status query', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API_BASE_URL}/simulation/invitations/sent`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      })
    )
    await api.invitations.getSentInvitations('pending')
    expect(capturedUrl).toContain('status=pending')
  })

  it('getSentInvitations without status has no query', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API_BASE_URL}/simulation/invitations/sent`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      })
    )
    await api.invitations.getSentInvitations()
    expect(capturedUrl).not.toContain('?')
  })

  it('getById fetches invitation', async () => {
    server.use(
      http.get(`${API_BASE_URL}/simulation/invitations/inv1`, () =>
        HttpResponse.json({ id: 'inv1' })
      )
    )
    const result = await api.invitations.getById('inv1')
    expect(result.id).toBe('inv1')
  })

  it('accept sends POST', async () => {
    server.use(
      http.post(`${API_BASE_URL}/simulation/invitations/inv1/accept`, () =>
        HttpResponse.json({ accepted: true })
      )
    )
    const result = await api.invitations.accept('inv1')
    expect(result.accepted).toBe(true)
  })

  it('decline sends POST', async () => {
    server.use(
      http.post(`${API_BASE_URL}/simulation/invitations/inv1/decline`, () =>
        HttpResponse.json({ declined: true })
      )
    )
    const result = await api.invitations.decline('inv1')
    expect(result.declined).toBe(true)
  })

  it('revoke sends DELETE', async () => {
    server.use(
      http.delete(`${API_BASE_URL}/simulation/invitations/inv1/revoke`, () =>
        HttpResponse.json({ revoked: true })
      )
    )
    const result = await api.invitations.revoke('inv1')
    expect(result.revoked).toBe(true)
  })

  it('getPendingCount returns count', async () => {
    server.use(
      http.get(`${API_BASE_URL}/simulation/invitations/pending-count`, () =>
        HttpResponse.json({ count: 3 })
      )
    )
    const result = await api.invitations.getPendingCount()
    expect(result.count).toBe(3)
  })
})

describe('api.tts (expanded)', () => {
  it('getVoices fetches voices for provider', async () => {
    server.use(
      http.get(`${API_BASE_URL}/tts/voices`, () =>
        HttpResponse.json({ provider: 'openai', voices: ['alloy'], models: ['tts-1'] })
      )
    )
    const result = await api.tts.getVoices('openai')
    expect(result.provider).toBe('openai')
  })
})

describe('api.personas (expanded)', () => {
  it('create sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/simulation/personas`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'p1' })
      })
    )
    await api.personas.create({ orgId: 'org1', name: 'Coach', traits: { role: 'coach' } })
    expect(body.name).toBe('Coach')
    expect(body.orgId).toBe('org1')
  })

  it('getById fetches persona', async () => {
    server.use(
      http.get(`${API_BASE_URL}/simulation/personas/p1`, () =>
        HttpResponse.json({ id: 'p1', name: 'Coach' })
      )
    )
    const result = await api.personas.getById('p1')
    expect(result.name).toBe('Coach')
  })
})

describe('api.challenges (expanded)', () => {
  it('get fetches by id', async () => {
    server.use(
      http.get(`${API_BASE_URL}/challenges/ch1`, () =>
        HttpResponse.json({ id: 'ch1', period: 'DAILY' })
      )
    )
    const result = await api.challenges.get('ch1')
    expect(result.id).toBe('ch1')
  })

  it('participate sends POST', async () => {
    server.use(
      http.post(`${API_BASE_URL}/challenges/ch1/participate`, () =>
        HttpResponse.json({ joined: true })
      )
    )
    const result = await api.challenges.participate('ch1')
    expect(result.joined).toBe(true)
  })

  it('submitScore sends PUT', async () => {
    let body: any
    server.use(
      http.put(`${API_BASE_URL}/challenges/ch1/score`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ok: true })
      })
    )
    await api.challenges.submitScore('ch1', 's1', 85)
    expect(body).toEqual({ sessionId: 's1', score: 85 })
  })

  it('challengeLeaderboard fetches with optional limit', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API_BASE_URL}/challenges/ch1/leaderboard`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      })
    )
    await api.challenges.challengeLeaderboard('ch1', 10)
    expect(capturedUrl).toContain('limit=10')
  })

  it('globalLeaderboard fetches with optional limit', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API_BASE_URL}/challenges/leaderboard`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      })
    )
    await api.challenges.globalLeaderboard(5)
    expect(capturedUrl).toContain('limit=5')
  })

  it('adminGenerate sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/challenges/admin/generate`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'ch_new' })
      })
    )
    await api.challenges.adminGenerate('DAILY')
    expect(body).toEqual({ period: 'DAILY' })
  })
})

describe('api.support', () => {
  it('chat sends POST', async () => {
    let body: any
    server.use(
      http.post(`${API_BASE_URL}/support/chat`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ reply: 'Hello!' })
      })
    )
    const result = await api.support.chat({
      messages: [{ role: 'user', content: 'Help me' }],
    })
    expect(result.reply).toBe('Hello!')
    expect(body.messages[0].content).toBe('Help me')
  })
})

describe('api.analytics', () => {
  it('getDashboard fetches analytics for user', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${API_BASE_URL}/simulation/analytics/dashboard`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ sessions: [] })
      })
    )
    await api.analytics.getDashboard('u1')
    expect(capturedUrl).toContain('userId=u1')
  })
})

describe('api.llm', () => {
  it('getProviders returns providers', async () => {
    const result = await api.llm.getProviders()
    expect(result.providers.length).toBeGreaterThan(0)
    expect(result.providers[0].name).toBe('openai')
  })
})

describe('api.admin (expanded)', () => {
  it('check returns admin status', async () => {
    server.use(http.get(`${API_BASE_URL}/admin/check`, () => HttpResponse.json({ isAdmin: true })))
    const result = await api.admin.check()
    expect(result.isAdmin).toBe(true)
  })

  it('healthServices returns services', async () => {
    server.use(
      http.get(`${API_BASE_URL}/admin/health`, () =>
        HttpResponse.json({ services: [{ name: 'db', status: 'online', latency: 5 }] })
      )
    )
    const result = await api.admin.healthServices()
    expect(result.services[0].name).toBe('db')
  })

  it('overview returns counts', async () => {
    server.use(
      http.get(`${API_BASE_URL}/admin/overview`, () =>
        HttpResponse.json({ userCount: 100, teamCount: 10, sessionCount: 500, planCount: 3 })
      )
    )
    const result = await api.admin.overview()
    expect(result.userCount).toBe(100)
  })

  it('version returns version info', async () => {
    server.use(
      http.get(`${API_BASE_URL}/admin/version`, () =>
        HttpResponse.json({ version: '1.0', nodeVersion: '20', uptime: 3600, environment: 'test' })
      )
    )
    const result = await api.admin.version()
    expect(result.version).toBe('1.0')
  })

  it('runtimeConfig returns config', async () => {
    server.use(
      http.get(`${API_BASE_URL}/admin/runtime-config`, () =>
        HttpResponse.json({ NODE_ENV: 'test', PORT: '8000', featureFlags: [] })
      )
    )
    const result = await api.admin.runtimeConfig()
    expect(result.NODE_ENV).toBe('test')
  })

  describe('featureFlags', () => {
    it('list returns flags', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/feature-flags`, () =>
          HttpResponse.json([{ key: 'beta', enabled: true }])
        )
      )
      const result = await api.admin.featureFlags.list()
      expect(result[0].key).toBe('beta')
    })

    it('set sends POST', async () => {
      let body: any
      server.use(
        http.post(`${API_BASE_URL}/admin/feature-flags`, async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ key: 'beta', enabled: false })
        })
      )
      await api.admin.featureFlags.set('beta', false)
      expect(body).toEqual({ key: 'beta', enabled: false })
    })

    it('delete sends DELETE', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/admin/feature-flags/beta`, () =>
          HttpResponse.json({ deleted: true })
        )
      )
      const result = await api.admin.featureFlags.delete('beta')
      expect(result.deleted).toBe(true)
    })
  })

  describe('users', () => {
    it('get fetches user by id', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/users/u1`, () =>
          HttpResponse.json({ id: 'u1', name: 'Admin User' })
        )
      )
      const result = await api.admin.users.get('u1')
      expect(result.id).toBe('u1')
    })

    it('update sends PUT', async () => {
      server.use(http.put(`${API_BASE_URL}/admin/users/u1`, () => HttpResponse.json({ id: 'u1' })))
      const result = await api.admin.users.update('u1', { name: 'New' })
      expect(result.id).toBe('u1')
    })

    it('delete sends DELETE', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/admin/users/u1`, () => HttpResponse.json({ deleted: true }))
      )
      const result = await api.admin.users.delete('u1')
      expect(result.deleted).toBe(true)
    })

    it('getSessions builds query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/admin/users/u1/sessions`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )
      await api.admin.users.getSessions('u1', { limit: 20, offset: 5 })
      expect(capturedUrl).toContain('limit=20')
      expect(capturedUrl).toContain('offset=5')
    })

    it('impersonate sends POST', async () => {
      server.use(
        http.post(`${API_BASE_URL}/admin/users/u1/impersonate`, () =>
          HttpResponse.json({ token: 'imp-token', expiresAt: '2099-01-01' })
        )
      )
      const result = await api.admin.users.impersonate('u1')
      expect(result.token).toBe('imp-token')
    })
  })

  describe('teams', () => {
    it('list builds query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/admin/teams`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )
      await api.admin.teams.list({ limit: 10, search: 'acme' })
      expect(capturedUrl).toContain('limit=10')
      expect(capturedUrl).toContain('search=acme')
    })

    it('get fetches team', async () => {
      server.use(http.get(`${API_BASE_URL}/admin/teams/t1`, () => HttpResponse.json({ id: 't1' })))
      const result = await api.admin.teams.get('t1')
      expect(result.id).toBe('t1')
    })

    it('update sends PUT', async () => {
      server.use(http.put(`${API_BASE_URL}/admin/teams/t1`, () => HttpResponse.json({ id: 't1' })))
      const result = await api.admin.teams.update('t1', { name: 'New' })
      expect(result.id).toBe('t1')
    })

    it('delete sends DELETE', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/admin/teams/t1`, () => HttpResponse.json({ deleted: true }))
      )
      const result = await api.admin.teams.delete('t1')
      expect(result.deleted).toBe(true)
    })

    it('getMembers fetches members', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/teams/t1/members`, () =>
          HttpResponse.json([{ userId: 'u1' }])
        )
      )
      const result = await api.admin.teams.getMembers('t1')
      expect(result[0].userId).toBe('u1')
    })

    it('transferOwner sends POST', async () => {
      let body: any
      server.use(
        http.post(`${API_BASE_URL}/admin/teams/t1/transfer-owner`, async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ ok: true })
        })
      )
      await api.admin.teams.transferOwner('t1', 'u2')
      expect(body).toEqual({ newOwnerId: 'u2' })
    })

    it('addMember sends POST', async () => {
      let body: any
      server.use(
        http.post(`${API_BASE_URL}/admin/teams/t1/members`, async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ ok: true })
        })
      )
      await api.admin.teams.addMember('t1', { userId: 'u3', role: 'member' })
      expect(body.userId).toBe('u3')
    })

    it('updateMember sends PUT', async () => {
      let body: any
      server.use(
        http.put(`${API_BASE_URL}/admin/teams/t1/members/u1`, async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ ok: true })
        })
      )
      await api.admin.teams.updateMember('t1', 'u1', { role: 'admin', tokenLimit: 1000 })
      expect(body.role).toBe('admin')
      expect(body.tokenLimit).toBe(1000)
    })

    it('removeMember sends DELETE', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/admin/teams/t1/members/u1`, () =>
          HttpResponse.json({ ok: true })
        )
      )
      const result = await api.admin.teams.removeMember('t1', 'u1')
      expect(result.ok).toBe(true)
    })
  })

  describe('sessions', () => {
    it('get fetches session by id', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/sessions/s1`, () => HttpResponse.json({ id: 's1' }))
      )
      const result = await api.admin.sessions.get('s1')
      expect(result.id).toBe('s1')
    })

    it('getEvents builds query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/admin/sessions/s1/events`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json({ events: [] })
        })
      )
      await api.admin.sessions.getEvents('s1', { limit: 50 })
      expect(capturedUrl).toContain('limit=50')
    })

    it('getTranscript fetches transcript', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/sessions/s1/transcript`, () =>
          HttpResponse.json({ transcript: [] })
        )
      )
      const result = await api.admin.sessions.getTranscript('s1')
      expect(result.transcript).toEqual([])
    })

    it('getLlmCalls builds query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/admin/sessions/s1/llm-calls`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )
      await api.admin.sessions.getLlmCalls('s1', { limit: 10, offset: 0 })
      expect(capturedUrl).toContain('limit=10')
    })

    it('forceEnd sends POST', async () => {
      server.use(
        http.post(`${API_BASE_URL}/admin/sessions/s1/force-end`, () =>
          HttpResponse.json({ ended: true })
        )
      )
      const result = await api.admin.sessions.forceEnd('s1')
      expect(result.ended).toBe(true)
    })

    it('recompute sends POST', async () => {
      server.use(
        http.post(`${API_BASE_URL}/admin/sessions/s1/recompute`, () =>
          HttpResponse.json({ ok: true })
        )
      )
      const result = await api.admin.sessions.recompute('s1')
      expect(result.ok).toBe(true)
    })

    it('delete sends DELETE', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/admin/sessions/s1`, () => HttpResponse.json({ deleted: true }))
      )
      const result = await api.admin.sessions.delete('s1')
      expect(result.deleted).toBe(true)
    })
  })

  describe('monitoring', () => {
    it('assessments builds query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/admin/monitoring/assessments`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )
      await api.admin.monitoring.assessments({ limit: 10, offset: 5 })
      expect(capturedUrl).toContain('limit=10')
      expect(capturedUrl).toContain('offset=5')
    })

    it('llm returns monitoring data', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/monitoring/llm`, () =>
          HttpResponse.json({ totalCalls: 100 })
        )
      )
      const result = await api.admin.monitoring.llm()
      expect(result.totalCalls).toBe(100)
    })

    it('jobs returns jobs data', async () => {
      server.use(
        http.get(`${API_BASE_URL}/admin/monitoring/jobs`, () => HttpResponse.json({ active: 2 }))
      )
      const result = await api.admin.monitoring.jobs()
      expect(result.active).toBe(2)
    })

    it('requestLogs builds query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(`${API_BASE_URL}/admin/monitoring/request-logs`, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )
      await api.admin.monitoring.requestLogs({ limit: 20 })
      expect(capturedUrl).toContain('limit=20')
    })
  })
})
