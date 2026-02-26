export type CrmSelectionGroups = {
  accounts: string[]
  opportunities: string[]
  leads: string[]
  contacts: string[]
}

export type SavedCrmSessionConnection = {
  id: string
  provider: string
  providerEmail?: string | null
  label: string
  connected?: boolean
  savedAt: string
  selections: CrmSelectionGroups
}

export type SavedCrmConnection = {
  id: string
  name: string
  provider: string
  providerEmail?: string | null
  connected?: boolean
  lastSyncAt?: string | null
  autoSync?: boolean
  savedAt: string
}

export type UserSettingsWithCrmPrefs = {
  crm?: {
    name?: string | null
    provider?: string | null
    connected?: boolean
    providerEmail?: string | null
    lastSyncAt?: string | null
    autoSync?: boolean
    sessionDefaults?: {
      savedConnections?: SavedCrmSessionConnection[]
    }
  }
  [key: string]: unknown
}

export const emptyCrmSelections = (): CrmSelectionGroups => ({
  accounts: [],
  opportunities: [],
  leads: [],
  contacts: [],
})

export const normalizeCrmSelections = (value: Partial<CrmSelectionGroups> | null | undefined) => ({
  accounts: Array.isArray(value?.accounts) ? value.accounts : [],
  opportunities: Array.isArray(value?.opportunities) ? value.opportunities : [],
  leads: Array.isArray(value?.leads) ? value.leads : [],
  contacts: Array.isArray(value?.contacts) ? value.contacts : [],
})

export const getSavedCrmSessionConnections = (
  settings: UserSettingsWithCrmPrefs | null | undefined
): SavedCrmSessionConnection[] => {
  const saved = settings?.crm?.sessionDefaults?.savedConnections
  if (!Array.isArray(saved)) return []
  return saved
    .filter((item): item is SavedCrmSessionConnection => !!item && typeof item === 'object')
    .map((item) => ({
      ...item,
      selections: normalizeCrmSelections(item.selections),
    }))
}

export const getSavedCrmConnections = (
  settings: UserSettingsWithCrmPrefs | null | undefined
): SavedCrmConnection[] => {
  const crm = settings?.crm
  if (!crm?.provider) return []

  const provider = crm.provider
  const providerEmail = crm.providerEmail ?? null
  return [
    {
      id: `${provider}:${providerEmail ?? 'default'}`,
      name:
        (typeof crm.name === 'string' && crm.name.trim()) ||
        (providerEmail ? `${provider} (${providerEmail})` : provider),
      provider,
      providerEmail,
      connected: crm.connected ?? false,
      lastSyncAt: crm.lastSyncAt ?? null,
      autoSync: crm.autoSync ?? true,
      savedAt: new Date().toISOString(),
    },
  ]
}

export const upsertSavedCrmConnection = (
  settings: UserSettingsWithCrmPrefs,
  connection: SavedCrmConnection,
  _maxEntries = 10
): UserSettingsWithCrmPrefs => {
  void _maxEntries

  return {
    ...settings,
    crm: {
      ...(settings.crm ?? {}),
      name: connection.name,
      provider: connection.provider,
      providerEmail: connection.providerEmail ?? null,
      connected: connection.connected ?? false,
      lastSyncAt: connection.lastSyncAt ?? null,
      autoSync: connection.autoSync ?? true,
    },
  }
}

export const upsertSavedCrmSessionConnection = (
  settings: UserSettingsWithCrmPrefs,
  connection: SavedCrmSessionConnection,
  maxEntries = 5
): UserSettingsWithCrmPrefs => {
  const existing = getSavedCrmSessionConnections(settings)
  const deduped = existing.filter(
    (entry) =>
      !(
        entry.provider === connection.provider &&
        (entry.providerEmail ?? null) === (connection.providerEmail ?? null)
      )
  )

  const nextConnections = [connection, ...deduped]
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, maxEntries)

  return {
    ...settings,
    crm: {
      ...(settings.crm ?? {}),
      sessionDefaults: {
        ...(settings.crm?.sessionDefaults ?? {}),
        savedConnections: nextConnections,
      },
    },
  }
}

export const removeSavedCrmSessionConnection = (
  settings: UserSettingsWithCrmPrefs,
  id: string
): UserSettingsWithCrmPrefs => {
  const existing = getSavedCrmSessionConnections(settings)
  const nextConnections = existing.filter((entry) => entry.id !== id)

  return {
    ...settings,
    crm: {
      ...(settings.crm ?? {}),
      sessionDefaults: {
        ...(settings.crm?.sessionDefaults ?? {}),
        savedConnections: nextConnections,
      },
    },
  }
}

export const renameSavedCrmSessionConnection = (
  settings: UserSettingsWithCrmPrefs,
  id: string,
  label: string
): UserSettingsWithCrmPrefs => {
  const trimmed = label.trim()
  const existing = getSavedCrmSessionConnections(settings)
  const nextConnections = existing.map((entry) =>
    entry.id === id ? { ...entry, label: trimmed || entry.label } : entry
  )

  return {
    ...settings,
    crm: {
      ...(settings.crm ?? {}),
      sessionDefaults: {
        ...(settings.crm?.sessionDefaults ?? {}),
        savedConnections: nextConnections,
      },
    },
  }
}
