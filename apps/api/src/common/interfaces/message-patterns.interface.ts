export const USER_SERVICE_PATTERNS = {
  GET_USER: 'get_user',
  CREATE_USER: 'create_user',
  UPDATE_USER: 'update_user',
  DELETE_USER: 'delete_user',
  GET_USERS: 'get_users',
} as const;

export const BUSINESS_SERVICE_PATTERNS = {
  GET_BUSINESS: 'get_business',
  GET_BUSINESS_WITH_USER: 'get_business_with_user',
  CREATE_BUSINESS: 'create_business',
  UPDATE_BUSINESS: 'update_business',
  DELETE_BUSINESS: 'delete_business',
  GET_BUSINESSES: 'get_businesses',
} as const;

export const AUTH_SERVICE_PATTERNS = {
  REGISTER: 'auth.register',
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REFRESH: 'auth.refresh',
  GET_USER: 'auth.getUser',
  VALIDATE_USER: 'auth.validateUser',
} as const;

export type UserServicePattern =
  (typeof USER_SERVICE_PATTERNS)[keyof typeof USER_SERVICE_PATTERNS];
export type BusinessServicePattern =
  (typeof BUSINESS_SERVICE_PATTERNS)[keyof typeof BUSINESS_SERVICE_PATTERNS];
export type AuthServicePattern =
  (typeof AUTH_SERVICE_PATTERNS)[keyof typeof AUTH_SERVICE_PATTERNS];
