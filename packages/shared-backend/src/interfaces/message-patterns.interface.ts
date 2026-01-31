export const USER_SERVICE_PATTERNS = {
  GET_USER: 'get_user',
  CREATE_USER: 'create_user',
  UPDATE_USER: 'update_user',
  DELETE_USER: 'delete_user',
  GET_USERS: 'get_users',
  REGISTER: 'auth.register',
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REFRESH: 'auth.refresh',
  VALIDATE_USER: 'auth.validateUser',
  OAUTH_GET_PROVIDERS: 'auth.oauth.getProviders',
  CHECK_EMAIL: 'auth.checkEmail',
  CREATE_TEAM: 'create_team',
  UPDATE_TEAM: 'update_team',
  DELETE_TEAM: 'delete_team',
  GET_TEAM: 'get_team',
  GET_TEAMS: 'get_teams',
  ADD_TEAM_MEMBER: 'add_team_member',
  UPDATE_TEAM_MEMBER: 'update_team_member',
  DELETE_TEAM_MEMBER: 'delete_team_member',
} as const

export const BUSINESS_SERVICE_PATTERNS = {
  GET_BUSINESS: 'get_business',
  GET_BUSINESS_WITH_USER: 'get_business_with_user',
  CREATE_BUSINESS: 'create_business',
  UPDATE_BUSINESS: 'update_business',
  DELETE_BUSINESS: 'delete_business',
  GET_BUSINESSES: 'get_businesses',
} as const

export const CRM_SERVICE_PATTERNS = {
  // Salesforce Integration - Live Data (Real-time from Salesforce)
  SALESFORCE_CONNECT: 'salesforce.connect',
  SALESFORCE_CALLBACK: 'salesforce.callback',
  SALESFORCE_GET_STATUS: 'salesforce.getStatus',
  SALESFORCE_GET_CONTACTS: 'salesforce.getContacts', // Live from Salesforce
  SALESFORCE_GET_ACCOUNTS: 'salesforce.getAccounts', // Live from Salesforce
  SALESFORCE_GET_OPPORTUNITIES: 'salesforce.getOpportunities', // Live from Salesforce
  SALESFORCE_GET_LEADS: 'salesforce.getLeads', // Live from Salesforce
  SALESFORCE_QUERY: 'salesforce.query',
  SALESFORCE_SEARCH: 'salesforce.search',
  SALESFORCE_DISCONNECT: 'salesforce.disconnect',

  // Session CRM Data (Stored in DB, attached to sessions)
  SESSION_ATTACH_CRM_DATA: 'session.attachCrmData', // Attach selected CRM data to session
  SESSION_GET_CRM_DATA: 'session.getCrmData', // Get CRM data for session
  SESSION_REFRESH_CRM_DATA: 'session.refreshCrmData', // Refresh from Salesforce
  SESSION_DELETE_CRM_DATA: 'session.deleteCrmData', // Delete when session deleted
} as const

export type UserServicePattern = (typeof USER_SERVICE_PATTERNS)[keyof typeof USER_SERVICE_PATTERNS]
export type BusinessServicePattern =
  (typeof BUSINESS_SERVICE_PATTERNS)[keyof typeof BUSINESS_SERVICE_PATTERNS]
export type CrmServicePattern = (typeof CRM_SERVICE_PATTERNS)[keyof typeof CRM_SERVICE_PATTERNS]
