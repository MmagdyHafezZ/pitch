import {
  parseRoles,
  isInstructor,
  isLearner,
} from '../../common/utils/lti-roles.util';
import { LtiRole } from '@prisma/lti-client';

describe('lti-roles.util', () => {
  describe('parseRoles', () => {
    it('maps LTI 1.3 full URN Instructor role', () => {
      const result = parseRoles([
        'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
      ]);
      expect(result).toEqual([LtiRole.INSTRUCTOR]);
    });

    it('maps LTI 1.3 full URN Learner role', () => {
      const result = parseRoles([
        'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
      ]);
      expect(result).toEqual([LtiRole.LEARNER]);
    });

    it('maps LTI 1.1 short Instructor string', () => {
      expect(parseRoles(['Instructor'])).toEqual([LtiRole.INSTRUCTOR]);
    });

    it('maps LTI 1.1 short Learner string', () => {
      expect(parseRoles(['Learner'])).toEqual([LtiRole.LEARNER]);
    });

    it('maps Student alias to LEARNER', () => {
      expect(parseRoles(['Student'])).toEqual([LtiRole.LEARNER]);
    });

    it('maps Administrator to ADMINISTRATOR', () => {
      expect(parseRoles(['Administrator'])).toEqual([LtiRole.ADMINISTRATOR]);
    });

    it('maps LTI 1.3 system Administrator URN', () => {
      const result = parseRoles([
        'http://purl.imsglobal.org/vocab/lis/v2/system/person#Administrator',
      ]);
      expect(result).toEqual([LtiRole.ADMINISTRATOR]);
    });

    it('defaults unknown roles to UNKNOWN', () => {
      expect(parseRoles(['SomeMadeUpRole'])).toEqual([LtiRole.UNKNOWN]);
    });

    it('deduplicates roles', () => {
      const result = parseRoles(['Instructor', 'Instructor']);
      expect(result).toHaveLength(1);
      expect(result).toEqual([LtiRole.INSTRUCTOR]);
    });

    it('handles empty array', () => {
      expect(parseRoles([])).toEqual([]);
    });

    it('handles mixed LTI 1.1 and 1.3 roles with dedup', () => {
      const result = parseRoles([
        'Instructor',
        'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
      ]);
      expect(result).toHaveLength(1);
      expect(result).toContain(LtiRole.INSTRUCTOR);
    });

    it('maps Grader role', () => {
      expect(parseRoles(['Grader'])).toEqual([LtiRole.GRADER]);
    });

    it('maps ContentDeveloper role', () => {
      expect(parseRoles(['ContentDeveloper'])).toEqual([
        LtiRole.CONTENT_DEVELOPER,
      ]);
    });
  });

  describe('isInstructor', () => {
    it('returns true for INSTRUCTOR role', () => {
      expect(isInstructor([LtiRole.INSTRUCTOR])).toBe(true);
    });

    it('returns true for ADMINISTRATOR role', () => {
      expect(isInstructor([LtiRole.ADMINISTRATOR])).toBe(true);
    });

    it('returns false for LEARNER role', () => {
      expect(isInstructor([LtiRole.LEARNER])).toBe(false);
    });

    it('returns true when INSTRUCTOR is among multiple roles', () => {
      expect(isInstructor([LtiRole.LEARNER, LtiRole.INSTRUCTOR])).toBe(true);
    });

    it('returns false for empty roles', () => {
      expect(isInstructor([])).toBe(false);
    });
  });

  describe('isLearner', () => {
    it('returns true for LEARNER role', () => {
      expect(isLearner([LtiRole.LEARNER])).toBe(true);
    });

    it('returns false for INSTRUCTOR role', () => {
      expect(isLearner([LtiRole.INSTRUCTOR])).toBe(false);
    });

    it('returns true when LEARNER is among multiple roles', () => {
      expect(isLearner([LtiRole.INSTRUCTOR, LtiRole.LEARNER])).toBe(true);
    });

    it('returns false for empty roles', () => {
      expect(isLearner([])).toBe(false);
    });
  });
});
