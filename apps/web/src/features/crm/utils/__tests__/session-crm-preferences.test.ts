import {
  emptyCrmSelections,
  normalizeCrmSelections,
  getSavedCrmSessionConnections,
  getSavedCrmConnections,
  upsertSavedCrmConnection,
  upsertSavedCrmSessionConnection,
  removeSavedCrmSessionConnection,
  renameSavedCrmSessionConnection,
  type SavedCrmConnection,
  type SavedCrmSessionConnection,
  type UserSettingsWithCrmPrefs,
} from '../session-crm-preferences'

describe('emptyCrmSelections', () => {
  it('returns all empty arrays', () => {
    expect(emptyCrmSelections()).toEqual({
      accounts: [],
      opportunities: [],
      leads: [],
      contacts: [],
    })
  })

  it('returns a new object each time', () => {
    const a = emptyCrmSelections()
    const b = emptyCrmSelections()
    expect(a).not.toBe(b)
  })
})

describe('normalizeCrmSelections', () => {
  it('normalizes null to empty selections', () => {
    expect(normalizeCrmSelections(null)).toEqual(emptyCrmSelections())
  })

  it('normalizes undefined to empty selections', () => {
    expect(normalizeCrmSelections(undefined)).toEqual(emptyCrmSelections())
  })

  it('normalizes partial selections', () => {
    expect(normalizeCrmSelections({ accounts: ['a1'] })).toEqual({
      accounts: ['a1'],
      opportunities: [],
      leads: [],
      contacts: [],
    })
  })

  it('ignores non-array values', () => {
    expect(normalizeCrmSelections({ accounts: 'not-array' as any })).toEqual({
      accounts: [],
      opportunities: [],
      leads: [],
      contacts: [],
    })
  })

  it('preserves complete selections', () => {
    const input = { accounts: ['a1'], opportunities: ['o1'], leads: ['l1'], contacts: ['c1'] }
    expect(normalizeCrmSelections(input)).toEqual(input)
  })
})

describe('getSavedCrmSessionConnections', () => {
  it('returns empty array for null settings', () => {
    expect(getSavedCrmSessionConnections(null)).toEqual([])
  })

  it('returns empty array for undefined settings', () => {
    expect(getSavedCrmSessionConnections(undefined)).toEqual([])
  })

  it('returns empty array when no savedConnections', () => {
    expect(getSavedCrmSessionConnections({ crm: {} })).toEqual([])
  })

  it('returns empty array when savedConnections is not array', () => {
    expect(
      getSavedCrmSessionConnections({
        crm: { sessionDefaults: { savedConnections: 'bad' as any } },
      })
    ).toEqual([])
  })

  it('filters out null/undefined entries', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: {
        sessionDefaults: {
          savedConnections: [
            null as any,
            {
              id: 'c1',
              provider: 'salesforce',
              label: 'test',
              savedAt: '2026-01-01',
              selections: { accounts: ['a1'], opportunities: [], leads: [], contacts: [] },
            },
          ],
        },
      },
    }
    const result = getSavedCrmSessionConnections(settings)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
  })

  it('normalizes selections for each connection', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: {
        sessionDefaults: {
          savedConnections: [
            {
              id: 'c1',
              provider: 'salesforce',
              label: 'test',
              savedAt: '2026-01-01',
              selections: { accounts: ['a1'] } as any,
            },
          ],
        },
      },
    }
    const result = getSavedCrmSessionConnections(settings)
    expect(result[0].selections).toEqual({
      accounts: ['a1'],
      opportunities: [],
      leads: [],
      contacts: [],
    })
  })
})

