import { useCrmStore } from '../stores/crm.store'

export function useCrm() {
  const status = useCrmStore((s) => s.status)
  const statusCheckedAt = useCrmStore((s) => s.statusCheckedAt)
  const loadingStatus = useCrmStore((s) => s.loadingStatus)
  const loadingData = useCrmStore((s) => s.loadingData)
  const error = useCrmStore((s) => s.error)
  const accounts = useCrmStore((s) => s.accounts)
  const opportunities = useCrmStore((s) => s.opportunities)
  const leads = useCrmStore((s) => s.leads)
  const contacts = useCrmStore((s) => s.contacts)
  const fetchStatus = useCrmStore((s) => s.fetchStatus)
  const connect = useCrmStore((s) => s.connect)
  const loadData = useCrmStore((s) => s.loadData)
  const clearData = useCrmStore((s) => s.clearData)

  return {
    status,
    statusCheckedAt,
    loadingStatus,
    loadingData,
    error,
    accounts,
    opportunities,
    leads,
    contacts,
    fetchStatus,
    connect,
    loadData,
    clearData,
  }
}
