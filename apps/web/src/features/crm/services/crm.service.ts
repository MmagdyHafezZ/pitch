import { api } from '@/lib/client'

export class CrmService {
  static async connectSalesforce() {
    return api.crm.salesforce.connect()
  }

  static async getSalesforceStatus() {
    return api.crm.salesforce.status()
  }

  static async getSalesforceAccounts(limit = 50) {
    return api.crm.salesforce.accounts(limit)
  }

  static async getSalesforceOpportunities(limit = 50) {
    return api.crm.salesforce.opportunities(limit)
  }

  static async getSalesforceLeads(limit = 50) {
    return api.crm.salesforce.leads(limit)
  }

  static async getSalesforceContacts(limit = 50) {
    return api.crm.salesforce.contacts(limit)
  }
}