describe('getSavedCrmConnections', () => {
  it('returns empty array when no saved crm exists', () => {
    expect(getSavedCrmConnections({})).toEqual([])
    expect(getSavedCrmConnections(null)).toEqual([])
  })

  it('returns empty array when provider is missing', () => {
    expect(getSavedCrmConnections({ crm: { name: 'Test' } })).toEqual([])
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

    const result = getSavedCrmConnections(settings)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'salesforce:revops@example.com',
        name: 'RevOps Salesforce',
        provider: 'salesforce',
        providerEmail: 'revops@example.com',
        connected: true,
        lastSyncAt: '2026-02-24T05:00:00.000Z',
        autoSync: false,
      })
    )
  })

  it('uses provider as fallback name when name is empty', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: { provider: 'salesforce', name: '' },
    }
    const result = getSavedCrmConnections(settings)
    expect(result[0].name).toBe('salesforce')
  })

  it('uses provider(email) as fallback name when name is null and email exists', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: { provider: 'salesforce', providerEmail: 'a@b.com' },
    }
    const result = getSavedCrmConnections(settings)
    expect(result[0].name).toBe('salesforce (a@b.com)')
  })

  it('defaults connected to false, autoSync to true', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: { provider: 'salesforce' },
    }
    const result = getSavedCrmConnections(settings)
    expect(result[0].connected).toBe(false)
    expect(result[0].autoSync).toBe(true)
  })

  it('uses default id when no providerEmail', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: { provider: 'salesforce' },
    }
    const result = getSavedCrmConnections(settings)
    expect(result[0].id).toBe('salesforce:default')
  })
})

describe('upsertSavedCrmConnection', () => {
  it('overwrites the existing saved crm instead of accumulating', () => {
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
              selections: emptyCrmSelections(),
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
    expect(next.crm?.sessionDefaults?.savedConnections).toHaveLength(1)
  })

  it('works with empty initial settings', () => {
    const connection: SavedCrmConnection = {
      id: 'sf:test',
      name: 'Test',
      provider: 'salesforce',
      connected: true,
      autoSync: false,
      savedAt: '2026-01-01',
    }

    const result = upsertSavedCrmConnection({}, connection)
    expect(result.crm?.provider).toBe('salesforce')
    expect(result.crm?.name).toBe('Test')
  })
})

describe('upsertSavedCrmSessionConnection', () => {
  const makeConnection = (
    overrides: Partial<SavedCrmSessionConnection> = {}
  ): SavedCrmSessionConnection => ({
    id: 'c1',
    provider: 'salesforce',
    label: 'Test',
    savedAt: '2026-01-01T00:00:00.000Z',
    selections: emptyCrmSelections(),
    ...overrides,
  })

  it('adds a new connection', () => {
    const result = upsertSavedCrmSessionConnection({}, makeConnection())
    const connections = getSavedCrmSessionConnections(result)
    expect(connections).toHaveLength(1)
    expect(connections[0].id).toBe('c1')
  })

  it('deduplicates by provider + providerEmail', () => {
    const existing: UserSettingsWithCrmPrefs = {
      crm: {
        sessionDefaults: {
          savedConnections: [
            makeConnection({
              id: 'old',
              provider: 'salesforce',
              providerEmail: 'a@b.com',
              savedAt: '2026-01-01T00:00:00.000Z',
            }),
          ],
        },
      },
    }

    const result = upsertSavedCrmSessionConnection(
      existing,
      makeConnection({
        id: 'new',
        provider: 'salesforce',
        providerEmail: 'a@b.com',
        savedAt: '2026-01-02T00:00:00.000Z',
      })
    )

    const connections = getSavedCrmSessionConnections(result)
    expect(connections).toHaveLength(1)
    expect(connections[0].id).toBe('new')
  })

  it('respects maxEntries limit', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: { sessionDefaults: { savedConnections: [] } },
    }

    let current = settings
    for (let i = 0; i < 7; i++) {
      current = upsertSavedCrmSessionConnection(
        current,
        makeConnection({
          id: `c${i}`,
          provider: `provider-${i}`,
          savedAt: new Date(2026, 0, i + 1).toISOString(),
        }),
        5
      )
    }

    const connections = getSavedCrmSessionConnections(current)
    expect(connections.length).toBeLessThanOrEqual(5)
  })

  it('sorts by savedAt descending', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: {
        sessionDefaults: {
          savedConnections: [
            makeConnection({ id: 'old', provider: 'p1', savedAt: '2026-01-01T00:00:00.000Z' }),
          ],
        },
      },
    }

    const result = upsertSavedCrmSessionConnection(
      settings,
      makeConnection({ id: 'new', provider: 'p2', savedAt: '2026-02-01T00:00:00.000Z' })
    )

    const connections = getSavedCrmSessionConnections(result)
    expect(connections[0].id).toBe('new')
  })
})

