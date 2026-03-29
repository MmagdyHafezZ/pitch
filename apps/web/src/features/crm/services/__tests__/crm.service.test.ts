import { CrmService } from '../crm.service'
import { api } from '@/lib/client'

jest.mock('@/lib/client', () => ({
  api: {
    crm: {
      salesforce: {
        connect: jest.fn(),
        status: jest.fn(),
        accounts: jest.fn(),
        opportunities: jest.fn(),
        leads: jest.fn(),
        contacts: jest.fn(),
      },
    },
  },
}))

const mocked = api.crm.salesforce as jest.Mocked<typeof api.crm.salesforce>

beforeEach(() => jest.clearAllMocks())

describe('CrmService', () => {
  it('connectSalesforce delegates to api', async () => {
    mocked.connect.mockResolvedValue({ authUrl: 'https://sf.com/auth' })
    const result = await CrmService.connectSalesforce()
    expect(mocked.connect).toHaveBeenCalled()
    expect(result).toEqual({ authUrl: 'https://sf.com/auth' })
  })

  it('getSalesforceStatus delegates to api', async () => {
    mocked.status.mockResolvedValue({ connected: true })
    const result = await CrmService.getSalesforceStatus()
    expect(mocked.status).toHaveBeenCalled()
    expect(result.connected).toBe(true)
  })

  it('getSalesforceAccounts delegates with default limit', async () => {
    mocked.accounts.mockResolvedValue([{ id: 'a1' }])
    const result = await CrmService.getSalesforceAccounts()
    expect(mocked.accounts).toHaveBeenCalledWith(50)
    expect(result).toEqual([{ id: 'a1' }])
  })

  it('getSalesforceAccounts forwards custom limit', async () => {
    mocked.accounts.mockResolvedValue([])
    await CrmService.getSalesforceAccounts(10)
    expect(mocked.accounts).toHaveBeenCalledWith(10)
  })

  it('getSalesforceOpportunities delegates with default limit', async () => {
    mocked.opportunities.mockResolvedValue([{ id: 'o1' }])
    const result = await CrmService.getSalesforceOpportunities()
    expect(mocked.opportunities).toHaveBeenCalledWith(50)
    expect(result).toEqual([{ id: 'o1' }])
  })

  it('getSalesforceOpportunities forwards custom limit', async () => {
    mocked.opportunities.mockResolvedValue([])
    await CrmService.getSalesforceOpportunities(25)
    expect(mocked.opportunities).toHaveBeenCalledWith(25)
  })

  it('getSalesforceLeads delegates with default limit', async () => {
    mocked.leads.mockResolvedValue([{ id: 'l1' }])
    const result = await CrmService.getSalesforceLeads()
    expect(mocked.leads).toHaveBeenCalledWith(50)
    expect(result).toEqual([{ id: 'l1' }])
  })

  it('getSalesforceLeads forwards custom limit', async () => {
    mocked.leads.mockResolvedValue([])
    await CrmService.getSalesforceLeads(5)
    expect(mocked.leads).toHaveBeenCalledWith(5)
  })

  it('getSalesforceContacts delegates with default limit', async () => {
    mocked.contacts.mockResolvedValue([{ id: 'c1' }])
    const result = await CrmService.getSalesforceContacts()
    expect(mocked.contacts).toHaveBeenCalledWith(50)
    expect(result).toEqual([{ id: 'c1' }])
  })

  it('getSalesforceContacts forwards custom limit', async () => {
    mocked.contacts.mockResolvedValue([])
    await CrmService.getSalesforceContacts(100)
    expect(mocked.contacts).toHaveBeenCalledWith(100)
  })

  it('propagates errors from the api layer', async () => {
    mocked.status.mockRejectedValue(new Error('Network error'))
    await expect(CrmService.getSalesforceStatus()).rejects.toThrow('Network error')
  })
})
