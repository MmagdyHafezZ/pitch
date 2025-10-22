import { http, HttpResponse } from 'msw'

// Mock API endpoints
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export const handlers = [
  // Auth endpoints
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }

    // Mock successful login
    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
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
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: '2',
          email: body.email,
          name: body.name,
          isActive: true,
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
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      })
    }

    return new HttpResponse(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }),

  http.post(`${API_BASE_URL}/auth/refresh`, async ({ request }) => {
    const body = (await request.json()) as { refreshToken: string }

    if (body.refreshToken === 'mock-refresh-token') {
      return HttpResponse.json({
        token: 'new-mock-jwt-token',
        refreshToken: 'new-mock-refresh-token',
      })
    }

    return new HttpResponse(JSON.stringify({ message: 'Invalid refresh token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
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
]
