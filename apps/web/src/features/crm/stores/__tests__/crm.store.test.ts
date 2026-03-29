import { act } from '@testing-library/react'
import { useCrmStore } from '../crm.store'
import { CrmService } from '../../services/crm.service'
import type { CrmStatus } from '../../types/crm.types'

const makeStatus = (overrides: Partial<CrmStatus> = {}): CrmStatus => ({
  connected: true,
  status: 'connected',
  provider: 'salesforce',
  ...overrides,
})

const resetStore = () => {
  act(() => {
    useCrmStore.setState({
      status: null,
      statusCheckedAt: null,
      loadingStatus: false,
      loadingData: false,
      error: null,
      accounts: [],
      opportunities: [],
      leads: [],
      contacts: [],
    })
  })
}

describe('CrmStore', () => {
  beforeEach(() => {
    resetStore()
    jest.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useCrmStore.getState()

      expect(state.status).toBeNull()
      expect(state.statusCheckedAt).toBeNull()
      expect(state.loadingStatus).toBe(false)
      expect(state.loadingData).toBe(false)
      expect(state.error).toBeNull()
      expect(state.accounts).toEqual([])
      expect(state.opportunities).toEqual([])
      expect(state.leads).toEqual([])
      expect(state.contacts).toEqual([])
    })
  })

  describe('fetchStatus', () => {
    it('should fetch status and update state on success', async () => {
      const status = makeStatus()
      jest.spyOn(CrmService, 'getSalesforceStatus').mockResolvedValueOnce(status)

      await act(async () => {
        await useCrmStore.getState().fetchStatus()
      })

      const state = useCrmStore.getState()
      expect(state.status).toEqual(status)
      expect(state.statusCheckedAt).not.toBeNull()
      expect(state.loadingStatus).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should not re-fetch if cache is still fresh', async () => {
      const spy = jest.spyOn(CrmService, 'getSalesforceStatus').mockResolvedValueOnce(makeStatus())

      // First fetch
      await act(async () => {
        await useCrmStore.getState().fetchStatus()
      })

      expect(spy).toHaveBeenCalledTimes(1)

      // Second fetch immediately — should skip due to TTL
      await act(async () => {
        await useCrmStore.getState().fetchStatus()
      })

      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('should re-fetch when force=true even if cache is fresh', async () => {
      const spy = jest.spyOn(CrmService, 'getSalesforceStatus').mockResolvedValue(makeStatus())

      await act(async () => {
        await useCrmStore.getState().fetchStatus()
      })

      await act(async () => {
        await useCrmStore.getState().fetchStatus(true)
      })

      expect(spy).toHaveBeenCalledTimes(2)
    })

    it('should skip fetch if loadingStatus is already true', async () => {
      act(() => {
        useCrmStore.setState({ loadingStatus: true })
      })

      const spy = jest.spyOn(CrmService, 'getSalesforceStatus')

      await act(async () => {
        await useCrmStore.getState().fetchStatus()
      })

      expect(spy).not.toHaveBeenCalled()
    })

    it('should set error and clear status when fetch fails', async () => {
      jest
        .spyOn(CrmService, 'getSalesforceStatus')
        .mockRejectedValueOnce(new Error('CRM unavailable'))

      await act(async () => {
        await useCrmStore.getState().fetchStatus()
      })

      const state = useCrmStore.getState()
      expect(state.status).toBeNull()
      expect(state.error).toBe('CRM unavailable')
      expect(state.loadingStatus).toBe(false)
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(CrmService, 'getSalesforceStatus').mockRejectedValueOnce('bad')

      await act(async () => {
        await useCrmStore.getState().fetchStatus()
      })

      expect(useCrmStore.getState().error).toBe('Failed to load CRM status')
    })

    it('should fetch again when cache has expired', async () => {
      const spy = jest.spyOn(CrmService, 'getSalesforceStatus').mockResolvedValue(makeStatus())

      // Set an old timestamp (> 5 minutes ago)
      const oldTime = new Date(Date.now() - 1000 * 60 * 6).toISOString()
      act(() => {
        useCrmStore.setState({ status: makeStatus(), statusCheckedAt: oldTime })
      })

      await act(async () => {
        await useCrmStore.getState().fetchStatus()
      })

      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('connect', () => {
    it('should return authUrl on successful connect', async () => {
      const authResponse = { authUrl: 'https://oauth.salesforce.com/authorize?...' }
      jest.spyOn(CrmService, 'connectSalesforce').mockResolvedValueOnce(authResponse)

      let result: { authUrl?: string } | null | undefined
      await act(async () => {
        result = await useCrmStore.getState().connect()
      })

      expect(result).toEqual(authResponse)
      expect(useCrmStore.getState().error).toBeNull()
    })

    it('should return null and set error when connect fails', async () => {
      jest.spyOn(CrmService, 'connectSalesforce').mockRejectedValueOnce(new Error('OAuth error'))

      let result: { authUrl?: string } | null | undefined
      await act(async () => {
        result = await useCrmStore.getState().connect()
      })

      expect(result).toBeNull()
      expect(useCrmStore.getState().error).toBe('OAuth error')
    })

    it('should fallback error for non-Error throw', async () => {
      jest.spyOn(CrmService, 'connectSalesforce').mockRejectedValueOnce(undefined)

      await act(async () => {
        await useCrmStore.getState().connect()
      })

      expect(useCrmStore.getState().error).toBe('Failed to connect CRM')
    })
  })

  describe('loadData', () => {
    it('should skip loading if status is not connected', async () => {
      act(() => {
        useCrmStore.setState({ status: { connected: false }, loadingData: false })
      })

      const spy = jest.spyOn(CrmService, 'getSalesforceAccounts')

      await act(async () => {
        await useCrmStore.getState().loadData()
      })

      expect(spy).not.toHaveBeenCalled()
    })

    it('should skip loading if already loading', async () => {
      act(() => {
        useCrmStore.setState({ status: { connected: true }, loadingData: true })
      })

      const spy = jest.spyOn(CrmService, 'getSalesforceAccounts')

      await act(async () => {
        await useCrmStore.getState().loadData()
      })

      expect(spy).not.toHaveBeenCalled()
    })

    it('should load all CRM data and map to CrmOption format', async () => {
      act(() => {
        useCrmStore.setState({ status: { connected: true }, loadingData: false })
      })

      jest
        .spyOn(CrmService, 'getSalesforceAccounts')
        .mockResolvedValueOnce([{ Id: 'acc_1', Name: 'Acme Corp' }])
      jest
        .spyOn(CrmService, 'getSalesforceOpportunities')
        .mockResolvedValueOnce([{ Id: 'opp_1', Name: 'Big Deal', StageName: 'Proposal' }])
      jest
        .spyOn(CrmService, 'getSalesforceLeads')
        .mockResolvedValueOnce([{ Id: 'lead_1', FirstName: 'John', LastName: 'Doe' }])
      jest
        .spyOn(CrmService, 'getSalesforceContacts')
        .mockResolvedValueOnce([
          { Id: 'contact_1', FirstName: 'Jane', LastName: 'Smith', Email: 'jane@example.com' },
        ])

      await act(async () => {
        await useCrmStore.getState().loadData()
      })

      const state = useCrmStore.getState()
      expect(state.accounts).toEqual([{ value: 'acc_1', label: 'Acme Corp' }])
      expect(state.opportunities).toEqual([{ value: 'opp_1', label: 'Big Deal • Proposal' }])
      expect(state.leads).toEqual([{ value: 'lead_1', label: 'John Doe' }])
      expect(state.contacts).toEqual([{ value: 'contact_1', label: 'Jane Smith' }])
      expect(state.loadingData).toBe(false)
    })

    it('should use id field when Id is not available', async () => {
      act(() => {
        useCrmStore.setState({ status: { connected: true }, loadingData: false })
      })

      jest
        .spyOn(CrmService, 'getSalesforceAccounts')
        .mockResolvedValueOnce([{ id: 'acc_2', Name: 'Beta Inc' }])
      jest.spyOn(CrmService, 'getSalesforceOpportunities').mockResolvedValueOnce([])
      jest.spyOn(CrmService, 'getSalesforceLeads').mockResolvedValueOnce([])
      jest.spyOn(CrmService, 'getSalesforceContacts').mockResolvedValueOnce([])

      await act(async () => {
        await useCrmStore.getState().loadData()
      })

      expect(useCrmStore.getState().accounts).toEqual([{ value: 'acc_2', label: 'Beta Inc' }])
    })

    it('should use opportunity id as label when Name is missing', async () => {
      act(() => {
        useCrmStore.setState({ status: { connected: true } })
      })

      jest.spyOn(CrmService, 'getSalesforceAccounts').mockResolvedValueOnce([])
      jest.spyOn(CrmService, 'getSalesforceOpportunities').mockResolvedValueOnce([{ Id: 'opp_2' }])
      jest.spyOn(CrmService, 'getSalesforceLeads').mockResolvedValueOnce([])
      jest.spyOn(CrmService, 'getSalesforceContacts').mockResolvedValueOnce([])

      await act(async () => {
        await useCrmStore.getState().loadData()
      })

      expect(useCrmStore.getState().opportunities).toEqual([{ value: 'opp_2', label: 'opp_2' }])
    })

    it('should use lead company name when names are missing', async () => {
      act(() => {
        useCrmStore.setState({ status: { connected: true } })
      })

      jest.spyOn(CrmService, 'getSalesforceAccounts').mockResolvedValueOnce([])
      jest.spyOn(CrmService, 'getSalesforceOpportunities').mockResolvedValueOnce([])
      jest
        .spyOn(CrmService, 'getSalesforceLeads')
        .mockResolvedValueOnce([{ Id: 'lead_2', Company: 'Widgets LLC' }])
      jest.spyOn(CrmService, 'getSalesforceContacts').mockResolvedValueOnce([])

      await act(async () => {
        await useCrmStore.getState().loadData()
      })

      expect(useCrmStore.getState().leads).toEqual([{ value: 'lead_2', label: 'Widgets LLC' }])
    })

    it('should use contact email when names are missing', async () => {
      act(() => {
        useCrmStore.setState({ status: { connected: true } })
      })

      jest.spyOn(CrmService, 'getSalesforceAccounts').mockResolvedValueOnce([])
      jest.spyOn(CrmService, 'getSalesforceOpportunities').mockResolvedValueOnce([])
      jest.spyOn(CrmService, 'getSalesforceLeads').mockResolvedValueOnce([])
      jest
        .spyOn(CrmService, 'getSalesforceContacts')
        .mockResolvedValueOnce([{ Id: 'contact_2', Email: 'noname@example.com' }])

      await act(async () => {
        await useCrmStore.getState().loadData()
      })

      expect(useCrmStore.getState().contacts).toEqual([
        { value: 'contact_2', label: 'noname@example.com' },
      ])
    })

    it('should set error when loadData fails', async () => {
      act(() => {
        useCrmStore.setState({ status: { connected: true } })
      })

      jest
        .spyOn(CrmService, 'getSalesforceAccounts')
        .mockRejectedValueOnce(new Error('Load failed'))
      jest.spyOn(CrmService, 'getSalesforceOpportunities').mockResolvedValueOnce([])
      jest.spyOn(CrmService, 'getSalesforceLeads').mockResolvedValueOnce([])
      jest.spyOn(CrmService, 'getSalesforceContacts').mockResolvedValueOnce([])

      await act(async () => {
        await useCrmStore.getState().loadData()
      })

      expect(useCrmStore.getState().error).toBe('Load failed')
      expect(useCrmStore.getState().loadingData).toBe(false)
    })

    it('should fallback error for non-Error throw in loadData', async () => {
      act(() => {
        useCrmStore.setState({ status: { connected: true } })
      })

      jest.spyOn(CrmService, 'getSalesforceAccounts').mockRejectedValueOnce('bad')
      jest.spyOn(CrmService, 'getSalesforceOpportunities').mockResolvedValueOnce([])
      jest.spyOn(CrmService, 'getSalesforceLeads').mockResolvedValueOnce([])
      jest.spyOn(CrmService, 'getSalesforceContacts').mockResolvedValueOnce([])

      await act(async () => {
        await useCrmStore.getState().loadData()
      })

      expect(useCrmStore.getState().error).toBe('Failed to load CRM data')
    })
  })

  describe('clearData', () => {
    it('should clear all CRM data', () => {
      act(() => {
        useCrmStore.setState({
          accounts: [{ value: 'a', label: 'A' }],
          opportunities: [{ value: 'b', label: 'B' }],
          leads: [{ value: 'c', label: 'C' }],
          contacts: [{ value: 'd', label: 'D' }],
        })
      })

      act(() => {
        useCrmStore.getState().clearData()
      })

      const state = useCrmStore.getState()
      expect(state.accounts).toEqual([])
      expect(state.opportunities).toEqual([])
      expect(state.leads).toEqual([])
      expect(state.contacts).toEqual([])
    })
  })
})
