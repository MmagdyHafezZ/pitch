/**
 * @jest-environment jsdom
 */
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { server } from '@/__tests__/mocks/server'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { API_CONFIG } from '@/lib/client'
import { useI18n } from '../I18nProvider'

function I18nHarness() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div>
      <div data-testid="direct-translation">{t('nav.sessions')}</div>
      <div data-testid="raw-phrase">Create Session</div>
      <input placeholder="Search sessions" />
      <div data-testid="active-locale">{locale}</div>
      <button type="button" onClick={() => setLocale('es-ES')}>
        Switch locale
      </button>
    </div>
  )
}

describe('I18nProvider', () => {
  let originalLocalStorage: Storage

  beforeEach(() => {
    originalLocalStorage = window.localStorage

    useAuthStore.setState({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        settings: {
          language: {
            locale: 'en-US',
          },
        },
      },
      token: 'mock-jwt-token',
      isAuthenticated: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    })
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    })
  })

  it('persists locale changes and retranslates direct and static DOM content', async () => {
    const requests: Array<Record<string, unknown>> = []
    const localStorageMock = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    }

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    })
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    })

    server.use(
      http.put(`${API_CONFIG.baseURL}/users/me/settings`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        requests.push(body)
        return HttpResponse.json(body.settings ?? {})
      })
    )

    const user = userEvent.setup()

    render(<I18nHarness />)

    expect(await screen.findByTestId('direct-translation')).toHaveTextContent('Sessions')
    expect(screen.getByTestId('raw-phrase')).toHaveTextContent('Create Session')
    expect(screen.getByPlaceholderText('Search sessions')).toBeInTheDocument()
    expect(screen.getByTestId('active-locale')).toHaveTextContent('en-US')

    await user.click(screen.getByRole('button', { name: 'Switch locale' }))

    await waitFor(() => {
      expect(screen.getByTestId('direct-translation')).toHaveTextContent('Sesiones')
    })
    await waitFor(() => {
      expect(screen.getByTestId('raw-phrase')).toHaveTextContent('Crear sesión')
    })
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Buscar sesiones')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(requests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            settings: expect.objectContaining({
              language: expect.objectContaining({
                locale: 'es-ES',
              }),
            }),
          }),
        ])
      )
    })

    expect(screen.getByTestId('active-locale')).toHaveTextContent('es-ES')
    expect(document.documentElement.lang).toBe('es-ES')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('pitch.app.locale', 'es-ES')
    expect(useAuthStore.getState().user?.settings?.language?.locale).toBe('es-ES')
  })
})
