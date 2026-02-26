import {
  getSavedCrmConnections,
  upsertSavedCrmConnection,
  type SavedCrmConnection,
  type UserSettingsWithCrmPrefs,
} from '../session-crm-preferences'

describe('session-crm-preferences (single CRM persistence)', () => {
  it('returns empty list when no saved crm exists', () => {
    expect(getSavedCrmConnections({})).toEqual([])
    expect(getSavedCrmConnections(null)).toEqual([])
  })

  it('hydrates a single saved crm from settings.crm fields', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: {
        name: 'RevOps Salesforce',
        provider: 'salesforce',
        providerEmail: 'revops@example.com',
        connected: true,
        lastSyncAt: '2026-02-24T05:00:00.000Z',
        autoSync: false,
      },
    }

    expect(getSavedCrmConnections(settings)).toEqual([
      expect.objectContaining({
        id: 'salesforce:revops@example.com',
        name: 'RevOps Salesforce',
        provider: 'salesforce',
        providerEmail: 'revops@example.com',
        connected: true,
        lastSyncAt: '2026-02-24T05:00:00.000Z',
        autoSync: false,
      }),
    ])
  })

  it('upsertSavedCrmConnection overwrites the existing saved crm instead of accumulating', () => {
    const initial: UserSettingsWithCrmPrefs = {
      crm: {
        name: 'Old CRM',
        provider: 'salesforce',
        providerEmail: 'old@example.com',
        connected: true,
        autoSync: true,
        sessionDefaults: {
          savedConnections: [
            {
              id: 'preset-1',
              provider: 'salesforce',
              providerEmail: 'old@example.com',
              label: 'Old preset',
              savedAt: '2026-02-24T04:00:00.000Z',
              selections: { accounts: [], opportunities: [], leads: [], contacts: [] },
            },
          ],
        },
      },
    }

    const nextSavedCrm: SavedCrmConnection = {
      id: 'salesforce:new@example.com',
      name: 'New CRM',
      provider: 'salesforce',
      providerEmail: 'new@example.com',
      connected: false,
      autoSync: true,
      lastSyncAt: null,
      savedAt: '2026-02-24T06:00:00.000Z',
    }

    const next = upsertSavedCrmConnection(initial, nextSavedCrm)

    expect(next.crm).toEqual(
      expect.objectContaining({
        name: 'New CRM',
        provider: 'salesforce',
        providerEmail: 'new@example.com',
        connected: false,
        autoSync: true,
      })
    )
    expect((next.crm as any).connections).toBeUndefined()
    expect(next.crm?.sessionDefaults?.savedConnections).toHaveLength(1)
    expect(next.crm?.sessionDefaults?.savedConnections?.[0]?.id).toBe('preset-1')
  })
})
