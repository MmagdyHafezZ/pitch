'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { CrmService } from '../services/crm.service'
import type { CrmOption, CrmStatus } from '../types/crm.types'

const STATUS_TTL_MS = 1000 * 60 * 5

type CrmState = {
  status: CrmStatus | null
  statusCheckedAt: string | null
  loadingStatus: boolean
  loadingData: boolean
  error: string | null
  accounts: CrmOption[]
  opportunities: CrmOption[]
  leads: CrmOption[]
  contacts: CrmOption[]

  fetchStatus: (force?: boolean) => Promise<void>
  connect: () => Promise<{ authUrl?: string } | null>
  loadData: (limit?: number) => Promise<void>
  clearData: () => void
}

const toErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

const mapId = (record: Record<string, any>) => record.Id || record.id || ''

export const useCrmStore = create<CrmState>()(
  persist(
    (set, get) => ({
      status: null,
      statusCheckedAt: null,
      loadingStatus: false,
      loadingData: false,
      error: null,
      accounts: [],
      opportunities: [],
      leads: [],
      contacts: [],

      fetchStatus: async (force = false) => {
        const { loadingStatus, status, statusCheckedAt } = get()
        if (loadingStatus) return

        if (!force && status && statusCheckedAt) {
          const lastChecked = Date.parse(statusCheckedAt)
          if (!Number.isNaN(lastChecked) && Date.now() - lastChecked < STATUS_TTL_MS) {
            return
          }
        }

        set({ loadingStatus: true, error: null })
        try {
          const response = await CrmService.getSalesforceStatus()
          set({
            status: response,
            statusCheckedAt: new Date().toISOString(),
            loadingStatus: false,
          })
        } catch (err) {
          set({
            status: null,
            statusCheckedAt: new Date().toISOString(),
            loadingStatus: false,
            error: toErrorMessage(err, 'Failed to load CRM status'),
          })
        }
      },

      connect: async () => {
        set({ error: null })
        try {
          return await CrmService.connectSalesforce()
        } catch (err) {
          set({ error: toErrorMessage(err, 'Failed to connect CRM') })
          return null
        }
      },

      loadData: async (limit = 50) => {
        const { status, loadingData } = get()
        if (!status?.connected || loadingData) return

        set({ loadingData: true, error: null })
        try {
          const [accounts, opportunities, leads, contacts] = await Promise.all([
            CrmService.getSalesforceAccounts(limit),
            CrmService.getSalesforceOpportunities(limit),
            CrmService.getSalesforceLeads(limit),
            CrmService.getSalesforceContacts(limit),
          ])

          set({
            accounts: (accounts ?? []).map((account: Record<string, any>) => ({
              value: mapId(account),
              label: account.Name || mapId(account),
            })),
            opportunities: (opportunities ?? []).map((opportunity: Record<string, any>) => ({
              value: mapId(opportunity),
              label: opportunity.Name
                ? `${opportunity.Name}${opportunity.StageName ? ` • ${opportunity.StageName}` : ''}`
                : mapId(opportunity),
            })),
            leads: (leads ?? []).map((lead: Record<string, any>) => ({
              value: mapId(lead),
              label:
                [lead.FirstName, lead.LastName].filter(Boolean).join(' ') ||
                lead.Company ||
                mapId(lead),
            })),
            contacts: (contacts ?? []).map((contact: Record<string, any>) => ({
              value: mapId(contact),
              label:
                [contact.FirstName, contact.LastName].filter(Boolean).join(' ') ||
                contact.Email ||
                mapId(contact),
            })),
            loadingData: false,
          })
        } catch (err) {
          set({
            loadingData: false,
            error: toErrorMessage(err, 'Failed to load CRM data'),
          })
        }
      },

      clearData: () =>
        set({
          accounts: [],
          opportunities: [],
          leads: [],
          contacts: [],
        }),
    }),
    {
      name: 'crm-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        status: state.status,
        statusCheckedAt: state.statusCheckedAt,
      }),
    }
  )
)
