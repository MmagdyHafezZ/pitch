import { LtiRole } from '@prisma/lti-client';

/**
 * IMS Global LTI role URNs mapped to normalised internal roles.
 * Supports both LTI 1.1 string roles and LTI 1.3 full URN roles.
 */
const ROLE_MAP: Record<string, LtiRole> = {
  // LTI 1.3 full URNs — membership
  'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor':
    LtiRole.INSTRUCTOR,
  'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner': LtiRole.LEARNER,
  'http://purl.imsglobal.org/vocab/lis/v2/membership#Mentor': LtiRole.MENTOR,
  'http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper':
    LtiRole.CONTENT_DEVELOPER,
  'http://purl.imsglobal.org/vocab/lis/v2/membership#Manager':
    LtiRole.TEACHING_ASSISTANT,
  'http://purl.imsglobal.org/vocab/lis/v2/membership#Observer':
    LtiRole.OBSERVER,
  'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator':
    LtiRole.ADMINISTRATOR,

  // LTI 1.3 system roles
  'http://purl.imsglobal.org/vocab/lis/v2/system/person#Administrator':
    LtiRole.ADMINISTRATOR,

  // LTI 1.1 short role strings
  Instructor: LtiRole.INSTRUCTOR,
  Learner: LtiRole.LEARNER,
  Student: LtiRole.LEARNER,
  TeachingAssistant: LtiRole.TEACHING_ASSISTANT,
  Administrator: LtiRole.ADMINISTRATOR,
  ContentDeveloper: LtiRole.CONTENT_DEVELOPER,
  Observer: LtiRole.OBSERVER,
  Mentor: LtiRole.MENTOR,
  Grader: LtiRole.GRADER,
};

/**
 * Map an array of raw LTI role strings to normalised LtiRole enums.
 * Unknown roles default to UNKNOWN.
 */
export function parseRoles(rawRoles: string[]): LtiRole[] {
  const mapped = rawRoles.map((r) => ROLE_MAP[r] ?? LtiRole.UNKNOWN);
  // Deduplicate
  return [...new Set(mapped)];
}

/** Returns true when any of the roles is INSTRUCTOR or ADMINISTRATOR */
export function isInstructor(roles: LtiRole[]): boolean {
  return roles.some(
    (r) => r === LtiRole.INSTRUCTOR || r === LtiRole.ADMINISTRATOR,
  );
}

/** Returns true when the primary role is LEARNER */
export function isLearner(roles: LtiRole[]): boolean {
  return roles.some((r) => r === LtiRole.LEARNER);
}
