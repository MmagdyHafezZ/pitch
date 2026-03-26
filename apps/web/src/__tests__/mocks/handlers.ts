import { http, HttpResponse } from 'msw'

// Mock API endpoints
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
const API_ROOT_URL = API_BASE_URL.replace(/\/v\d+$/, '')

export const handlers = [
  // Auth endpoints
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }

    // Mock successful login
    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        accessToken: 'mock-jwt-token',
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
          hasStudioAccess: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      })
    }

    // Mock failed login
    return new HttpResponse(JSON.stringify({ message: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }),

  http.post(`${API_BASE_URL}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string; name: string }

    // Mock successful registration
    if (body.email && body.password && body.name) {
      return HttpResponse.json({
        accessToken: 'mock-jwt-token',
        user: {
          id: '2',
          email: body.email,
          name: body.name,
          isActive: true,
          hasStudioAccess: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    }

    // Mock validation error
    return new HttpResponse(JSON.stringify({ message: 'Validation failed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }),

  http.post(`${API_BASE_URL}/auth/logout`, () => {
    return HttpResponse.json({ message: 'Logged out successfully' })
  }),

  http.get(`${API_BASE_URL}/auth/me`, ({ request }) => {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (token === 'mock-jwt-token') {
      return HttpResponse.json({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        hasStudioAccess: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      })
    }

    return new HttpResponse(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }),

  http.post(`${API_BASE_URL}/auth/refresh`, () => {
    return HttpResponse.json({
      accessToken: 'new-mock-jwt-token',
    })
  }),

  // Business endpoints (placeholder)
  http.get(`${API_BASE_URL}/businesses`, ({ request }) => {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return new HttpResponse(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return HttpResponse.json([
      {
        id: '1',
        name: 'Test Business',
        description: 'A test business',
        userId: '1',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ])
  }),

  // LLM Providers endpoint
  http.get(`${API_BASE_URL}/simulation/llm/providers`, () => {
    return HttpResponse.json({
      providers: [
        {
          name: 'openai',
          enabled: true,
          models: ['gpt-4o', 'gpt-4o-mini'],
          modelDetails: [
            {
              name: 'gpt-4o',
              pricing: {
                inputTokensPerMillion: 5.0,
                outputTokensPerMillion: 15.0,
              },
              maxTokens: 128000,
              maxOutputTokens: 4096,
              supportsStreaming: true,
              supportsTools: true,
              supportsVision: true,
              supportsAudio: false,
              supportedModalities: ['text', 'image'],
            },
            {
              name: 'gpt-4o-mini',
              pricing: {
                inputTokensPerMillion: 0.15,
                outputTokensPerMillion: 0.6,
              },
              maxTokens: 128000,
              maxOutputTokens: 4096,
              supportsStreaming: true,
              supportsTools: true,
              supportsVision: true,
              supportsAudio: false,
              supportedModalities: ['text', 'image'],
            },
          ],
        },
        {
          name: 'watsonx',
          enabled: true,
          models: ['granite-13b'],
          modelDetails: [
            {
              name: 'granite-13b',
              pricing: {
                inputTokensPerMillion: 0,
                outputTokensPerMillion: 0,
              },
              maxTokens: 8192,
              maxOutputTokens: 2048,
              supportsStreaming: false,
              supportsTools: false,
              supportsVision: false,
              supportsAudio: false,
              supportedModalities: ['text'],
            },
          ],
        },
      ],
    })
  }),

  // Personas endpoint
  http.get(`${API_BASE_URL}/simulation/personas`, () => {
    return HttpResponse.json({
      personas: [
        {
          id: 'persona_1',
          name: 'Sales Coach',
          orgId: 'org_123',
          traits: {
            role: 'coach',
            level: 'expert',
            personality: 'encouraging',
          },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'persona_2',
          name: 'Product Manager',
          orgId: 'org_123',
          traits: {
            role: 'manager',
            level: 'senior',
            personality: 'analytical',
          },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      total: 2,
    })
  }),

  http.post(`${API_BASE_URL}/simulation/personas`, async ({ request }) => {
    const body = (await request.json()) as {
      orgId: string
      name: string
      traits?: Record<string, unknown>
    }

    return HttpResponse.json({
      id: 'persona_created',
      orgId: body.orgId,
      name: body.name,
      traits: body.traits ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }),

  // Scenarios endpoint
  http.get(`${API_BASE_URL}/simulation/scenarios`, () => {
    return HttpResponse.json({
      scenarios: [
        {
          id: 'scenario_1',
          name: 'Discovery Call',
          description: 'Qualify the lead and uncover core business pain points.',
        },
        {
          id: 'scenario_2',
          name: 'Pricing Discussion',
          description: 'Handle pricing objections while reinforcing value.',
        },
      ],
    })
  }),

  // TTS Providers endpoint
  http.get(`${API_BASE_URL}/tts/providers`, () => {
    return HttpResponse.json([
      {
        name: 'elevenlabs',
        description: 'ElevenLabs',
        voices: ['Rachel', 'Adam', 'Sarah'],
        models: [],
      },
      {
        name: 'melotts',
        description: 'MeloTTS',
        voices: ['EN-US-1', 'EN-GB-1'],
        models: [],
      },
      {
        name: 'openai',
        description: 'OpenAI text-to-speech',
        voices: ['alloy', 'ash', 'coral'],
        models: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
      },
    ])
  }),

  // Teams endpoint
  http.get(`${API_BASE_URL}/teams/user-teams`, () => {
    return HttpResponse.json([
      {
        id: 'team_1',
        name: 'Test Team',
        orgId: 'org_123',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ])
  }),

  // User settings endpoints
  http.get(`${API_BASE_URL}/users/me/settings`, () => {
    return HttpResponse.json({})
  }),

  http.put(`${API_BASE_URL}/users/me/settings`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(body ?? {})
  }),

  http.put(`${API_BASE_URL}/users/me/avatar`, () => {
    return HttpResponse.json({
      avatar: 'https://cdn.example.com/mock-avatar.png',
    })
  }),

  // Sessions endpoint
  http.post(`${API_BASE_URL}/simulation/sessions`, async ({ request }) => {
    const body = (await request.json()) as any

    return HttpResponse.json({
      id: 'session_123',
      ...body,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }),

  http.get(`${API_BASE_URL}/simulation/sessions`, () => {
    return HttpResponse.json({
      sessions: [],
      total: 0,
      limit: 10,
      offset: 0,
    })
  }),

  // CRM endpoints
  http.get(`${API_ROOT_URL}/crm/salesforce/status`, () => {
    return HttpResponse.json({
      connected: false,
      status: 'disconnected',
      provider: 'salesforce',
    })
  }),
]
