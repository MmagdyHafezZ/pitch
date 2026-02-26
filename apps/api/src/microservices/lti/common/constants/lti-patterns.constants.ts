/**
 * RabbitMQ message patterns for the LTI microservice.
 * Used for internal service-to-service communication.
 */
export const LTI_PATTERNS = {
  // Health
  HEALTH: 'lti.health',

  // Platform management
  PLATFORM_CREATE: 'lti.platform.create',
  PLATFORM_FIND_ALL: 'lti.platform.findAll',
  PLATFORM_FIND_ONE: 'lti.platform.findOne',
  PLATFORM_UPDATE: 'lti.platform.update',
  PLATFORM_DELETE: 'lti.platform.delete',

  // LTI 1.1
  V1P1_LAUNCH: 'lti.v1p1.launch',
  V1P1_GRADE: 'lti.v1p1.grade',

  // LTI 1.3 OIDC
  V1P3_OIDC_LOGIN: 'lti.v1p3.oidc.login',
  V1P3_LAUNCH: 'lti.v1p3.launch',
  V1P3_JWKS: 'lti.v1p3.jwks',

  // Advantage — Deep Linking
  DEEP_LINK_RESPONSE: 'lti.advantage.deeplink.response',

  // Advantage — Names & Roles Provisioning
  NRPS_GET_MEMBERS: 'lti.advantage.nrps.members',

  // Advantage — Assignment & Grades
  AGS_CREATE_LINE_ITEM: 'lti.advantage.ags.lineitem.create',
  AGS_GET_LINE_ITEMS: 'lti.advantage.ags.lineitems.get',
  AGS_SUBMIT_SCORE: 'lti.advantage.ags.score.submit',
  AGS_GET_RESULTS: 'lti.advantage.ags.results.get',

  // Session
  SESSION_FIND: 'lti.session.find',
  SESSION_LINK_PITCH: 'lti.session.link.pitch',
} as const;

export type LtiPatternKey = keyof typeof LTI_PATTERNS;
export type LtiPattern = (typeof LTI_PATTERNS)[LtiPatternKey];
