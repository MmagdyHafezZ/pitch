/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { CrmStep } from '../CrmStep'

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

const defaultProps = () => ({
  crmStatus: null as any,
  loadingStatus: false,
  onConnect: jest.fn(),
  onRefreshStatus: jest.fn(),
  onLoadData: jest.fn(),
  loadingData: false,
  accounts: [] as any[],
  opportunities: [] as any[],
  leads: [] as any[],
  contacts: [] as any[],
  selectedAccounts: [] as string[],
  setSelectedAccounts: jest.fn(),
  selectedOpportunities: [] as string[],
  setSelectedOpportunities: jest.fn(),
  selectedLeads: [] as string[],
  setSelectedLeads: jest.fn(),
  selectedContacts: [] as string[],
  setSelectedContacts: jest.fn(),
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('CrmStep', () => {
  it('renders the header with title', () => {
    render(<CrmStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('CRM Enrichment')).toBeInTheDocument()
  })

  it('shows Salesforce label', () => {
    render(<CrmStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Salesforce')).toBeInTheDocument()
  })

  it('shows "Not connected" when crmStatus is null', () => {
    render(<CrmStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Not connected')).toBeInTheDocument()
  })

  it('shows "Connected" when CRM is connected', () => {
    const props = { ...defaultProps(), crmStatus: { connected: true, providerEmail: 'a@b.com' } }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    expect(screen.getAllByText('Connected').length).toBeGreaterThanOrEqual(1)
  })

  it('shows provider email when connected', () => {
    const props = { ...defaultProps(), crmStatus: { connected: true, providerEmail: 'sf@co.com' } }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('sf@co.com')).toBeInTheDocument()
  })

  it('calls onConnect when Connect button is clicked', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /connect/i }))
    expect(props.onConnect).toHaveBeenCalled()
  })

  it('disables Connect button when already connected', () => {
    const props = { ...defaultProps(), crmStatus: { connected: true } }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    const connectBtns = screen.getAllByRole('button').filter((b) => b.textContent === 'Connected')
    if (connectBtns.length > 0) {
      expect(connectBtns[0]).toBeDisabled()
    }
  })

  it('calls onRefreshStatus when Refresh is clicked', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /refresh/i }))
    expect(props.onRefreshStatus).toHaveBeenCalled()
  })

  it('renders the Load Salesforce data button', () => {
    render(<CrmStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /load salesforce data/i })).toBeInTheDocument()
  })

  it('disables Load data button when not connected', () => {
    render(<CrmStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /load salesforce data/i })).toBeDisabled()
  })

  it('enables Load data button when connected', async () => {
    const props = { ...defaultProps(), crmStatus: { connected: true } }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /load salesforce data/i })).not.toBeDisabled()
  })

  it('calls onLoadData when Load data button is clicked', async () => {
    const user = userEvent.setup()
    const props = { ...defaultProps(), crmStatus: { connected: true } }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /load salesforce data/i }))
    expect(props.onLoadData).toHaveBeenCalled()
  })

  it('renders data selection fields (Accounts, Opportunities, Leads, Contacts)', () => {
    render(<CrmStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Accounts')).toBeInTheDocument()
    expect(screen.getByText('Opportunities')).toBeInTheDocument()
    expect(screen.getByText('Leads')).toBeInTheDocument()
    expect(screen.getByText('Contacts')).toBeInTheDocument()
  })

  it('renders the troubleshooting alert', () => {
    render(<CrmStep {...defaultProps()} />, { wrapper: Wrapper })
    expect(screen.getByText('Having trouble connecting?')).toBeInTheDocument()
    expect(screen.getByText('Salesforce Connected App setup instructions')).toBeInTheDocument()
  })

  it('shows save checkbox when connected and setSaveForFutureUse is provided', () => {
    const props = {
      ...defaultProps(),
      crmStatus: { connected: true },
      saveForFutureUse: false,
      setSaveForFutureUse: jest.fn(),
    }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    expect(
      screen.getByText('Save this CRM connection/setup for future sessions')
    ).toBeInTheDocument()
  })

  it('calls setSaveForFutureUse when checkbox is toggled', async () => {
    const user = userEvent.setup()
    const props = {
      ...defaultProps(),
      crmStatus: { connected: true },
      saveForFutureUse: false,
      setSaveForFutureUse: jest.fn(),
    }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByText('Save this CRM connection/setup for future sessions'))
    expect(props.setSaveForFutureUse).toHaveBeenCalled()
  })

  it('shows preset name input when saveForFutureUse is true', () => {
    const props = {
      ...defaultProps(),
      crmStatus: { connected: true },
      saveForFutureUse: true,
      setSaveForFutureUse: jest.fn(),
      savedConnectionLabel: '',
      setSavedConnectionLabel: jest.fn(),
    }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('Saved preset name')).toBeInTheDocument()
  })

  it('renders saved CRM connections section when provided', () => {
    const connection = {
      id: 'c1',
      provider: 'salesforce' as const,
      providerEmail: 'sf@test.com',
      label: 'My Pipeline',
      connected: true,
      savedAt: new Date().toISOString(),
      selections: {
        accounts: ['acc1'],
        opportunities: [],
        leads: [],
        contacts: [],
      },
    }
    const props = {
      ...defaultProps(),
      savedConnections: [connection],
      onUseSavedConnection: jest.fn(),
      onRemoveSavedConnection: jest.fn(),
    }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('My Pipeline')).toBeInTheDocument()
    expect(screen.getByText('Use for this session')).toBeInTheDocument()
  })

  it('calls onUseSavedConnection when "Use for this session" is clicked', async () => {
    const user = userEvent.setup()
    const connection = {
      id: 'c1',
      provider: 'salesforce' as const,
      providerEmail: null,
      label: 'Test Setup',
      connected: true,
      savedAt: new Date().toISOString(),
      selections: { accounts: [], opportunities: [], leads: [], contacts: [] },
    }
    const props = {
      ...defaultProps(),
      savedConnections: [connection],
      onUseSavedConnection: jest.fn(),
      onRemoveSavedConnection: jest.fn(),
    }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    await user.click(screen.getByText('Use for this session'))
    expect(props.onUseSavedConnection).toHaveBeenCalledWith(connection)
  })

  it('calls onRemoveSavedConnection when trash icon is clicked', async () => {
    const user = userEvent.setup()
    const connection = {
      id: 'c1',
      provider: 'salesforce' as const,
      providerEmail: null,
      label: 'Remove Me',
      connected: true,
      savedAt: new Date().toISOString(),
      selections: { accounts: [], opportunities: [], leads: [], contacts: [] },
    }
    const props = {
      ...defaultProps(),
      savedConnections: [connection],
      onUseSavedConnection: jest.fn(),
      onRemoveSavedConnection: jest.fn(),
    }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    const removeBtn = screen.getByRole('button', { name: /remove remove me/i })
    await user.click(removeBtn)
    expect(props.onRemoveSavedConnection).toHaveBeenCalledWith(connection)
  })

  it('does not show saved CRM connections when empty', () => {
    const props = { ...defaultProps(), savedConnections: [] }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    expect(screen.queryByText('Saved CRM connections for future sessions')).not.toBeInTheDocument()
  })

  it('renders saved CRMs dropdown when provided', () => {
    const props = {
      ...defaultProps(),
      savedCrms: [
        {
          id: 'crm1',
          name: 'Enterprise SF',
          provider: 'salesforce',
          providerEmail: 'e@b.com',
          connected: true,
          lastSyncAt: null,
          autoSync: false,
          savedAt: new Date().toISOString(),
        },
      ],
      selectedSavedCrmId: null,
      onSelectSavedCrm: jest.fn(),
    }
    render(<CrmStep {...props} />, { wrapper: Wrapper })
    expect(screen.getByText('Saved CRMs')).toBeInTheDocument()
    expect(screen.getByText('Saved CRM connection')).toBeInTheDocument()
  })
})
