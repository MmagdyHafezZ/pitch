/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockSearchParamsGet = jest.fn().mockReturnValue(null)

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: jest.fn().mockReturnValue(''),
  }),
  useParams: () => ({ id: 'session-789' }),
}))

jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn(), clean: jest.fn() },
}))

jest.mock('@mantine/charts', () => ({
  BarChart: (props: any) => <div data-testid="mantine-bar-chart">BarChart</div>,
}))

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="recharts-bar-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  Bar: ({ children }: any) => <div data-testid="bar">{children}</div>,
  Pie: ({ children }: any) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}))

const mockApi = {
  assessments: {
    run: jest.fn(),
    getRunStatus: jest.fn(),
    getLatestForSession: jest.fn(),
    getReport: jest.fn(),
  },
  sessions: {
    restart: jest.fn(),
  },
}

jest.mock('@/lib/client', () => ({
  api: mockApi,
}))

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      <MantineProvider>{children}</MantineProvider>
    </QueryClientProvider>
  )
}

const mockCompletedAssessment = {
  runId: 'run-001',
  status: 'completed' as const,
  mode: 'final',
  totalScore: 12,
  createdAt: '2026-03-20T10:00:00Z',
  completedAt: '2026-03-20T10:05:00Z',
  summary: {
    totalScore: 12,
    scoreBreakdown: {
      PositiveExample: 3,
      NegativeExample: 1,
      InsightfulQuestion: 2,
    },
    narrativeSummary: 'You performed well overall with strong questioning.',
    coachTips: [{ text: 'Ask more open-ended questions' }, { text: 'Focus on concrete examples' }],
  },
}

const mockReport = {
  totalScore: 12,
  scoreBreakdown: {
    PositiveExample: 3,
    NegativeExample: 1,
    InsightfulQuestion: 2,
  },
  summary: {
    narrativeSummary: 'You performed well overall with strong questioning.',
    coachTips: [{ text: 'Ask more open-ended questions' }, { text: 'Focus on concrete examples' }],
    objectiveMet: true,
  },
  turnAnnotations: [
    {
      turnId: 'turn-1',
      role: 'user',
      text: 'Let me tell you about our solution.',
      label: 'PositiveExample',
      confidence: 0.85,
      scoreDelta: 2,
      reasonSummary: 'Strong opening with value prop.',
    },
    {
      turnId: 'turn-2',
      role: 'user',
      text: 'We reduce costs by 40%.',
      label: 'PositiveExample',
      confidence: 0.9,
      scoreDelta: 2.5,
      reasonSummary: 'Backed by concrete data.',
    },
    {
      turnId: 'turn-3',
      role: 'user',
      text: 'Um, well, I think maybe...',
      label: 'NegativeExample',
      confidence: 0.7,
      scoreDelta: -1.5,
      reasonSummary: 'Vague and uncertain phrasing.',
    },
    {
      turnId: 'turn-4',
      role: 'user',
      text: 'What security concerns do you have?',
      label: 'InsightfulQuestion',
      confidence: 0.95,
      scoreDelta: 3,
      reasonSummary: 'Excellent probing question.',
    },
  ],
  conversationHistory: [
    {
      turnId: 'turn-1',
      role: 'user',
      text: 'Let me tell you about our solution.',
      createdAt: '2026-03-20T10:01:00Z',
    },
    {
      turnId: 'turn-1a',
      role: 'assistant',
      text: 'Go ahead, I am listening.',
      createdAt: '2026-03-20T10:01:10Z',
    },
    {
      turnId: 'turn-2',
      role: 'user',
      text: 'We reduce costs by 40%.',
      createdAt: '2026-03-20T10:02:00Z',
    },
    {
      turnId: 'turn-3',
      role: 'user',
      text: 'Um, well, I think maybe...',
      createdAt: '2026-03-20T10:03:00Z',
    },
    {
      turnId: 'turn-4',
      role: 'user',
      text: 'What security concerns do you have?',
      createdAt: '2026-03-20T10:04:00Z',
    },
  ],
  chunks: [
    { chunkIndex: 0, turnIds: ['turn-1', 'turn-2'], summary: 'Opening and value proposition.' },
    { chunkIndex: 1, turnIds: ['turn-3', 'turn-4'], summary: 'Hesitation then recovery.' },
  ],
}

