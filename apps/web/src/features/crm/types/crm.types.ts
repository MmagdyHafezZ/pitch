export type CrmProvider = 'salesforce'

export interface CrmStatus {
  connected?: boolean
  status?: string
  providerEmail?: string
  lastSyncAt?: string
  provider?: CrmProvider
}

export interface CrmOption {
  value: string
  label: string
}

export interface CrmData {
  accounts: CrmOption[]
  opportunities: CrmOption[]
  leads: CrmOption[]
  contacts: CrmOption[]
}
