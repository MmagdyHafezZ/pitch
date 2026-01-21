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
  GET_USER_TEAMS: 'get_user_teams',
  ADD_TEAM_MEMBER: 'add_team_member',
  UPDATE_TEAM_MEMBER: 'update_team_member',
  DELETE_TEAM_MEMBER: 'delete_team_member',
  CREATE_PLAN: 'create_plan',
  UPDATE_PLAN: 'update_plan',
  DELETE_PLAN: 'delete_plan',
  GET_PLAN: 'get_plan',
  GET_PLANS: 'get_plans',
  CREATE_SUBSCRIPTION: 'create_subscription',
  UPDATE_SUBSCRIPTION: 'update_subscription',
  DELETE_SUBSCRIPTION: 'cancel_subscription',
  GET_SUBSCRIPTION: 'get_subscription',
  GET_SUBSCRIPTIONS: 'get_subscriptions',
} as const

export const BUSINESS_SERVICE_PATTERNS = {
  GET_BUSINESS: 'get_business',
  GET_BUSINESS_WITH_USER: 'get_business_with_user',
  CREATE_BUSINESS: 'create_business',
  UPDATE_BUSINESS: 'update_business',
  DELETE_BUSINESS: 'delete_business',
  GET_BUSINESSES: 'get_businesses',
} as const

export type UserServicePattern = (typeof USER_SERVICE_PATTERNS)[keyof typeof USER_SERVICE_PATTERNS]
export type BusinessServicePattern =
  (typeof BUSINESS_SERVICE_PATTERNS)[keyof typeof BUSINESS_SERVICE_PATTERNS]