let SessionPerformancePage: any

beforeAll(async () => {
  const mod = await import('../page')
  SessionPerformancePage = mod.default
})

beforeEach(() => {
  jest.clearAllMocks()
  mockSearchParamsGet.mockReturnValue(null)
})

describe('SessionPerformancePage', () => {
  describe('loading state', () => {
    it('shows loading screen while assessment is not yet available', async () => {
      mockApi.assessments.getLatestForSession.mockReturnValue(new Promise(() => {}))

      render(<SessionPerformancePage />, { wrapper: Wrapper })

      expect(screen.getByText('Preparing your analytics')).toBeInTheDocument()
      expect(screen.getByText(/Connecting to the assessment service/)).toBeInTheDocument()
    })

    it('shows "Assessment queued" when status is queued', async () => {
      mockApi.assessments.getLatestForSession.mockResolvedValue({
        runId: 'run-001',
        status: 'queued',
      })

      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Assessment queued')).toBeInTheDocument()
      })
    })

    it('shows "Analyzing your performance" when status is running', async () => {
      mockApi.assessments.getLatestForSession.mockResolvedValue({
        runId: 'run-001',
        status: 'running',
        progress: { stage: 'scoring', percent: 45 },
      })

      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Analyzing your performance')).toBeInTheDocument()
      })
    })
  })

  describe('completed assessment', () => {
    beforeEach(() => {
      mockApi.assessments.getLatestForSession.mockResolvedValue(mockCompletedAssessment)
      mockApi.assessments.getReport.mockResolvedValue({ report: mockReport })
    })

    it('renders session analytics title', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        const titles = screen.getAllByText('Session Analytics')
        expect(titles.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('renders Performance Overview card', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Performance Overview')).toBeInTheDocument()
      })
    })

    it('displays the overall score', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('12')).toBeInTheDocument()
      })
    })

    it('shows Completed badge', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument()
      })
    })

    it('shows Final assessment badge', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Final assessment')).toBeInTheDocument()
      })
    })

    it('displays narrative summary', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(
          screen.getByText('You performed well overall with strong questioning.')
        ).toBeInTheDocument()
      })
    })

    it('shows Objective met badge', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Objective met')).toBeInTheDocument()
      })
    })

    it('displays coach tips', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText(/Ask more open-ended questions/)).toBeInTheDocument()
        expect(screen.getByText(/Focus on concrete examples/)).toBeInTheDocument()
      })
    })

    it('shows evaluated turn count', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText(/4 evaluated turns/)).toBeInTheDocument()
      })
    })

    it('renders score impact chart', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Score impact by competency')).toBeInTheDocument()
      })
    })

    it('renders move grades section', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Move grades')).toBeInTheDocument()
      })
    })

    it('renders Score per turn chart card', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Score per turn')).toBeInTheDocument()
      })
    })

    it('renders Turn momentum chart card', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Turn momentum')).toBeInTheDocument()
      })
    })

    it('renders conversation history tab', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Conversation')).toBeInTheDocument()
      })
    })

    it('renders Strengths tab', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Strengths')).toBeInTheDocument()
      })
    })

    it('renders Improvement Plan tab', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Improvement Plan')).toBeInTheDocument()
      })
    })

    it('renders conversation history with turn count', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Conversation history')).toBeInTheDocument()
        expect(screen.getByText('5 turns')).toBeInTheDocument()
      })
    })

    it('renders chunk summaries', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Chunk summaries')).toBeInTheDocument()
        expect(screen.getByText('Opening and value proposition.')).toBeInTheDocument()
        expect(screen.getByText('Hesitation then recovery.')).toBeInTheDocument()
      })
    })

    it('displays avg confidence card', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Avg confidence')).toBeInTheDocument()
      })
    })

    it('displays net momentum card', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Net momentum')).toBeInTheDocument()
      })
    })
  })

  describe('error state', () => {
    it('shows error alert when assessment loading fails', async () => {
      mockApi.assessments.getLatestForSession.mockRejectedValue(new Error('Server Error'))

      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics')).toBeInTheDocument()
      })
    })
  })

  describe('failed assessment', () => {
    it('shows failure alert when assessment status is failed', async () => {
      mockApi.assessments.getLatestForSession.mockResolvedValue({
        runId: 'run-fail',
        status: 'failed',
      })

      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Assessment failed')).toBeInTheDocument()
        expect(
          screen.getByText('The analytics run did not complete. Please retry.')
        ).toBeInTheDocument()
      })
    })
  })

  describe('cancelled assessment', () => {
    it('shows cancelled alert when assessment is cancelled', async () => {
      mockApi.assessments.getLatestForSession.mockResolvedValue({
        runId: 'run-cancel',
        status: 'cancelled',
      })

      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Assessment cancelled')).toBeInTheDocument()
        expect(
          screen.getByText('This analytics run was cancelled before completion.')
        ).toBeInTheDocument()
      })
    })
  })

  describe('navigation buttons', () => {
    beforeEach(() => {
      mockApi.assessments.getLatestForSession.mockResolvedValue(mockCompletedAssessment)
      mockApi.assessments.getReport.mockResolvedValue({ report: mockReport })
    })

    it('renders Back to sessions button', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Back to sessions')).toBeInTheDocument()
      })
    })

    it('navigates to sessions list on back button click', async () => {
      const user = userEvent.setup()
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Back to sessions')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Back to sessions'))
      expect(mockPush).toHaveBeenCalledWith('/studio/sessions')
    })

    it('renders Retake session button', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Retake session')).toBeInTheDocument()
      })
    })

    it('renders Recalculate button', async () => {
      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Recalculate')).toBeInTheDocument()
      })
    })

    it('calls restart API and redirects on Retake click', async () => {
      mockApi.sessions.restart.mockResolvedValue({})
      const user = userEvent.setup()

      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Retake session')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Retake session'))

      await waitFor(() => {
        expect(mockApi.sessions.restart).toHaveBeenCalledWith('session-789', {
          reason: 'restart_from_scratch',
        })
      })
      expect(mockPush).toHaveBeenCalledWith('/session/session-789?entry=retake')
    })

    it('calls recalculate API on Recalculate click', async () => {
      mockApi.assessments.run.mockResolvedValue({ runId: 'new-run-001' })
      const user = userEvent.setup()

      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(screen.getByText('Recalculate')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Recalculate'))

      await waitFor(() => {
        expect(mockApi.assessments.run).toHaveBeenCalledWith({
          sessionId: 'session-789',
          mode: 'final',
          forceRecalculate: true,
        })
      })
    })
  })

  describe('with runId from query', () => {
    it('uses runId from URL params when available', async () => {
      mockSearchParamsGet.mockReturnValue('run-specific-123')
      mockApi.assessments.getRunStatus.mockResolvedValue({
        ...mockCompletedAssessment,
        runId: 'run-specific-123',
      })
      mockApi.assessments.getReport.mockResolvedValue({ report: mockReport })

      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(mockApi.assessments.getRunStatus).toHaveBeenCalledWith('run-specific-123')
      })
    })
  })

  describe('no assessment triggers live run', () => {
    it('triggers a live assessment run when 404 is returned', async () => {
      const notFoundError: any = new Error('Not found')
      notFoundError.response = { status: 404 }
      mockApi.assessments.getLatestForSession.mockRejectedValue(notFoundError)
      mockApi.assessments.run.mockResolvedValue({ runId: 'new-live-run' })

      render(<SessionPerformancePage />, { wrapper: Wrapper })

      await waitFor(() => {
        expect(mockApi.assessments.run).toHaveBeenCalledWith({
          sessionId: 'session-789',
          mode: 'live',
        })
      })
    })
  })
})