describe('removeSavedCrmSessionConnection', () => {
  it('removes a connection by id', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: {
        sessionDefaults: {
          savedConnections: [
            {
              id: 'c1',
              provider: 'salesforce',
              label: 'Test',
              savedAt: '2026-01-01',
              selections: emptyCrmSelections(),
            },
            {
              id: 'c2',
              provider: 'salesforce',
              label: 'Test 2',
              savedAt: '2026-01-02',
              selections: emptyCrmSelections(),
            },
          ],
        },
      },
    }

    const result = removeSavedCrmSessionConnection(settings, 'c1')
    const connections = getSavedCrmSessionConnections(result)
    expect(connections).toHaveLength(1)
    expect(connections[0].id).toBe('c2')
  })

  it('does nothing when id not found', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: {
        sessionDefaults: {
          savedConnections: [
            {
              id: 'c1',
              provider: 'salesforce',
              label: 'Test',
              savedAt: '2026-01-01',
              selections: emptyCrmSelections(),
            },
          ],
        },
      },
    }

    const result = removeSavedCrmSessionConnection(settings, 'nonexistent')
    const connections = getSavedCrmSessionConnections(result)
    expect(connections).toHaveLength(1)
  })
})

describe('renameSavedCrmSessionConnection', () => {
  it('renames a connection by id', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: {
        sessionDefaults: {
          savedConnections: [
            {
              id: 'c1',
              provider: 'salesforce',
              label: 'Old Label',
              savedAt: '2026-01-01',
              selections: emptyCrmSelections(),
            },
          ],
        },
      },
    }

    const result = renameSavedCrmSessionConnection(settings, 'c1', 'New Label')
    const connections = getSavedCrmSessionConnections(result)
    expect(connections[0].label).toBe('New Label')
  })

  it('trims label whitespace', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: {
        sessionDefaults: {
          savedConnections: [
            {
              id: 'c1',
              provider: 'salesforce',
              label: 'Old',
              savedAt: '2026-01-01',
              selections: emptyCrmSelections(),
            },
          ],
        },
      },
    }

    const result = renameSavedCrmSessionConnection(settings, 'c1', '  Trimmed  ')
    const connections = getSavedCrmSessionConnections(result)
    expect(connections[0].label).toBe('Trimmed')
  })

  it('keeps original label when new label is empty', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: {
        sessionDefaults: {
          savedConnections: [
            {
              id: 'c1',
              provider: 'salesforce',
              label: 'Keep Me',
              savedAt: '2026-01-01',
              selections: emptyCrmSelections(),
            },
          ],
        },
      },
    }

    const result = renameSavedCrmSessionConnection(settings, 'c1', '   ')
    const connections = getSavedCrmSessionConnections(result)
    expect(connections[0].label).toBe('Keep Me')
  })

  it('does not modify other connections', () => {
    const settings: UserSettingsWithCrmPrefs = {
      crm: {
        sessionDefaults: {
          savedConnections: [
            {
              id: 'c1',
              provider: 'salesforce',
              label: 'First',
              savedAt: '2026-01-01',
              selections: emptyCrmSelections(),
            },
            {
              id: 'c2',
              provider: 'salesforce',
              label: 'Second',
              savedAt: '2026-01-02',
              selections: emptyCrmSelections(),
            },
          ],
        },
      },
    }

    const result = renameSavedCrmSessionConnection(settings, 'c1', 'Renamed')
    const connections = getSavedCrmSessionConnections(result)
    expect(connections.find((c) => c.id === 'c2')?.label).toBe('Second')
  })
})
