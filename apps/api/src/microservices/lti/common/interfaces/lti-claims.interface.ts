/**
 * LTI 1.3 ID Token claim interfaces.
 * These map directly to the IMS Global LTI 1.3 specification.
 * https://www.imsglobal.org/spec/lti/v1p3
 */

export interface LtiRoleClaim {
  roles: string[]; // e.g. ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"]
}

export interface LtiContextClaim {
  id: string;
  label?: string;
  title?: string;
  type?: string[];
}

export interface LtiResourceLinkClaim {
  id: string;
  title?: string;
  description?: string;
}

export interface LtiToolPlatformClaim {
  guid: string;
  name?: string;
  version?: string;
  product_family_code?: string;
}

export interface LtiLisClaim {
  person_sourcedid?: string;
  course_offering_sourcedid?: string;
  course_section_sourcedid?: string;
}

/** Deep Linking service claim (LTI Advantage) */
export interface LtiDeepLinkingSettingsClaim {
  deep_link_return_url: string;
  accept_types: string[];
  accept_presentation_document_targets: string[];
  accept_media_types?: string;
  accept_multiple?: boolean;
  auto_create?: boolean;
  title?: string;
  text?: string;
  data?: string; /// Opaque data to pass back in response
}

/** Names and Roles Provisioning Service claim (LTI Advantage) */
export interface LtiNrpsServiceClaim {
  context_memberships_url: string;
  service_versions: string[];
}

/** Assignment & Grades Service claim (LTI Advantage) */
export interface LtiAgsServiceClaim {
  lineitems?: string; /// URL to list/create line items
  lineitem?: string; /// URL to a specific pre-created line item
  scope: string[]; /// OAuth2 scopes granted
}

/** Custom claim parameters */
export interface LtiCustomClaim {
  [key: string]: string | number | boolean;
}

/**
 * Full LTI 1.3 ID Token claims payload.
 * Extends standard OIDC claims with LTI-specific URN claims.
 */
export interface Lti1p3Claims {
  // Standard OIDC
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce: string;
  azp?: string;

  // User info
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
  locale?: string;

  // LTI core claims (registered URNs)
  'https://purl.imsglobal.org/spec/lti/claim/message_type': string;
  'https://purl.imsglobal.org/spec/lti/claim/version': string;
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id': string;
  'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': string;

  'https://purl.imsglobal.org/spec/lti/claim/roles': string[];
  'https://purl.imsglobal.org/spec/lti/claim/context'?: LtiContextClaim;
  'https://purl.imsglobal.org/spec/lti/claim/resource_link': LtiResourceLinkClaim;
  'https://purl.imsglobal.org/spec/lti/claim/tool_platform'?: LtiToolPlatformClaim;
  'https://purl.imsglobal.org/spec/lti/claim/lis'?: LtiLisClaim;
  'https://purl.imsglobal.org/spec/lti/claim/custom'?: LtiCustomClaim;

  // Advantage claims
  'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'?: LtiDeepLinkingSettingsClaim;
  'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice'?: LtiNrpsServiceClaim;
  'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'?: LtiAgsServiceClaim;
}

/** Parsed, normalised representation of an LTI launch context */
export interface LtiLaunchContext {
  version: '1.1' | '1.3';
  platformId: string;
  sessionId: string;

  user: {
    id: string;
    email?: string;
    name?: string;
    roles: string[];
  };

  course?: {
    id: string;
    label?: string;
    title?: string;
  };

  resourceLink?: {
    id: string;
    title?: string;
  };

  // Advantage service endpoints discovered from claims
  services?: {
    deepLinkReturnUrl?: string;
    namesRolesUrl?: string;
    lineItemsUrl?: string;
    lineItemUrl?: string;
    agsScopes?: string[];
  };
}
