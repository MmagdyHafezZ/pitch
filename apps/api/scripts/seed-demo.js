#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { withAccelerate } = require('@prisma/extension-accelerate');
const { PrismaClient: UserPrismaClient } = require('@prisma/user-client');
const {
  PrismaClient: SimulationPrismaClient,
} = require('@prisma/simulation-client');
const { PrismaClient: SupportPrismaClient } = require('@prisma/support-client');
const {
  PrismaClient: AnalyticsPrismaClient,
} = require('@prisma/analytics-client');
const { PrismaClient: CrmPrismaClient } = require('@prisma/crm-client');
const { PrismaClient: LtiPrismaClient } = require('@prisma/lti-client');

const DEMO_PREFIX = 'demo_';
const DEMO_SEED_TAG = 'demo_seed_v1';
const SEED_NOW = new Date('2026-03-14T18:00:00.000Z');
const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function utc(year, month, day, hour = 12, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * ONE_MINUTE_MS);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * ONE_DAY_MS);
}

function daysAgo(days, hour = 15, minute = 0) {
  return addMinutes(addDays(SEED_NOW, -days), hour * 60 + minute - 18 * 60);
}

function daysFromNow(days, hour = 12, minute = 0) {
  return addMinutes(addDays(SEED_NOW, days), hour * 60 + minute - 18 * 60);
}

function avatarUrl(seed) {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
}

function storageUrl(key) {
  return `https://demo-assets.pitch.local/${key}`;
}

function textWordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function ensureEnvLoaded() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../../.env.local'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false });
    }
  }
}

function isAccelerateUrl(url) {
  return (
    typeof url === 'string' &&
    (url.startsWith('prisma://') || url.startsWith('prisma+'))
  );
}

function prismaUrlCandidates(urlEnv, directEnv) {
  const primary = process.env[urlEnv];
  const direct = process.env[directEnv];
  const preferPrimary = process.env.SEED_PREFER_PRIMARY_URL === '1';
  const allowPrimaryFallback = process.env.SEED_ALLOW_PRIMARY_FALLBACK === '1';

  if (preferPrimary) {
    return [...new Set([primary, direct].filter(Boolean))];
  }

  if (direct) {
    return allowPrimaryFallback
      ? [...new Set([direct, primary].filter(Boolean))]
      : [direct];
  }

  return primary ? [primary] : [];
}

function describeDatabaseTarget(url) {
  if (!url) return 'default datasource';
  if (isAccelerateUrl(url)) return 'Prisma Accelerate';

  try {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\/+/, '') || '(default)';
    const host = parsed.hostname || 'localhost';
    const port = parsed.port ? `:${parsed.port}` : '';
    return `${host}${port}/${database}`;
  } catch {
    return 'configured datasource';
  }
}

function buildPrismaClient(ClientCtor, url) {
  const client = new ClientCtor(
    url
      ? {
          datasources: {
            db: {
              url,
            },
          },
        }
      : undefined,
  );

  return isAccelerateUrl(url) ? client.$extends(withAccelerate()) : client;
}

async function connectPrismaClient(
  ClientCtor,
  urlEnv,
  directEnv,
  label = urlEnv,
) {
  const candidates = prismaUrlCandidates(urlEnv, directEnv);

  if (candidates.length === 0) {
    const client = buildPrismaClient(ClientCtor, undefined);
    await client.$connect();
    console.log(`${label}: connected using default datasource.`);
    return client;
  }

  let lastError = null;

  for (const candidate of candidates) {
    const client = buildPrismaClient(ClientCtor, candidate);
    try {
      await client.$connect();
      console.log(
        `${label}: connected to ${describeDatabaseTarget(candidate)}.`,
      );
      return client;
    } catch (error) {
      lastError = error;
      await client.$disconnect().catch(() => undefined);
    }
  }

  throw lastError;
}

function prismaErrorCode(error) {
  return typeof error?.code === 'string' ? error.code : null;
}

function isMissingPrismaSchemaError(error) {
  const code = prismaErrorCode(error);
  const message = String(error?.message || '');

  return (
    code === 'P2021' || code === 'P2022' || /does not exist/i.test(message)
  );
}

function logOptionalSkip(label, reason, error) {
  const code = prismaErrorCode(error);
  const suffix = code ? ` (${code})` : '';
  console.warn(`Skipping ${label}: ${reason}${suffix}.`);
}

async function connectOptionalPrismaClient(
  ClientCtor,
  urlEnv,
  directEnv,
  label,
) {
  try {
    return await connectPrismaClient(ClientCtor, urlEnv, directEnv, label);
  } catch (error) {
    logOptionalSkip(label, 'database connection is unavailable', error);
    return null;
  }
}

async function runOptionalPrismaSection(label, action) {
  try {
    await action();
    return true;
  } catch (error) {
    if (isMissingPrismaSchemaError(error)) {
      logOptionalSkip(label, 'database schema is not provisioned', error);
      return false;
    }

    throw error;
  }
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function chunk(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function scoreBreakdownFromCriterionScores(criteria, scores) {
  return Object.fromEntries(
    criteria.map((criterion, index) => [criterion.label, scores[index]]),
  );
}

function buildUserSettings(user) {
  return {
    account: { timezone: user.timezone },
    notifications: {
      emailNotifications: true,
      desktopNotifications: true,
      productUpdates: user.id !== 'demo_user_lucas',
    },
    voiceVideo: {
      preferredMicrophone: `${user.name} Mic`,
      preferredSpeaker: `${user.name} Headset`,
      noiseSuppression: true,
      echoCancellation: true,
      autoJoinMuted: false,
    },
    appearance: {
      colorMode: user.id === 'demo_user_grace' ? 'dark' : 'system',
      activeProfileId: `${user.id}_profile_default`,
      profiles: [],
      customDraft: {},
      customDraftGradient: false,
    },
    language: { locale: user.locale },
    browser: {
      openLinksInNewTab: true,
      compactMode: user.id === 'demo_user_ethan',
      reduceMotion: false,
    },
    crm: user.crm
      ? {
          name: user.crm.providerName,
          provider: user.crm.provider,
          connected: user.crm.connected,
          providerEmail: user.crm.providerEmail,
          lastSyncAt: user.crm.lastSyncAt,
          autoSync: user.crm.connected,
        }
      : {
          name: null,
          provider: null,
          connected: false,
          providerEmail: null,
          lastSyncAt: null,
          autoSync: false,
        },
    onboarding: {
      completed: true,
      tutorialCompleted: true,
      role: user.onboardingRole,
      careerInfo: {
        jobTitle: user.title,
        yearsOfExperience: user.experienceYears,
        industry: user.industry,
        linkedIn: `https://www.linkedin.com/in/${user.slug}`,
      },
    },
  };
}

function buildUserSnapshot(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    title: user.title,
    avatar: user.avatar,
    locale: user.locale,
  };
}

function buildOrgSnapshot(team) {
  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    region: team.region,
    industry: team.industry,
    planName: team.subscription.planName,
    timezone: team.timezone,
  };
}

const demoUsers = [
  {
    id: 'demo_user_ava',
    slug: 'ava-thompson',
    email: 'ava@pitchdemo.local',
    name: 'Ava Thompson',
    title: 'Revenue Enablement Lead',
    industry: 'B2B SaaS',
    experienceYears: 9,
    timezone: 'America/New_York',
    locale: 'en-US',
    onboardingRole: 'MANAGER',
    authProvider: 'GOOGLE',
    authProviderId: 'google-ava-thompson',
    avatar: avatarUrl('Ava Thompson'),
    createdAt: utc(2026, 1, 6, 14, 5),
    lastSeen: utc(2026, 3, 14, 17, 45),
    crm: {
      provider: 'salesforce',
      providerName: 'Salesforce',
      connected: true,
      providerEmail: 'ava.thompson@novarevenue.example',
      lastSyncAt: utc(2026, 3, 14, 16, 30).toISOString(),
    },
  },
  {
    id: 'demo_user_noah',
    slug: 'noah-patel',
    email: 'noah@pitchdemo.local',
    name: 'Noah Patel',
    title: 'Enterprise Sales Director',
    industry: 'Cybersecurity',
    experienceYears: 12,
    timezone: 'America/Chicago',
    locale: 'en-US',
    onboardingRole: 'MANAGER',
    authProvider: 'MICROSOFT',
    authProviderId: 'microsoft-noah-patel',
    avatar: avatarUrl('Noah Patel'),
    createdAt: utc(2026, 1, 10, 9, 20),
    lastSeen: utc(2026, 3, 14, 17, 20),
    crm: {
      provider: 'hubspot',
      providerName: 'HubSpot',
      connected: true,
      providerEmail: 'noah.patel@heliocloud.example',
      lastSyncAt: utc(2026, 3, 14, 15, 5).toISOString(),
    },
  },
  {
    id: 'demo_user_mia',
    slug: 'mia-chen',
    email: 'mia@pitchdemo.local',
    name: 'Mia Chen',
    title: 'Senior SDR',
    industry: 'B2B SaaS',
    experienceYears: 4,
    timezone: 'America/Los_Angeles',
    locale: 'en-US',
    onboardingRole: 'EMPLOYEE',
    authProvider: 'GOOGLE',
    authProviderId: 'google-mia-chen',
    avatar: avatarUrl('Mia Chen'),
    createdAt: utc(2026, 1, 12, 11, 10),
    lastSeen: utc(2026, 3, 14, 16, 5),
  },
  {
    id: 'demo_user_lucas',
    slug: 'lucas-meyer',
    email: 'lucas@pitchdemo.local',
    name: 'Lucas Meyer',
    title: 'Solutions Engineer',
    industry: 'AI Infrastructure',
    experienceYears: 7,
    timezone: 'America/Denver',
    locale: 'en-US',
    onboardingRole: 'EMPLOYEE',
    authProvider: 'MICROSOFT',
    authProviderId: 'microsoft-lucas-meyer',
    avatar: avatarUrl('Lucas Meyer'),
    createdAt: utc(2026, 1, 15, 8, 45),
    lastSeen: utc(2026, 3, 13, 22, 10),
  },
  {
    id: 'demo_user_sofia',
    slug: 'sofia-alvarez',
    email: 'sofia@pitchdemo.local',
    name: 'Sofia Alvarez',
    title: 'Customer Success Manager',
    industry: 'Cloud Operations',
    experienceYears: 8,
    timezone: 'America/Mexico_City',
    locale: 'en-US',
    onboardingRole: 'MANAGER',
    authProvider: 'GOOGLE',
    authProviderId: 'google-sofia-alvarez',
    avatar: avatarUrl('Sofia Alvarez'),
    createdAt: utc(2026, 1, 17, 13, 25),
    lastSeen: utc(2026, 3, 14, 14, 55),
  },
  {
    id: 'demo_user_ethan',
    slug: 'ethan-brooks',
    email: 'ethan@pitchdemo.local',
    name: 'Ethan Brooks',
    title: 'Enablement Coach',
    industry: 'Sales Training',
    experienceYears: 10,
    timezone: 'America/Los_Angeles',
    locale: 'en-US',
    onboardingRole: 'MANAGER',
    authProvider: 'MICROSOFT',
    authProviderId: 'microsoft-ethan-brooks',
    avatar: avatarUrl('Ethan Brooks'),
    createdAt: utc(2026, 1, 18, 16, 15),
    lastSeen: utc(2026, 3, 14, 13, 40),
  },
  {
    id: 'demo_user_grace',
    slug: 'grace-kim',
    email: 'grace@pitchdemo.local',
    name: 'Grace Kim',
    title: 'Sales Operations Manager',
    industry: 'Revenue Operations',
    experienceYears: 11,
    timezone: 'America/Toronto',
    locale: 'en-US',
    onboardingRole: 'MANAGER',
    authProvider: 'GOOGLE',
    authProviderId: 'google-grace-kim',
    avatar: avatarUrl('Grace Kim'),
    createdAt: utc(2026, 1, 20, 10, 50),
    lastSeen: utc(2026, 3, 13, 20, 15),
    crm: {
      provider: 'salesforce',
      providerName: 'Salesforce',
      connected: false,
      providerEmail: 'grace.kim@novarevenue.example',
      lastSyncAt: utc(2026, 3, 10, 18, 0).toISOString(),
    },
  },
  {
    id: 'demo_user_olivia',
    slug: 'olivia-carter',
    email: 'olivia@pitchdemo.local',
    name: 'Olivia Carter',
    title: 'Learning Program Manager',
    industry: 'Higher Education',
    experienceYears: 6,
    timezone: 'America/Denver',
    locale: 'en-US',
    onboardingRole: 'MANAGER',
    authProvider: 'MICROSOFT',
    authProviderId: 'microsoft-olivia-carter',
    avatar: avatarUrl('Olivia Carter'),
    createdAt: utc(2026, 1, 22, 9, 5),
    lastSeen: utc(2026, 3, 14, 12, 25),
  },
];

const teamDefinitions = [
  {
    id: 'demo_team_nova',
    name: 'Nova Revenue Lab',
    slug: 'nova-revenue-lab',
    region: 'NA-East',
    industry: 'B2B SaaS',
    timezone: 'America/New_York',
    locale: 'en-US',
    billingEmail: 'finance@nova-demo.local',
    billingAddress: {
      company: 'Nova Revenue Lab',
      line1: '245 Mercer St',
      city: 'New York',
      state: 'NY',
      postalCode: '10012',
      country: 'US',
    },
    notes: 'Primary enterprise sales demo organization.',
    tags: ['enterprise', 'forecasting', 'enablement'],
    createdAt: utc(2026, 1, 25, 14, 0),
    subscription: {
      id: 'demo_subscription_nova',
      planKey: 'sales_team',
      planName: 'Sales Team',
      interval: 'MONTH',
      currentPeriodStart: utc(2026, 3, 1, 0, 0),
      currentPeriodEnd: utc(2026, 4, 1, 0, 0),
      allowance: 40000,
      used: 25150,
      remaining: 14850,
      seats: 12,
      notes: 'Quarterly enablement pilot with live coaching enabled.',
    },
    memberships: [
      {
        id: 'demo_membership_nova_ava',
        userId: 'demo_user_ava',
        role: 'OWNER',
        tokenLimit: 20000,
        acceptedAt: utc(2026, 1, 25, 14, 5),
      },
      {
        id: 'demo_membership_nova_mia',
        userId: 'demo_user_mia',
        role: 'ADMIN',
        tokenLimit: 12000,
        acceptedAt: utc(2026, 1, 26, 11, 0),
      },
      {
        id: 'demo_membership_nova_lucas',
        userId: 'demo_user_lucas',
        role: 'MEMBER',
        tokenLimit: 9000,
        acceptedAt: utc(2026, 1, 27, 9, 30),
      },
      {
        id: 'demo_membership_nova_grace',
        userId: 'demo_user_grace',
        role: 'MEMBER',
        tokenLimit: 8000,
        acceptedAt: utc(2026, 1, 27, 13, 0),
      },
    ],
    pendingSignupInvites: [
      {
        email: 'camila@pitchdemo.local',
        role: 'MEMBER',
        invitedAt: utc(2026, 3, 12, 18, 20).toISOString(),
        invitedByUserId: 'demo_user_ava',
      },
    ],
  },
  {
    id: 'demo_team_helio',
    name: 'Helio Enterprise Sales',
    slug: 'helio-enterprise-sales',
    region: 'NA-Central',
    industry: 'Cloud Security',
    timezone: 'America/Chicago',
    locale: 'en-US',
    billingEmail: 'billing@helio-demo.local',
    billingAddress: {
      company: 'Helio Enterprise Sales',
      line1: '800 Congress Ave',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
    },
    notes:
      'Global enterprise team handling renewal and board-level narratives.',
    tags: ['renewal', 'security', 'executive'],
    createdAt: utc(2026, 1, 28, 15, 0),
    subscription: {
      id: 'demo_subscription_helio',
      planKey: 'enterprise',
      planName: 'Enterprise',
      interval: 'ANNUAL',
      currentPeriodStart: utc(2026, 1, 1, 0, 0),
      currentPeriodEnd: utc(2027, 1, 1, 0, 0),
      allowance: 120000,
      used: 68420,
      remaining: 51580,
      seats: 40,
      notes: 'Board reporting workspace with CRM sync and assessment exports.',
    },
    memberships: [
      {
        id: 'demo_membership_helio_noah',
        userId: 'demo_user_noah',
        role: 'OWNER',
        tokenLimit: 40000,
        acceptedAt: utc(2026, 1, 28, 15, 10),
      },
      {
        id: 'demo_membership_helio_sofia',
        userId: 'demo_user_sofia',
        role: 'ADMIN',
        tokenLimit: 24000,
        acceptedAt: utc(2026, 1, 29, 10, 10),
      },
      {
        id: 'demo_membership_helio_ethan',
        userId: 'demo_user_ethan',
        role: 'MEMBER',
        tokenLimit: 18000,
        acceptedAt: utc(2026, 1, 29, 14, 45),
      },
    ],
    pendingSignupInvites: [
      {
        email: 'boardroom-observer@pitchdemo.local',
        role: 'MEMBER',
        invitedAt: utc(2026, 3, 9, 16, 0).toISOString(),
        invitedByUserId: 'demo_user_noah',
      },
    ],
  },
  {
    id: 'demo_team_academy',
    name: 'Northwind Academy',
    slug: 'northwind-academy',
    region: 'NA-West',
    industry: 'Higher Education',
    timezone: 'America/Denver',
    locale: 'en-US',
    billingEmail: 'ops@academy-demo.local',
    billingAddress: {
      company: 'Northwind Academy',
      line1: '1201 17th St',
      city: 'Denver',
      state: 'CO',
      postalCode: '80202',
      country: 'US',
    },
    notes: 'LTI-enabled enablement sandbox for academic and instructor demos.',
    tags: ['lti', 'learning', 'coaching'],
    createdAt: utc(2026, 2, 2, 12, 30),
    subscription: {
      id: 'demo_subscription_academy',
      planKey: 'growth',
      planName: 'Growth',
      interval: 'QUARTER',
      currentPeriodStart: utc(2026, 2, 1, 0, 0),
      currentPeriodEnd: utc(2026, 5, 1, 0, 0),
      allowance: 15000,
      used: 4820,
      remaining: 10180,
      seats: 20,
      notes: 'Faculty training cohort with LMS launch tracking.',
    },
    memberships: [
      {
        id: 'demo_membership_academy_olivia',
        userId: 'demo_user_olivia',
        role: 'OWNER',
        tokenLimit: 8000,
        acceptedAt: utc(2026, 2, 2, 12, 40),
      },
      {
        id: 'demo_membership_academy_ethan',
        userId: 'demo_user_ethan',
        role: 'ADMIN',
        tokenLimit: 5000,
        acceptedAt: utc(2026, 2, 3, 9, 15),
      },
      {
        id: 'demo_membership_academy_ava',
        userId: 'demo_user_ava',
        role: 'MEMBER',
        tokenLimit: 3000,
        acceptedAt: utc(2026, 2, 3, 15, 0),
      },
    ],
    pendingSignupInvites: [
      {
        email: 'faculty-observer@pitchdemo.local',
        role: 'MEMBER',
        invitedAt: utc(2026, 3, 11, 12, 45).toISOString(),
        invitedByUserId: 'demo_user_olivia',
      },
    ],
  },
];

const planCatalog = [
  {
    key: 'starter',
    id: 'demo_plan_starter',
    name: 'Starter',
    description: 'Lightweight coaching for individual reps and small pilots.',
    planLevel: 'FREE',
    maxCoins: 6000,
  },
  {
    key: 'growth',
    id: 'demo_plan_growth',
    name: 'Growth',
    description:
      'Expanded practice volume with coaching exports and templates.',
    planLevel: 'PRO',
    maxCoins: 15000,
  },
  {
    key: 'sales_team',
    id: 'demo_plan_sales_team',
    name: 'Sales Team',
    description:
      'Cross-functional enablement workspace for team managers and AEs.',
    planLevel: 'TEAM',
    maxCoins: 40000,
  },
  {
    key: 'enterprise',
    id: 'demo_plan_enterprise',
    name: 'Enterprise',
    description:
      'Enterprise rollouts with CRM sync, reporting, and admin controls.',
    planLevel: 'ENTERPRISE',
    maxCoins: 120000,
  },
];

const personaDefinitions = [
  {
    id: 'demo_persona_nova_elena',
    orgId: 'demo_team_nova',
    name: 'Elena Vasquez',
    traits: {
      role: 'CFO',
      company: 'Northwind Robotics',
      style: 'Analytical and skeptical',
      priorities: ['forecast confidence', 'payback clarity', 'board readiness'],
      objections: ['security review', 'change management overhead'],
      avatar: { imageUrl: avatarUrl('Elena Vasquez CFO') },
      voice: { tone: 'measured', pace: 'calm' },
    },
    createdAt: utc(2026, 2, 5, 10, 0),
  },
  {
    id: 'demo_persona_nova_marcus',
    orgId: 'demo_team_nova',
    name: 'Marcus Hill',
    traits: {
      role: 'VP Revenue Operations',
      company: 'Northwind Robotics',
      style: 'Methodical and detail oriented',
      priorities: ['clean CRM process', 'manager adoption', 'forecast hygiene'],
      objections: ['integration complexity', 'rep workflow disruption'],
      avatar: { imageUrl: avatarUrl('Marcus Hill RevOps') },
      voice: { tone: 'direct', pace: 'steady' },
    },
    createdAt: utc(2026, 2, 5, 10, 5),
  },
  {
    id: 'demo_persona_helio_rina',
    orgId: 'demo_team_helio',
    name: 'Rina Das',
    traits: {
      role: 'CIO',
      company: 'Helio Cloud',
      style: 'Strategic and security minded',
      priorities: [
        'risk reduction',
        'global alignment',
        'vendor accountability',
      ],
      objections: ['data residency', 'identity governance'],
      avatar: { imageUrl: avatarUrl('Rina Das CIO') },
      voice: { tone: 'low', pace: 'measured' },
    },
    createdAt: utc(2026, 2, 6, 9, 0),
  },
  {
    id: 'demo_persona_helio_tom',
    orgId: 'demo_team_helio',
    name: 'Tom Walker',
    traits: {
      role: 'Procurement Director',
      company: 'Helio Cloud',
      style: 'Commercially sharp',
      priorities: [
        'pricing leverage',
        'renewal protection',
        'measurable outcomes',
      ],
      objections: [
        'discount pressure',
        'referenceability',
        'competitive pressure',
      ],
      avatar: { imageUrl: avatarUrl('Tom Walker Procurement') },
      voice: { tone: 'firm', pace: 'brisk' },
    },
    createdAt: utc(2026, 2, 6, 9, 5),
  },
  {
    id: 'demo_persona_academy_dana',
    orgId: 'demo_team_academy',
    name: 'Dana Ellis',
    traits: {
      role: 'Program Director',
      company: 'Northwind Academy',
      style: 'Curious and outcomes focused',
      priorities: [
        'learner engagement',
        'faculty adoption',
        'assessment clarity',
      ],
      objections: ['curriculum fit', 'LTI launch friction'],
      avatar: { imageUrl: avatarUrl('Dana Ellis Program Director') },
      voice: { tone: 'warm', pace: 'steady' },
    },
    createdAt: utc(2026, 2, 7, 8, 45),
  },
  {
    id: 'demo_persona_academy_jordan',
    orgId: 'demo_team_academy',
    name: 'Jordan Kim',
    traits: {
      role: 'MBA Learner',
      company: 'Northwind Academy',
      style: 'Ambitious and fast moving',
      priorities: [
        'actionable feedback',
        'clear next step',
        'career relevance',
      ],
      objections: ['generic coaching', 'unclear scoring'],
      avatar: { imageUrl: avatarUrl('Jordan Kim MBA Learner') },
      voice: { tone: 'energetic', pace: 'quick' },
    },
    createdAt: utc(2026, 2, 7, 8, 50),
  },
];

const scenarioDefinitions = [
  {
    id: 'demo_scenario_nova_discovery',
    orgId: 'demo_team_nova',
    name: 'Forecast Confidence Discovery',
    description:
      'Diagnose late-stage forecast drift before the next board review.',
    config: {
      objective: 'Earn agreement on a scoped pilot for forecast visibility.',
      durationMinutes: 28,
      stages: [
        {
          label: 'Context',
          description: 'Set the board-review stakes.',
          duration: 5,
        },
        {
          label: 'Diagnosis',
          description: 'Locate the largest forecast breakdown.',
          duration: 8,
        },
        {
          label: 'Value',
          description: 'Translate the process gap into business impact.',
          duration: 8,
        },
        {
          label: 'Pilot',
          description: 'Land a small next step with accountability.',
          duration: 7,
        },
      ],
    },
    createdAt: utc(2026, 2, 8, 9, 0),
  },
  {
    id: 'demo_scenario_nova_security',
    orgId: 'demo_team_nova',
    name: 'Security Review for Revenue AI',
    description:
      'Navigate security, redaction, and SSO concerns without losing momentum.',
    config: {
      objective:
        'Reduce risk concerns and secure a technical validation workshop.',
      durationMinutes: 24,
      stages: [
        {
          label: 'Risk Framing',
          description: 'Invite the security concerns up front.',
          duration: 4,
        },
        {
          label: 'Controls',
          description: 'Map controls to concrete objections.',
          duration: 9,
        },
        {
          label: 'Governance',
          description: 'Clarify ownership and rollout guardrails.',
          duration: 6,
        },
        {
          label: 'Validation',
          description: 'Book the technical follow-up.',
          duration: 5,
        },
      ],
    },
    createdAt: utc(2026, 2, 8, 9, 10),
  },
  {
    id: 'demo_scenario_helio_renewal',
    orgId: 'demo_team_helio',
    name: 'Renewal Rescue',
    description:
      'Reframe an at-risk renewal around adoption, value proof, and executive confidence.',
    config: {
      objective:
        'Stabilize the renewal and gain executive sponsorship for remediation.',
      durationMinutes: 25,
      stages: [
        {
          label: 'Renewal Status',
          description: 'Understand the urgency and downside.',
          duration: 5,
        },
        {
          label: 'Adoption Gaps',
          description: 'Pinpoint why value stalled.',
          duration: 8,
        },
        {
          label: 'Recovery Plan',
          description: 'Show the path to measurable recovery.',
          duration: 7,
        },
        {
          label: 'Decision',
          description: 'Close on a next meeting and owners.',
          duration: 5,
        },
      ],
    },
    createdAt: utc(2026, 2, 8, 10, 0),
  },
  {
    id: 'demo_scenario_helio_exec',
    orgId: 'demo_team_helio',
    name: 'Boardroom Narrative',
    description:
      'Lead an executive presentation that links commercial value to rollout risk.',
    config: {
      objective: 'Win confidence for a global rollout recommendation.',
      durationMinutes: 30,
      stages: [
        {
          label: 'Executive Framing',
          description: 'Set the strategic stakes.',
          duration: 6,
        },
        {
          label: 'Commercial Case',
          description: 'Tie economics to business outcomes.',
          duration: 8,
        },
        {
          label: 'Risk Plan',
          description: 'Address rollout, security, and governance.',
          duration: 8,
        },
        {
          label: 'Decision Path',
          description: 'Define approval milestones.',
          duration: 8,
        },
      ],
    },
    createdAt: utc(2026, 2, 8, 10, 10),
  },
  {
    id: 'demo_scenario_academy_lti',
    orgId: 'demo_team_academy',
    name: 'LTI Launch Readiness',
    description:
      'Coach a program director through an LMS-integrated simulation rollout.',
    config: {
      objective:
        'Align on an LTI launch plan with clear faculty and learner outcomes.',
      durationMinutes: 22,
      stages: [
        {
          label: 'Launch Goals',
          description: 'Clarify what success looks like.',
          duration: 5,
        },
        {
          label: 'Course Fit',
          description: 'Map simulations to learning objectives.',
          duration: 6,
        },
        {
          label: 'Assessment Design',
          description: 'Define scoring and facilitation.',
          duration: 6,
        },
        {
          label: 'Rollout',
          description: 'Land the implementation plan.',
          duration: 5,
        },
      ],
    },
    createdAt: utc(2026, 2, 8, 10, 20),
  },
];

const rubricCatalog = [
  {
    id: 'demo_rubric_consultative',
    orgId: 'demo_team_nova',
    name: 'Consultative Selling',
    version: 1,
    criteria: [
      {
        id: 'demo_criterion_consultative_discovery',
        label: 'Discovery Depth',
        maxPoints: 25,
        weight: 0.25,
        order: 1,
      },
      {
        id: 'demo_criterion_consultative_value',
        label: 'Value Framing',
        maxPoints: 25,
        weight: 0.25,
        order: 2,
      },
      {
        id: 'demo_criterion_consultative_risk',
        label: 'Objection Handling',
        maxPoints: 25,
        weight: 0.25,
        order: 3,
      },
      {
        id: 'demo_criterion_consultative_next_step',
        label: 'Clear Next Step',
        maxPoints: 25,
        weight: 0.25,
        order: 4,
      },
    ],
  },
  {
    id: 'demo_rubric_executive',
    orgId: 'demo_team_helio',
    name: 'Executive Alignment',
    version: 1,
    criteria: [
      {
        id: 'demo_criterion_exec_narrative',
        label: 'Executive Narrative',
        maxPoints: 25,
        weight: 0.25,
        order: 1,
      },
      {
        id: 'demo_criterion_exec_change',
        label: 'Change Management',
        maxPoints: 25,
        weight: 0.25,
        order: 2,
      },
      {
        id: 'demo_criterion_exec_risk',
        label: 'Risk Mitigation',
        maxPoints: 25,
        weight: 0.25,
        order: 3,
      },
      {
        id: 'demo_criterion_exec_close',
        label: 'Commercial Close',
        maxPoints: 25,
        weight: 0.25,
        order: 4,
      },
    ],
  },
  {
    id: 'demo_rubric_coaching',
    orgId: 'demo_team_academy',
    name: 'Coaching Fundamentals',
    version: 1,
    criteria: [
      {
        id: 'demo_criterion_coaching_questions',
        label: 'Question Quality',
        maxPoints: 25,
        weight: 0.25,
        order: 1,
      },
      {
        id: 'demo_criterion_coaching_relevance',
        label: 'Relevance',
        maxPoints: 25,
        weight: 0.25,
        order: 2,
      },
      {
        id: 'demo_criterion_coaching_specificity',
        label: 'Specificity',
        maxPoints: 25,
        weight: 0.25,
        order: 3,
      },
      {
        id: 'demo_criterion_coaching_actionability',
        label: 'Actionability',
        maxPoints: 25,
        weight: 0.25,
        order: 4,
      },
    ],
  },
];

const richSessionSeeds = [
  {
    key: 'nova_discovery',
    id: 'demo_session_nova_discovery',
    teamId: 'demo_team_nova',
    ownerId: 'demo_user_ava',
    collaboratorIds: ['demo_user_grace'],
    type: 'text',
    status: 'ended',
    scenarioId: 'demo_scenario_nova_discovery',
    personaId: 'demo_persona_nova_elena',
    rubricId: 'demo_rubric_consultative',
    name: 'Q2 CFO discovery rehearsal',
    tags: ['discovery', 'cfo', 'forecast'],
    language: 'en-US',
    crmContextId: 'demo_crm_ctx_nova_q2',
    createdAt: utc(2026, 3, 2, 15, 0),
    startedAt: utc(2026, 3, 2, 15, 2),
    endedAt: utc(2026, 3, 2, 15, 30),
    sessionConfig: {
      multiTurnEnabled: true,
      durationMinutes: 28,
      stages: ['Context', 'Diagnosis', 'Value', 'Pilot'],
      coaching: { style: 'concise', focus: 'board impact' },
    },
    conversation: [
      {
        role: 'user',
        text: 'Thanks for making time, Elena. Before I show the platform, what changed in your forecast process this quarter?',
      },
      {
        role: 'assistant',
        text: 'Our CFO review exposed too much manual spreadsheet work. Forecast accuracy is drifting and my team no longer trusts the late-stage commits.',
      },
      {
        role: 'user',
        text: 'Where is that drift showing up most: rep hygiene, manager inspection, or late-stage slippage?',
      },
      {
        role: 'assistant',
        text: 'Late-stage slippage. Managers update too late, and the board packet gets rebuilt at the last minute.',
      },
      {
        role: 'user',
        text: 'If you could fix that before the next board cycle, what outcome would matter most to you?',
      },
      {
        role: 'assistant',
        text: 'Confidence. I need a forecast I can defend without three nights of cleanup and side spreadsheets.',
      },
      {
        role: 'user',
        text: 'That helps. We usually start with one regional team, surface risk weekly, and show variance by manager. Would a 30-day pilot be reasonable if security stays light?',
      },
      {
        role: 'assistant',
        text: 'Possibly. If your team can prove a clean rollout and measurable variance reduction, I would sponsor the pilot.',
      },
    ],
    toolCallSpecs: [
      {
        turnOrder: 5,
        name: 'crm_lookup_account',
        input: {
          accountName: 'Northwind Robotics',
          fields: ['forecast_accuracy', 'stage_velocity'],
        },
        output: {
          forecastAccuracy: 0.71,
          stageVelocityDelta: -0.18,
          boardReviewDate: '2026-03-28',
        },
        success: true,
        latencyMs: 184,
      },
    ],
    draftEmails: [
      {
        audience: 'CFO sponsor',
        purpose: 'Pilot recap',
        tone: 'executive',
        bullets: [
          'Summarize the forecast risk the pilot will reduce.',
          'Confirm pilot scope: one region, weekly variance review, board-ready roll-up.',
          'Request a technical validation slot with RevOps and security.',
        ],
        body: 'Elena, thanks again for the candid overview. I captured the late-stage slippage issue, the board-risk concern, and the need for a lightweight rollout. I suggest a 30-day pilot focused on one region with weekly variance reviews, manager adoption tracking, and a board-ready scorecard. If this direction still fits, I can bring our RevOps specialist and security lead to the next session.',
      },
    ],
    metrics: {
      tokensInput: 1420,
      tokensOutput: 1860,
      toolCount: 1,
      latencyMs: 884,
      costUsd: 0.42,
      model: 'gpt-4o-mini',
    },
    assessment: {
      mode: 'final',
      scoreItems: [
        {
          score: 24,
          details:
            'Opened with a business-context question tied to the board cycle.',
        },
        {
          score: 19,
          details: 'Connected the pilot to measurable variance reduction.',
        },
        {
          score: 18,
          details:
            'Handled rollout concern, but security proof could have been more concrete.',
        },
        {
          score: 20,
          details: 'Secured conditional sponsorship and a technical next step.',
        },
      ],
      narrativeSummary:
        'Strong discovery posture. The conversation stayed anchored on forecast confidence and board readiness, and the pilot landed with real business relevance.',
      coachTips: [
        {
          text: 'Lead the security answer with the exact control owner before discussing rollout sequence.',
          link: '/studio/team-config',
        },
        {
          text: 'Name the variance metric you will improve during the pilot to sharpen executive confidence.',
        },
      ],
      labels: [
        {
          turnOrder: 1,
          label: 'PositiveExample',
          confidence: 0.91,
          scoreDelta: 1.2,
          evidence: 'what changed in your forecast process',
        },
        {
          turnOrder: 3,
          label: 'InsightfulQuestion',
          confidence: 0.97,
          scoreDelta: 2.6,
          evidence: 'rep hygiene, manager inspection, or late-stage slippage',
        },
        {
          turnOrder: 5,
          label: 'ObjectiveMet',
          confidence: 0.88,
          scoreDelta: 1.4,
          evidence: 'what outcome would matter most to you',
        },
        {
          turnOrder: 7,
          label: 'PositiveExample',
          confidence: 0.9,
          scoreDelta: 1.8,
          evidence: 'Would a 30-day pilot be reasonable',
        },
      ],
      insights: {
        strengths: [
          'Created urgency with board context.',
          'Sequenced discovery before pitching.',
          'Closed on a clear pilot motion.',
        ],
        areasForImprovement: [
          'Make the security proof more specific.',
          'Quantify the baseline variance earlier.',
        ],
        recommendations: [
          'Anchor the follow-up in one measurable success metric.',
          'Bring security and RevOps to the next call.',
        ],
      },
    },
  },
  {
    key: 'nova_security_voice',
    id: 'demo_session_nova_security_voice',
    teamId: 'demo_team_nova',
    ownerId: 'demo_user_lucas',
    collaboratorIds: ['demo_user_ava'],
    type: 'voice',
    status: 'ended',
    scenarioId: 'demo_scenario_nova_security',
    personaId: 'demo_persona_nova_marcus',
    rubricId: 'demo_rubric_consultative',
    name: 'Security validation call',
    tags: ['security', 'voice', 'revops'],
    language: 'en-US',
    crmContextId: 'demo_crm_ctx_nova_security',
    createdAt: utc(2026, 3, 5, 17, 0),
    startedAt: utc(2026, 3, 5, 17, 3),
    endedAt: utc(2026, 3, 5, 17, 27),
    sessionConfig: {
      multiTurnEnabled: true,
      durationMinutes: 24,
      phoneProvider: 'vapi',
      voice: { provider: 'elevenlabs', style: 'calm' },
      stages: ['Risk Framing', 'Controls', 'Governance', 'Validation'],
    },
    conversation: [
      {
        role: 'user',
        text: 'Before we ask your sellers to record calls, I want to be clear on how data is stored and redacted.',
      },
      {
        role: 'assistant',
        text: 'That is exactly my concern. I cannot introduce another tool that creates a shadow archive of customer conversations.',
      },
      {
        role: 'user',
        text: 'Totally fair. Which control matters most to your security review: residency, SSO, retention policy, or redaction before storage?',
      },
      {
        role: 'assistant',
        text: 'Residency and redaction. If those are hand-wavy, the review stops there.',
      },
      {
        role: 'user',
        text: 'We can scope residency at the workspace level, enforce SSO, and apply redaction rules before transcripts are exposed to reps. Would your team want a configuration workshop or a written control map first?',
      },
      {
        role: 'assistant',
        text: 'A written control map first, then a workshop if the reviewers like the answers.',
      },
      {
        role: 'user',
        text: 'Great. I will send the control map with owner, retention window, and escalation path, then we can review it with security and RevOps together next week.',
      },
      {
        role: 'assistant',
        text: 'If the document is concrete, I can bring the reviewers into that session.',
      },
    ],
    toolCallSpecs: [
      {
        turnOrder: 5,
        name: 'security_control_lookup',
        input: { controls: ['residency', 'redaction', 'sso'] },
        output: {
          residency: 'workspace-level',
          redaction: 'pre-exposure',
          sso: 'saml/oidc',
        },
        success: true,
        latencyMs: 122,
      },
    ],
    transcript: {
      assetId: 'demo_asset_nova_security_voice_recording',
      mimeType: 'audio/wav',
      storageKey: 'recordings/nova-security-validation.wav',
      durationMs: 144000,
      summary:
        'Security objections centered on residency and redaction. The rep answered with concrete controls and secured a document-first next step.',
      topics: [
        { label: 'data residency', confidence: 0.96 },
        { label: 'redaction', confidence: 0.94 },
        { label: 'review process', confidence: 0.81 },
      ],
      sentiment: { overall: 0.31, trend: 'improving' },
    },
    metrics: {
      tokensInput: 1180,
      tokensOutput: 1325,
      toolCount: 1,
      latencyMs: 731,
      costUsd: 0.33,
      model: 'gpt-4o-mini',
    },
    assessment: {
      mode: 'final',
      scoreItems: [
        {
          score: 21,
          details:
            'Opened with the right risk area, but could have clarified reviewer roles sooner.',
        },
        {
          score: 20,
          details:
            'Mapped the value of redaction and residency to approval progress.',
        },
        {
          score: 17,
          details:
            'Controls were clear, though one concrete retention example would help.',
        },
        {
          score: 19,
          details:
            'Secured a written control-map next step with the right stakeholders.',
        },
      ],
      narrativeSummary:
        'Good technical credibility. The conversation stayed practical and reduced uncertainty by using a document-first validation path.',
      coachTips: [
        {
          text: 'Name one exact retention default to make the governance answer feel finished.',
        },
        {
          text: 'Ask who signs off on the control map so the next step has a clear owner.',
        },
      ],
      labels: [
        {
          turnOrder: 1,
          label: 'PositiveExample',
          confidence: 0.84,
          scoreDelta: 1.0,
          evidence: 'how data is stored and redacted',
        },
        {
          turnOrder: 3,
          label: 'InsightfulQuestion',
          confidence: 0.93,
          scoreDelta: 2.1,
          evidence: 'residency, SSO, retention policy, or redaction',
        },
        {
          turnOrder: 5,
          label: 'ObjectiveMet',
          confidence: 0.82,
          scoreDelta: 1.3,
          evidence: 'configuration workshop or a written control map first',
        },
        {
          turnOrder: 7,
          label: 'PositiveExample',
          confidence: 0.87,
          scoreDelta: 1.5,
          evidence: 'owner, retention window, and escalation path',
        },
      ],
      insights: {
        strengths: [
          'Reframed risk into a review sequence.',
          'Answered with controls instead of abstractions.',
        ],
        areasForImprovement: [
          'Could quantify the retention default.',
          'Could confirm the final reviewer earlier.',
        ],
        recommendations: [
          'Bring a one-page control matrix to the next call.',
          'Close by naming the approver and timeline.',
        ],
      },
    },
  },
  {
    key: 'nova_boardroom_video',
    id: 'demo_session_nova_boardroom_video',
    teamId: 'demo_team_nova',
    ownerId: 'demo_user_mia',
    collaboratorIds: ['demo_user_ava'],
    inviteeId: 'demo_user_grace',
    type: 'video',
    status: 'active',
    scenarioId: 'demo_scenario_nova_discovery',
    personaId: 'demo_persona_nova_elena',
    name: 'Boardroom narrative dry run',
    tags: ['video', 'executive', 'active'],
    language: 'en-US',
    crmContextId: 'demo_crm_ctx_nova_boardroom',
    createdAt: utc(2026, 3, 14, 16, 0),
    startedAt: utc(2026, 3, 14, 16, 5),
    endedAt: null,
    sessionConfig: {
      multiTurnEnabled: true,
      durationMinutes: 20,
      video: {
        provider: 'heygen',
        runtime: {
          status: 'queued',
          provider: 'heygen',
          activeJobId: 'demo_video_job_nova_boardroom',
        },
      },
      stages: ['Executive Framing', 'Commercial Case', 'Decision Path'],
    },
    conversation: [
      {
        role: 'user',
        text: 'I want to practice the opening for the board update before we talk discount strategy.',
      },
      {
        role: 'assistant',
        text: 'Good. Keep it high level first. Why does this board care now?',
      },
      {
        role: 'user',
        text: 'Because forecast slippage is exposing revenue risk and leadership wants more predictable inspection.',
      },
      {
        role: 'assistant',
        text: 'That is the right theme. Tighten the proof point and then connect it to the pilot outcome.',
      },
    ],
    toolCallSpecs: [
      {
        turnOrder: 4,
        name: 'talk_track_scorer',
        input: {
          audience: 'board',
          message: 'forecast slippage exposes revenue risk',
        },
        output: {
          clarity: 0.82,
          brevity: 0.76,
          recommendation: 'add one numeric proof point',
        },
        success: true,
        latencyMs: 97,
      },
    ],
    metrics: {
      tokensInput: 540,
      tokensOutput: 612,
      toolCount: 1,
      latencyMs: 441,
      costUsd: 0.12,
      model: 'gpt-4o-mini',
    },
    call: {
      id: 'demo_call_nova_boardroom_video',
      tracks: ['audio', 'video'],
      status: 'active',
    },
  },
  {
    key: 'helio_renewal',
    id: 'demo_session_helio_renewal',
    teamId: 'demo_team_helio',
    ownerId: 'demo_user_noah',
    collaboratorIds: ['demo_user_sofia'],
    type: 'text',
    status: 'ended',
    scenarioId: 'demo_scenario_helio_renewal',
    personaId: 'demo_persona_helio_tom',
    rubricId: 'demo_rubric_executive',
    name: 'At-risk renewal recovery',
    tags: ['renewal', 'commercial', 'text'],
    language: 'en-US',
    crmContextId: 'demo_crm_ctx_helio_renewal',
    createdAt: utc(2026, 3, 8, 14, 0),
    startedAt: utc(2026, 3, 8, 14, 2),
    endedAt: utc(2026, 3, 8, 14, 28),
    sessionConfig: {
      multiTurnEnabled: true,
      durationMinutes: 26,
      stages: ['Renewal Status', 'Adoption Gaps', 'Recovery Plan', 'Decision'],
    },
    conversation: [
      {
        role: 'user',
        text: 'Tom, I know the renewal is under pressure. Before I talk pricing, what is driving the hesitation internally?',
      },
      {
        role: 'assistant',
        text: 'Adoption is shallow. My leadership team does not want to reward shelfware with another year of spend.',
      },
      {
        role: 'user',
        text: 'Where is adoption failing most: manager follow-through, rep habit change, or unclear success metrics?',
      },
      {
        role: 'assistant',
        text: 'Manager follow-through. The launch looked good, but inspection discipline faded after the first month.',
      },
      {
        role: 'user',
        text: 'If we reset around one manager-led cadence and prove one measurable outcome in 45 days, would that change the renewal conversation?',
      },
      {
        role: 'assistant',
        text: 'It could, but I would need a concrete owner and weekly evidence, not another vague enablement promise.',
      },
      {
        role: 'user',
        text: 'Then let us make it specific. We will run a manager scorecard each Friday, track coaching completion, and review progress with you and Sofia in week two and week four.',
      },
      {
        role: 'assistant',
        text: 'That is stronger. Put it in writing, and I can bring it back to procurement as the recovery plan.',
      },
    ],
    toolCallSpecs: [
      {
        turnOrder: 7,
        name: 'renewal_risk_score',
        input: {
          account: 'Helio Cloud',
          adoptionSignal: 'manager_follow_through',
        },
        output: {
          renewalRisk: 'medium',
          coachingCompletion: 0.43,
          managerInspectionRate: 0.38,
        },
        success: true,
        latencyMs: 143,
      },
    ],
    draftEmails: [
      {
        audience: 'Procurement and sponsor team',
        purpose: 'Renewal recovery plan',
        tone: 'direct',
        bullets: [
          'Acknowledge the adoption gap without over-defending the rollout.',
          'Define the 45-day recovery metrics and weekly owner cadence.',
          'Ask for agreement on the review checkpoints before procurement restarts pricing.',
        ],
        body: 'Tom, thanks for being direct about the renewal risk. I summarized the issue as a manager-follow-through gap rather than a platform-fit gap. The attached recovery plan focuses on a Friday manager scorecard, coaching-completion tracking, and two executive check-ins over the next 45 days. If that structure works for you, we can align on owners before procurement reopens pricing.',
      },
    ],
    metrics: {
      tokensInput: 1395,
      tokensOutput: 1670,
      toolCount: 1,
      latencyMs: 963,
      costUsd: 0.39,
      model: 'gpt-4o-mini',
    },
    assessment: {
      mode: 'final',
      scoreItems: [
        {
          score: 18,
          details:
            'Good commercial framing, but the executive narrative could have been sharper in the opening.',
        },
        {
          score: 18,
          details:
            'Diagnosed the adoption issue, though ownership surfaced slightly late.',
        },
        {
          score: 14,
          details:
            'The risk answer improved, but more evidence could have reduced procurement skepticism.',
        },
        {
          score: 19,
          details: 'Closed on a written recovery plan and decision checkpoint.',
        },
      ],
      narrativeSummary:
        'The recovery plan became concrete by the end of the conversation, but the opening could have framed the executive risk faster and with more authority.',
      coachTips: [
        {
          text: 'Lead the renewal call with the business cost of inaction before discussing remediation.',
        },
        {
          text: 'Use one adoption statistic earlier so procurement sees evidence instead of reassurance.',
        },
      ],
      labels: [
        {
          turnOrder: 1,
          label: 'PositiveExample',
          confidence: 0.76,
          scoreDelta: 0.8,
          evidence:
            'Before I talk pricing, what is driving the hesitation internally',
        },
        {
          turnOrder: 3,
          label: 'InsightfulQuestion',
          confidence: 0.92,
          scoreDelta: 2.0,
          evidence:
            'manager follow-through, rep habit change, or unclear success metrics',
        },
        {
          turnOrder: 5,
          label: 'MissedOpportunity',
          confidence: 0.79,
          scoreDelta: -1.3,
          evidence: 'would that change the renewal conversation',
        },
        {
          turnOrder: 7,
          label: 'ObjectiveMet',
          confidence: 0.83,
          scoreDelta: 1.6,
          evidence: 'manager scorecard each Friday',
        },
      ],
      insights: {
        strengths: [
          'Moved quickly from pricing pressure to adoption diagnosis.',
          'Recovered the close with a concrete cadence.',
        ],
        areasForImprovement: [
          'Could frame the commercial cost earlier.',
          'Could use stronger proof when confronting skepticism.',
        ],
        recommendations: [
          'Bring one executive metric into the opening.',
          'Anchor the recovery plan in visible owners and dates.',
        ],
      },
    },
  },
  {
    key: 'helio_exec_video',
    id: 'demo_session_helio_exec_video',
    teamId: 'demo_team_helio',
    ownerId: 'demo_user_sofia',
    collaboratorIds: ['demo_user_noah'],
    type: 'video',
    status: 'ended',
    scenarioId: 'demo_scenario_helio_exec',
    personaId: 'demo_persona_helio_rina',
    rubricId: 'demo_rubric_executive',
    name: 'Executive rollout presentation',
    tags: ['video', 'executive', 'rollout'],
    language: 'en-US',
    crmContextId: 'demo_crm_ctx_helio_exec',
    createdAt: utc(2026, 3, 10, 18, 0),
    startedAt: utc(2026, 3, 10, 18, 4),
    endedAt: utc(2026, 3, 10, 18, 33),
    sessionConfig: {
      multiTurnEnabled: true,
      durationMinutes: 29,
      video: {
        provider: 'heygen',
        runtime: {
          status: 'failed',
          provider: 'heygen',
          lastError: 'Avatar rendering timed out after the live response.',
          activeJobId: 'demo_video_job_helio_exec',
        },
      },
      stages: [
        'Executive Framing',
        'Commercial Case',
        'Risk Plan',
        'Decision Path',
      ],
    },
    conversation: [
      {
        role: 'user',
        text: 'Rina, I will keep this boardroom version concise. The rollout question is not whether your teams need practice data, but how quickly you can trust it globally.',
      },
      {
        role: 'assistant',
        text: 'Trust is the issue. Global programs fail when governance gets bolted on at the end.',
      },
      {
        role: 'user',
        text: 'Agreed. That is why the rollout plan starts with identity, residency, and a regional pilot before we scale the coaching layer.',
      },
      {
        role: 'assistant',
        text: 'That sounds cleaner. Where does the commercial case show up for my peers?',
      },
      {
        role: 'user',
        text: 'In three places: lower ramp time, fewer rep-manager inspection gaps, and a cleaner signal for renewal risk before quarter close.',
      },
      {
        role: 'assistant',
        text: 'Those are the right levers. What would approval look like from us?',
      },
      {
        role: 'user',
        text: 'Approve the pilot region, name one security reviewer and one enablement owner, and hold a 30-day checkpoint where we inspect adoption and risk posture together.',
      },
      {
        role: 'assistant',
        text: 'That is concrete enough for me to sponsor as a phased recommendation.',
      },
    ],
    transcript: {
      assetId: 'demo_asset_helio_exec_video_recording',
      mimeType: 'video/mp4',
      storageKey: 'recordings/helio-executive-rollout.mp4',
      durationMs: 174000,
      summary:
        'Executive rollout conversation balanced governance and commercial value, ending with a phased recommendation and named owners.',
      topics: [
        { label: 'global governance', confidence: 0.93 },
        { label: 'commercial value', confidence: 0.87 },
        { label: 'regional pilot', confidence: 0.91 },
      ],
      sentiment: { overall: 0.46, trend: 'improving' },
    },
    metrics: {
      tokensInput: 1510,
      tokensOutput: 1765,
      toolCount: 0,
      latencyMs: 812,
      costUsd: 0.41,
      model: 'gpt-4o-mini',
    },
    assessment: {
      mode: 'final',
      scoreItems: [
        {
          score: 23,
          details:
            'Opened with a strategic framing that matched the executive audience.',
        },
        {
          score: 21,
          details:
            'Sequenced governance before scale, which strengthened the rollout narrative.',
        },
        {
          score: 19,
          details: 'Risk mitigation was practical and audience-specific.',
        },
        {
          score: 22,
          details: 'Closed on sponsor-ready next steps and named roles.',
        },
      ],
      narrativeSummary:
        'Excellent executive pacing. The narrative was concise, governance came before expansion, and the recommendation felt board-ready.',
      coachTips: [
        {
          text: 'Keep one backup example ready in case a board member asks for a regional proof point.',
        },
        {
          text: 'Use the same three-value structure in the written follow-up for consistency.',
        },
      ],
      labels: [
        {
          turnOrder: 1,
          label: 'PositiveExample',
          confidence: 0.92,
          scoreDelta: 1.6,
          evidence: 'how quickly you can trust it globally',
        },
        {
          turnOrder: 3,
          label: 'InsightfulQuestion',
          confidence: 0.88,
          scoreDelta: 2.2,
          evidence: 'starts with identity, residency, and a regional pilot',
        },
        {
          turnOrder: 5,
          label: 'ObjectiveMet',
          confidence: 0.9,
          scoreDelta: 1.8,
          evidence: 'lower ramp time, fewer rep-manager inspection gaps',
        },
        {
          turnOrder: 7,
          label: 'PositiveExample',
          confidence: 0.94,
          scoreDelta: 2.0,
          evidence: 'Approve the pilot region, name one security reviewer',
        },
      ],
      insights: {
        strengths: [
          'Board-ready opening.',
          'Governance-first rollout story.',
          'Clear sponsor ask.',
        ],
        areasForImprovement: [
          'Could add one quantified benchmark.',
          'Could anticipate regional objections sooner.',
        ],
        recommendations: [
          'Prepare one regional proof point slide.',
          'Mirror the same structure in the email recap.',
        ],
      },
    },
  },
  {
    key: 'academy_lti',
    id: 'demo_session_academy_lti',
    teamId: 'demo_team_academy',
    ownerId: 'demo_user_olivia',
    collaboratorIds: ['demo_user_ethan'],
    type: 'text',
    status: 'ended',
    scenarioId: 'demo_scenario_academy_lti',
    personaId: 'demo_persona_academy_dana',
    rubricId: 'demo_rubric_coaching',
    name: 'Canvas launch planning rehearsal',
    tags: ['lti', 'education', 'launch'],
    language: 'en-US',
    createdAt: utc(2026, 3, 11, 19, 0),
    startedAt: utc(2026, 3, 11, 19, 3),
    endedAt: utc(2026, 3, 11, 19, 26),
    sessionConfig: {
      multiTurnEnabled: true,
      durationMinutes: 23,
      stages: ['Launch Goals', 'Course Fit', 'Assessment Design', 'Rollout'],
      lti: { enabled: true, platform: 'canvas' },
    },
    conversation: [
      {
        role: 'user',
        text: 'Dana, before we discuss the LTI setup, what would make this rollout feel successful for faculty and learners in week one?',
      },
      {
        role: 'assistant',
        text: 'Faculty need something easy to launch, and learners need feedback that feels more specific than a generic rubric.',
      },
      {
        role: 'user',
        text: 'Would it help if the first assignment focused on one scenario, one scorecard, and a coaching plan that faculty can review inside Canvas?',
      },
      {
        role: 'assistant',
        text: 'Yes, especially if the setup stays lightweight for adjunct instructors.',
      },
      {
        role: 'user',
        text: 'Then we should launch with a single module, provide a quick faculty checklist, and map the scorecard to your existing learning outcomes before the cohort starts.',
      },
      {
        role: 'assistant',
        text: 'That would reduce the friction. How do we handle learner confusion on the first attempt?',
      },
      {
        role: 'user',
        text: 'We can embed an orientation prompt in Canvas, show one exemplar response, and surface the coaching plan after each attempt so the feedback feels actionable.',
      },
      {
        role: 'assistant',
        text: 'That is clear enough for me to bring to the faculty leads.',
      },
    ],
    metrics: {
      tokensInput: 1250,
      tokensOutput: 1445,
      toolCount: 0,
      latencyMs: 664,
      costUsd: 0.29,
      model: 'gpt-4o-mini',
    },
    assessment: {
      mode: 'final',
      scoreItems: [
        {
          score: 22,
          details: 'Questions stayed centered on faculty and learner outcomes.',
        },
        {
          score: 24,
          details:
            'Every recommendation stayed tightly relevant to the Canvas rollout.',
        },
        { score: 20, details: 'Examples were concrete and easy to visualize.' },
        {
          score: 21,
          details: 'Closed with a practical orientation and coaching plan.',
        },
      ],
      narrativeSummary:
        'Very strong education use-case framing. The rollout became concrete quickly, and the advice stayed simple enough for faculty adoption.',
      coachTips: [
        {
          text: 'Bring one screenshot or mockup for the faculty orientation flow to make the rollout even easier to approve.',
        },
        {
          text: 'Name the first-week faculty checkpoint to keep launch ownership explicit.',
        },
      ],
      labels: [
        {
          turnOrder: 1,
          label: 'PositiveExample',
          confidence: 0.89,
          scoreDelta: 1.1,
          evidence: 'what would make this rollout feel successful',
        },
        {
          turnOrder: 3,
          label: 'InsightfulQuestion',
          confidence: 0.95,
          scoreDelta: 2.3,
          evidence: 'one scenario, one scorecard, and a coaching plan',
        },
        {
          turnOrder: 5,
          label: 'ObjectiveMet',
          confidence: 0.91,
          scoreDelta: 1.7,
          evidence: 'single module, provide a quick faculty checklist',
        },
        {
          turnOrder: 7,
          label: 'PositiveExample',
          confidence: 0.9,
          scoreDelta: 1.5,
          evidence: 'embed an orientation prompt in Canvas',
        },
      ],
      insights: {
        strengths: [
          'Framed success from the user perspective.',
          'Kept the LTI rollout simple.',
          'Made the feedback loop tangible.',
        ],
        areasForImprovement: [
          'Could add one faculty timeline checkpoint.',
          'Could tie the exemplar response to a specific rubric criterion.',
        ],
        recommendations: [
          'Prepare a faculty launch checklist.',
          'Name the week-one owner and support channel.',
        ],
      },
    },
  },
  {
    key: 'challenge_pricing',
    id: 'demo_session_challenge_pricing',
    teamId: 'demo_team_nova',
    ownerId: 'demo_user_mia',
    collaboratorIds: [],
    type: 'text',
    status: 'ended',
    scenarioId: null,
    personaId: 'demo_persona_helio_tom',
    rubricId: 'demo_rubric_coaching',
    challengeId: 'demo_challenge_daily_beginner',
    name: 'Daily challenge: defend price without discounting',
    tags: ['challenge', 'pricing', 'daily'],
    language: 'en-US',
    createdAt: utc(2026, 3, 13, 16, 0),
    startedAt: utc(2026, 3, 13, 16, 2),
    endedAt: utc(2026, 3, 13, 16, 18),
    sessionConfig: {
      multiTurnEnabled: true,
      durationMinutes: 16,
      challengeId: 'demo_challenge_daily_beginner',
      scenario: {
        objective: 'Handle a pricing objection without leading with discount.',
      },
      stages: ['Acknowledge', 'Reframe Value', 'Differentiate', 'Next Step'],
    },
    conversation: [
      {
        role: 'user',
        text: 'I hear the pricing concern. Before we talk terms, can I make sure I understand what feels out of line to you?',
      },
      {
        role: 'assistant',
        text: 'Your competitor came in lower, and my CFO is asking why we should pay more for similar outcomes.',
      },
      {
        role: 'user',
        text: 'Is the concern purely sticker price, or is it whether the extra spend changes speed, adoption, or risk for your team?',
      },
      {
        role: 'assistant',
        text: 'Risk and adoption. Paying more only works if rollout pain actually drops.',
      },
      {
        role: 'user',
        text: 'That is the gap we solve. The difference is not a cheaper seat, it is the reduction in manager follow-up work and the faster path to inspected practice data.',
      },
      {
        role: 'assistant',
        text: 'That sounds reasonable, but I still need a way to defend it internally.',
      },
      {
        role: 'user',
        text: 'Then let us build that case together. I can give you a short business-case summary with rollout savings, manager time recovered, and one phased option that protects budget without hollowing out the outcome.',
      },
      {
        role: 'assistant',
        text: 'If you send that, I can take a more serious look before pushing for a discount.',
      },
    ],
    metrics: {
      tokensInput: 980,
      tokensOutput: 1110,
      toolCount: 0,
      latencyMs: 522,
      costUsd: 0.21,
      model: 'gpt-4o-mini',
    },
    assessment: {
      mode: 'final',
      scoreItems: [
        {
          score: 21,
          details: 'Acknowledged the objection without getting defensive.',
        },
        {
          score: 18,
          details: 'Reframed price into operational value with decent clarity.',
        },
        {
          score: 23,
          details:
            'Stayed specific about risk and adoption rather than generic ROI.',
        },
        {
          score: 22,
          details:
            'Closed on a business-case follow-up instead of conceding discount.',
        },
      ],
      narrativeSummary:
        'Strong challenge response. The rep avoided reflexive discounting and redirected the conversation toward business justification.',
      coachTips: [
        {
          text: 'Bring one hard number into the value reframe so the CFO case lands even faster.',
        },
      ],
      labels: [
        {
          turnOrder: 1,
          label: 'PositiveExample',
          confidence: 0.86,
          scoreDelta: 1.0,
          evidence: 'can I make sure I understand',
        },
        {
          turnOrder: 3,
          label: 'InsightfulQuestion',
          confidence: 0.94,
          scoreDelta: 2.4,
          evidence: 'speed, adoption, or risk for your team',
        },
        {
          turnOrder: 5,
          label: 'ObjectiveMet',
          confidence: 0.91,
          scoreDelta: 1.6,
          evidence: 'reduction in manager follow-up work',
        },
        {
          turnOrder: 7,
          label: 'PositiveExample',
          confidence: 0.92,
          scoreDelta: 1.8,
          evidence: 'phased option that protects budget',
        },
      ],
      insights: {
        strengths: [
          'Did not collapse into discounting.',
          'Kept the customer focused on risk and adoption.',
        ],
        areasForImprovement: [
          'Needs one quantified proof point.',
          'Could test the competitor framing more directly.',
        ],
        recommendations: [
          'Add one concrete savings metric.',
          'Use the same structure in future pricing objections.',
        ],
      },
    },
  },
  {
    key: 'nova_phone_followup',
    id: 'demo_session_nova_phone_followup',
    teamId: 'demo_team_nova',
    ownerId: 'demo_user_grace',
    collaboratorIds: [],
    type: 'phone',
    status: 'ended',
    scenarioId: 'demo_scenario_nova_security',
    personaId: 'demo_persona_nova_marcus',
    rubricId: 'demo_rubric_consultative',
    name: 'Procurement follow-up phone roleplay',
    tags: ['phone', 'follow-up', 'procurement'],
    language: 'en-US',
    createdAt: utc(2026, 3, 12, 17, 0),
    startedAt: utc(2026, 3, 12, 17, 2),
    endedAt: utc(2026, 3, 12, 17, 20),
    sessionConfig: {
      multiTurnEnabled: true,
      durationMinutes: 18,
      phone: { provider: 'vapi' },
      stages: ['Recap', 'Objection', 'Proof', 'Commitment'],
    },
    conversation: [
      {
        role: 'user',
        text: 'Marcus, I wanted to follow up by phone because the control map is ready and I do not want the review to stall.',
      },
      {
        role: 'assistant',
        text: 'Good timing. Security is still asking whether the rollout will create extra admin load.',
      },
      {
        role: 'user',
        text: 'That is the part we simplified. The rollout keeps provisioning in SSO, limits access by workspace, and gives your admins one escalation path instead of several manual handoffs.',
      },
      {
        role: 'assistant',
        text: 'That helps. If my admin lead sees the escalation path clearly, the review probably moves.',
      },
      {
        role: 'user',
        text: 'Perfect. I will send the document today, and if it looks right, can we bring your admin lead and RevOps owner together on Tuesday?',
      },
      {
        role: 'assistant',
        text: 'Yes, Tuesday works if the document is in their inbox before end of day.',
      },
    ],
    transcript: {
      assetId: 'demo_asset_nova_phone_followup_recording',
      mimeType: 'audio/mpeg',
      storageKey: 'recordings/nova-phone-followup.mp3',
      durationMs: 108000,
      summary:
        'Phone follow-up reinforced the control map and secured a Tuesday stakeholder review.',
      topics: [
        { label: 'admin load', confidence: 0.89 },
        { label: 'escalation path', confidence: 0.91 },
        { label: 'review meeting', confidence: 0.86 },
      ],
      sentiment: { overall: 0.37, trend: 'improving' },
    },
    metrics: {
      tokensInput: 810,
      tokensOutput: 900,
      toolCount: 0,
      latencyMs: 498,
      costUsd: 0.17,
      model: 'gpt-4o-mini',
    },
    assessment: {
      mode: 'final',
      scoreItems: [
        { score: 19, details: 'Recapped the reason for the call well.' },
        {
          score: 22,
          details:
            'Translated admin-load concern into a simpler operating model.',
        },
        {
          score: 18,
          details:
            'Proof point was solid but could include one named owner sooner.',
        },
        { score: 20, details: 'Secured a specific Tuesday next step.' },
      ],
      narrativeSummary:
        'Strong short-form follow-up. The rep kept the call practical and landed a time-bound commitment.',
      coachTips: [
        {
          text: 'Name the admin lead role in the question so the next step sounds even more concrete.',
        },
      ],
      labels: [
        {
          turnOrder: 1,
          label: 'PositiveExample',
          confidence: 0.8,
          scoreDelta: 0.9,
          evidence: 'I do not want the review to stall',
        },
        {
          turnOrder: 3,
          label: 'ObjectiveMet',
          confidence: 0.88,
          scoreDelta: 1.5,
          evidence: 'one escalation path instead of several manual handoffs',
        },
        {
          turnOrder: 5,
          label: 'PositiveExample',
          confidence: 0.87,
          scoreDelta: 1.4,
          evidence:
            'can we bring your admin lead and RevOps owner together on Tuesday',
        },
      ],
      insights: {
        strengths: [
          'Kept the phone follow-up focused.',
          'Made the admin-load answer simple and concrete.',
        ],
        areasForImprovement: [
          'Could confirm the admin lead role by name.',
          'Could mention the control-map section most relevant to admins.',
        ],
        recommendations: [
          'Use named owners in short follow-up calls.',
          'Keep the next-step ask time-bound.',
        ],
      },
    },
  },
];

const simpleSessionSeeds = [
  {
    key: 'nova_manager_sync',
    id: 'demo_session_nova_manager_sync',
    teamId: 'demo_team_nova',
    ownerId: 'demo_user_grace',
    collaboratorIds: ['demo_user_ava'],
    type: 'text',
    status: 'ended',
    scenarioId: 'demo_scenario_nova_discovery',
    personaId: 'demo_persona_nova_marcus',
    name: 'Manager calibration sprint',
    tags: ['coaching', 'manager'],
    createdAt: utc(2026, 3, 9, 15, 0),
    startedAt: utc(2026, 3, 9, 15, 2),
    endedAt: utc(2026, 3, 9, 15, 14),
    sessionConfig: {
      multiTurnEnabled: true,
      durationMinutes: 12,
      stages: ['Opening', 'Diagnosis', 'Close'],
    },
    conversation: [
      {
        role: 'user',
        text: 'What is the fastest way to get managers inspecting consistently again?',
      },
      {
        role: 'assistant',
        text: 'Give them one scorecard, one cadence, and one reason the board cares.',
      },
      {
        role: 'user',
        text: 'So the manager workflow has to feel lighter than the spreadsheet cleanup they already do?',
      },
      {
        role: 'assistant',
        text: 'Exactly. Reduce their effort and increase their confidence at the same time.',
      },
    ],
  },
  {
    key: 'helio_discovery_active',
    id: 'demo_session_helio_discovery_active',
    teamId: 'demo_team_helio',
    ownerId: 'demo_user_ethan',
    collaboratorIds: ['demo_user_sofia'],
    type: 'text',
    status: 'active',
    scenarioId: 'demo_scenario_helio_renewal',
    personaId: 'demo_persona_helio_tom',
    name: 'Discovery warm-up',
    tags: ['active', 'warmup'],
    createdAt: utc(2026, 3, 14, 13, 0),
    startedAt: utc(2026, 3, 14, 13, 4),
    endedAt: null,
    sessionConfig: {
      multiTurnEnabled: true,
      durationMinutes: 15,
      stages: ['Opening', 'Risk', 'Close'],
    },
    conversation: [
      {
        role: 'user',
        text: 'Before we talk remediation, what is making this renewal feel risky?',
      },
      {
        role: 'assistant',
        text: 'Leadership is unconvinced the rollout changed behavior.',
      },
      {
        role: 'user',
        text: 'So I need to prove behavior change, not just platform usage?',
      },
      {
        role: 'assistant',
        text: 'Yes. Usage without changed manager behavior does not help me.',
      },
    ],
  },
  {
    key: 'academy_objection_lab',
    id: 'demo_session_academy_objection_lab',
    teamId: 'demo_team_academy',
    ownerId: 'demo_user_ethan',
    collaboratorIds: ['demo_user_olivia'],
    type: 'text',
    status: 'ended',
    scenarioId: 'demo_scenario_academy_lti',
    personaId: 'demo_persona_academy_jordan',
    name: 'Learner objection lab',
    tags: ['learning', 'practice'],
    createdAt: utc(2026, 3, 7, 18, 0),
    startedAt: utc(2026, 3, 7, 18, 3),
    endedAt: utc(2026, 3, 7, 18, 15),
    sessionConfig: {
      multiTurnEnabled: true,
      durationMinutes: 12,
      stages: ['Goal', 'Objection', 'Coach'],
    },
    conversation: [
      {
        role: 'user',
        text: 'What if a learner says the scorecard feedback is too generic?',
      },
      {
        role: 'assistant',
        text: 'Show them one criterion, one example, and one actionable rewrite.',
      },
      {
        role: 'user',
        text: 'So the fix is to tie the score to one clear behavior they can change next attempt?',
      },
      {
        role: 'assistant',
        text: 'Exactly. Specific feedback keeps the learner engaged.',
      },
    ],
  },
  {
    key: 'nova_pipeline_review',
    id: 'demo_session_nova_pipeline_review',
    teamId: 'demo_team_nova',
    ownerId: 'demo_user_ava',
    collaboratorIds: ['demo_user_mia'],
    type: 'text',
    status: 'ended',
    scenarioId: 'demo_scenario_nova_discovery',
    personaId: 'demo_persona_nova_elena',
    name: 'Pipeline review rehearsal',
    tags: ['pipeline', 'manager'],
    createdAt: utc(2026, 3, 6, 15, 0),
    startedAt: utc(2026, 3, 6, 15, 3),
    endedAt: utc(2026, 3, 6, 15, 14),
    sessionConfig: {
      multiTurnEnabled: true,
      durationMinutes: 11,
      stages: ['Context', 'Risk', 'Close'],
    },
    conversation: [
      {
        role: 'user',
        text: 'If the board only gets one headline, what should it be?',
      },
      {
        role: 'assistant',
        text: 'Whether the forecast is trustworthy enough to act on this quarter.',
      },
      {
        role: 'user',
        text: 'Then the manager inspection story has to reinforce trust, not just activity volume.',
      },
      {
        role: 'assistant',
        text: 'Yes, trust and accountability. Activity without confidence does not help leadership.',
      },
    ],
  },
];

const challengeDefinitions = [
  {
    id: 'demo_challenge_daily_beginner',
    period: 'DAILY',
    difficulty: 'BEGINNER',
    status: 'ACTIVE',
    title: 'Defend Price Without Discounting',
    description: 'Handle a basic pricing objection while protecting value.',
    topic: 'pricing objection',
    scenarioPrompt:
      'A buyer says your competitor is cheaper. Reframe around business value without leading with discount.',
    evaluatorPersonaPrompt:
      'Score for calm objection handling, business framing, and next-step clarity.',
    startsAt: utc(2026, 3, 14, 0, 0),
    expiresAt: utc(2026, 3, 15, 0, 0),
  },
  {
    id: 'demo_challenge_daily_intermediate',
    period: 'DAILY',
    difficulty: 'INTERMEDIATE',
    status: 'ACTIVE',
    title: 'Cold Call to Qualified Discovery',
    description:
      'Move a skeptical buyer from interruption to curiosity in under five turns.',
    topic: 'cold outbound',
    scenarioPrompt:
      'Open a cold conversation, earn permission, and land a discovery next step.',
    evaluatorPersonaPrompt:
      'Score for clarity, relevance, and transition quality.',
    startsAt: utc(2026, 3, 14, 0, 0),
    expiresAt: utc(2026, 3, 15, 0, 0),
  },
  {
    id: 'demo_challenge_weekly_expert',
    period: 'WEEKLY',
    difficulty: 'EXPERT',
    status: 'ACTIVE',
    title: 'Security Committee Review',
    description: 'Navigate governance concerns without losing momentum.',
    topic: 'security committee',
    scenarioPrompt:
      'A security committee wants specifics on residency, redaction, and rollout ownership.',
    evaluatorPersonaPrompt:
      'Score for credibility, structure, and decision quality.',
    startsAt: utc(2026, 3, 10, 0, 0),
    expiresAt: utc(2026, 3, 17, 0, 0),
  },
  {
    id: 'demo_challenge_monthly_master',
    period: 'MONTHLY',
    difficulty: 'MASTER',
    status: 'ACTIVE',
    title: 'Executive Renewal Rescue',
    description: 'Recover an at-risk renewal under executive scrutiny.',
    topic: 'renewal rescue',
    scenarioPrompt:
      'An executive buyer questions renewal value and needs a recovery plan backed by evidence.',
    evaluatorPersonaPrompt:
      'Score for executive narrative, risk mitigation, and commercial close.',
    startsAt: utc(2026, 3, 1, 0, 0),
    expiresAt: utc(2026, 4, 1, 0, 0),
  },
  {
    id: 'demo_challenge_expired_story',
    period: 'WEEKLY',
    difficulty: 'BEGINNER',
    status: 'EXPIRED',
    title: 'Tell the ROI Story',
    description: 'Past challenge kept for leaderboard history.',
    topic: 'roi narrative',
    scenarioPrompt: 'Explain the ROI case to a skeptical sponsor.',
    evaluatorPersonaPrompt: 'Score for business framing and clarity.',
    startsAt: utc(2026, 3, 1, 0, 0),
    expiresAt: utc(2026, 3, 8, 0, 0),
  },
  {
    id: 'demo_challenge_upcoming_committee',
    period: 'WEEKLY',
    difficulty: 'MASTER',
    status: 'UPCOMING',
    title: 'Global Steering Committee',
    description: 'Upcoming advanced challenge for rollout decisions.',
    topic: 'steering committee',
    scenarioPrompt:
      'Win approval for a global rollout in front of cross-functional leaders.',
    evaluatorPersonaPrompt:
      'Score for narrative, risk control, and decision path.',
    startsAt: utc(2026, 3, 17, 0, 0),
    expiresAt: utc(2026, 3, 24, 0, 0),
  },
];

const supportFaqDefinitions = [
  {
    id: 'demo_support_faq_sessions',
    question:
      'How do I restart a session without losing the previous transcript?',
    answer:
      'End the current session, use Start Over from the live session page, and PITCH will create a fresh session while keeping the old transcript and assessment in history.',
    category: 'Demo',
  },
  {
    id: 'demo_support_faq_challenges',
    question: 'Where can I find active challenges?',
    answer:
      'Open Studio, then go to Challenges. Active daily, weekly, and monthly challenges appear there with participation counts and leaderboard access.',
    category: 'Demo',
  },
  {
    id: 'demo_support_faq_team',
    question: 'Can I invite teammates before they create an account?',
    answer:
      'Yes. Team owners can send signup invites from Team Config and the invite will remain pending until the teammate registers.',
    category: 'Demo',
  },
  {
    id: 'demo_support_faq_reports',
    question: 'How do coaching reports get generated?',
    answer:
      'Completed sessions can produce JSON and PDF report artifacts after the assessment run finishes. The performance page links to the latest report data.',
    category: 'Demo',
  },
  {
    id: 'demo_support_faq_lti',
    question: 'Does PITCH support LTI launches from Canvas?',
    answer:
      'Yes. The LTI service supports platform registrations, deployments, launches, line items, and score passback workflows for LMS demos.',
    category: 'Demo',
  },
];

function buildNotificationRecords() {
  const notifications = [
    {
      recipientUserId: 'demo_user_ava',
      title: 'Challenge report ready',
      message: 'Your daily pricing challenge report is ready to review.',
      type: 'ASSESSMENT_READY',
      severity: 'INFO',
      sourceType: 'SYSTEM',
      metadata: {
        seedTag: DEMO_SEED_TAG,
        sessionId: 'demo_session_challenge_pricing',
        runId: 'demo_assessment_challenge_pricing',
      },
      readAt: null,
      createdAt: utc(2026, 3, 14, 9, 15),
      updatedAt: utc(2026, 3, 14, 9, 15),
    },
    {
      recipientUserId: 'demo_user_mia',
      title: 'Team invite pending',
      message:
        'You have been invited to observe the Northwind Academy rollout workspace.',
      type: 'TEAM_INVITE',
      severity: 'INFO',
      sourceType: 'USER',
      sourceUserId: 'demo_user_olivia',
      metadata: {
        seedTag: DEMO_SEED_TAG,
        teamId: 'demo_team_academy',
      },
      readAt: null,
      createdAt: utc(2026, 3, 13, 13, 30),
      updatedAt: utc(2026, 3, 13, 13, 30),
    },
    {
      recipientUserId: 'demo_user_noah',
      title: 'CRM sync attention needed',
      message:
        'One Salesforce integration is marked expired and needs review before the board report.',
      type: 'CRM_SYNC',
      severity: 'WARNING',
      sourceType: 'SYSTEM',
      metadata: {
        seedTag: DEMO_SEED_TAG,
        provider: 'salesforce',
        deepLink: '/studio/team-config',
      },
      readAt: null,
      createdAt: utc(2026, 3, 14, 8, 0),
      updatedAt: utc(2026, 3, 14, 8, 0),
    },
    {
      recipientUserId: 'demo_user_sofia',
      title: 'Executive assessment complete',
      message:
        'Your executive rollout assessment finished with a strong score.',
      type: 'ASSESSMENT_READY',
      severity: 'INFO',
      sourceType: 'SYSTEM',
      metadata: {
        seedTag: DEMO_SEED_TAG,
        sessionId: 'demo_session_helio_exec_video',
        runId: 'demo_assessment_helio_exec_video',
      },
      readAt: utc(2026, 3, 10, 19, 0),
      createdAt: utc(2026, 3, 10, 18, 40),
      updatedAt: utc(2026, 3, 10, 19, 0),
    },
    {
      recipientUserId: 'demo_user_lucas',
      title: 'Security workshop scheduled',
      message:
        'The stakeholder workshop for the security validation flow is confirmed for Tuesday.',
      type: 'WORKSHOP',
      severity: 'INFO',
      sourceType: 'SYSTEM',
      metadata: {
        seedTag: DEMO_SEED_TAG,
        teamId: 'demo_team_nova',
      },
      readAt: null,
      createdAt: utc(2026, 3, 12, 17, 45),
      updatedAt: utc(2026, 3, 12, 17, 45),
    },
  ];

  return notifications.map((notification, index) => ({
    _id: new mongoose.Types.ObjectId(
      (5000 + index).toString(16).padStart(24, '0'),
    ),
    ...notification,
  }));
}

function buildSupportData() {
  const chats = [
    {
      id: 'demo_support_chat_ava',
      userId: 'demo_user_ava',
      title: 'How to prep a board-ready session',
      isActive: true,
      startedAt: utc(2026, 3, 13, 11, 0),
      lastActiveAt: utc(2026, 3, 13, 11, 7),
      messages: [
        {
          role: 'USER',
          content:
            'How should I prep a boardroom narrative session for tomorrow?',
          timestamp: utc(2026, 3, 13, 11, 0),
        },
        {
          role: 'ASSISTANT',
          content:
            '1. Pick the exact executive objective. 2. Gather one metric and one rollout risk. 3. Rehearse the close with a named next step.',
          timestamp: utc(2026, 3, 13, 11, 1),
        },
        {
          role: 'USER',
          content: 'Should I bring security into the first rehearsal?',
          timestamp: utc(2026, 3, 13, 11, 2),
        },
        {
          role: 'ASSISTANT',
          content:
            'Bring security if the executive story depends on rollout trust. If not, keep the first pass focused on the decision narrative.',
          timestamp: utc(2026, 3, 13, 11, 3),
        },
      ],
    },
    {
      id: 'demo_support_chat_olivia',
      userId: 'demo_user_olivia',
      title: 'Canvas rollout checklist',
      isActive: true,
      startedAt: utc(2026, 3, 12, 15, 0),
      lastActiveAt: utc(2026, 3, 12, 15, 4),
      messages: [
        {
          role: 'USER',
          content:
            'What should I include in a first-week faculty checklist for an LTI launch?',
          timestamp: utc(2026, 3, 12, 15, 0),
        },
        {
          role: 'ASSISTANT',
          content:
            'Include the course link, one sample scenario, grading guidance, and where to find the learner coaching plan.',
          timestamp: utc(2026, 3, 12, 15, 1),
        },
        {
          role: 'USER',
          content: 'Can I keep it to one page?',
          timestamp: utc(2026, 3, 12, 15, 2),
        },
        {
          role: 'ASSISTANT',
          content:
            'Yes. Keep the checklist short and link out to deeper setup notes only when needed.',
          timestamp: utc(2026, 3, 12, 15, 3),
        },
      ],
    },
  ];

  const chatMessages = chats.flatMap((chat) =>
    chat.messages.map((message) => ({
      chatId: chat.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      toolCalls: null,
    })),
  );

  return {
    users: demoUsers.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
    })),
    faqs: supportFaqDefinitions.map((faq, index) => ({
      ...faq,
      createdAt: utc(2026, 3, 1 + index, 9, 0),
      updatedAt: utc(2026, 3, 1 + index, 9, 0),
      isPublished: true,
    })),
    chats: chats.map(({ messages, ...chat }) => chat),
    chatMessages,
    emailLogs: [
      {
        id: 'demo_email_log_1',
        toEmail: 'elena.vasquez@northwind.example',
        subject: '[DEMO] Pilot recap and board-risk summary',
        body: 'Attached is the pilot recap for the forecast-confidence workflow.',
        sentAt: utc(2026, 3, 2, 16, 0),
        status: 'SENT',
        teamMember: 'Ava Thompson',
        meetingLink: 'https://meet.pitch.local/nova-pilot',
        createdAt: utc(2026, 3, 2, 16, 0),
      },
      {
        id: 'demo_email_log_2',
        toEmail: 'security@northwind.example',
        subject: '[DEMO] Security control map for revenue AI review',
        body: 'Sharing the residency, SSO, redaction, and escalation-path summary before Tuesday.',
        sentAt: utc(2026, 3, 5, 18, 0),
        status: 'SENT',
        teamMember: 'Lucas Meyer',
        meetingLink: 'https://meet.pitch.local/security-workshop',
        createdAt: utc(2026, 3, 5, 18, 0),
      },
      {
        id: 'demo_email_log_3',
        toEmail: 'faculty-leads@academy.example',
        subject: '[DEMO] Canvas launch checklist draft',
        body: 'Sharing the one-page launch checklist and orientation outline.',
        sentAt: utc(2026, 3, 11, 20, 0),
        status: 'QUEUED',
        teamMember: 'Olivia Carter',
        meetingLink: 'https://meet.pitch.local/faculty-launch',
        createdAt: utc(2026, 3, 11, 20, 0),
      },
    ],
    tickets: [
      {
        id: 'demo_support_ticket_1',
        userId: 'demo_user_ava',
        subject: 'PDF report styling for board handoff',
        message:
          'Need the exported PDF to preserve the executive-summary section more cleanly.',
        status: 'IN_PROGRESS',
        priority: 'NORMAL',
        assignedTo: 'Coach Ops',
        createdAt: utc(2026, 3, 4, 12, 0),
        updatedAt: utc(2026, 3, 4, 14, 20),
      },
      {
        id: 'demo_support_ticket_2',
        userId: 'demo_user_olivia',
        subject: 'LTI score passback validation',
        message:
          'Canvas line item and score passback look good in staging, but I want to validate the launch context one more time.',
        status: 'OPEN',
        priority: 'HIGH',
        assignedTo: 'LTI Support',
        createdAt: utc(2026, 3, 12, 10, 0),
        updatedAt: utc(2026, 3, 12, 10, 0),
      },
      {
        id: 'demo_support_ticket_3',
        userId: 'demo_user_noah',
        subject: 'Expired Salesforce token in demo tenant',
        message:
          'One integration moved to expired after the refresh window. Need visibility before tomorrow’s walkthrough.',
        status: 'OPEN',
        priority: 'HIGH',
        assignedTo: 'CRM Support',
        createdAt: utc(2026, 3, 14, 8, 10),
        updatedAt: utc(2026, 3, 14, 8, 10),
      },
    ],
  };
}

function buildCrmData() {
  return [
    {
      id: 'demo_integration_salesforce_ava',
      userId: 'demo_user_ava',
      provider: 'SALESFORCE',
      status: 'CONNECTED',
      accessToken: 'demo_sf_access_ava',
      refreshToken: 'demo_sf_refresh_ava',
      expiresAt: utc(2026, 3, 20, 12, 0),
      instanceUrl: 'https://nova-revenue-demo.my.salesforce.com',
      providerId: '005-demo-ava',
      providerEmail: 'ava.thompson@novarevenue.example',
      providerData: {
        user_id: '005-demo-ava',
        email: 'ava.thompson@novarevenue.example',
        name: 'Ava Thompson',
      },
      metadata: {
        seedTag: DEMO_SEED_TAG,
        autoSync: true,
        lastSyncAt: utc(2026, 3, 14, 16, 30).toISOString(),
      },
      createdAt: utc(2026, 2, 20, 14, 0),
      updatedAt: utc(2026, 3, 14, 16, 30),
    },
    {
      id: 'demo_integration_hubspot_noah',
      userId: 'demo_user_noah',
      provider: 'HUBSPOT',
      status: 'CONNECTED',
      accessToken: 'demo_hs_access_noah',
      refreshToken: 'demo_hs_refresh_noah',
      expiresAt: utc(2026, 3, 21, 11, 0),
      instanceUrl: 'https://app.hubspot.com',
      providerId: 'hub-demo-noah',
      providerEmail: 'noah.patel@heliocloud.example',
      providerData: {
        ownerId: 'hub-demo-noah',
        email: 'noah.patel@heliocloud.example',
        portalId: '778812',
      },
      metadata: {
        seedTag: DEMO_SEED_TAG,
        autoSync: true,
        lastSyncAt: utc(2026, 3, 14, 15, 5).toISOString(),
      },
      createdAt: utc(2026, 2, 22, 13, 30),
      updatedAt: utc(2026, 3, 14, 15, 5),
    },
    {
      id: 'demo_integration_salesforce_grace',
      userId: 'demo_user_grace',
      provider: 'SALESFORCE',
      status: 'EXPIRED',
      accessToken: null,
      refreshToken: 'demo_sf_refresh_grace',
      expiresAt: utc(2026, 3, 10, 18, 0),
      instanceUrl: 'https://nova-revenue-demo.my.salesforce.com',
      providerId: '005-demo-grace',
      providerEmail: 'grace.kim@novarevenue.example',
      providerData: {
        user_id: '005-demo-grace',
        email: 'grace.kim@novarevenue.example',
        name: 'Grace Kim',
      },
      metadata: {
        seedTag: DEMO_SEED_TAG,
        autoSync: false,
        lastSyncAt: utc(2026, 3, 10, 18, 0).toISOString(),
      },
      createdAt: utc(2026, 2, 25, 9, 0),
      updatedAt: utc(2026, 3, 10, 18, 0),
    },
    {
      id: 'demo_integration_hubspot_olivia',
      userId: 'demo_user_olivia',
      provider: 'HUBSPOT',
      status: 'DISCONNECTED',
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      instanceUrl: 'https://app.hubspot.com',
      providerId: 'hub-demo-olivia',
      providerEmail: 'olivia.carter@academy.example',
      providerData: {
        ownerId: 'hub-demo-olivia',
        email: 'olivia.carter@academy.example',
        portalId: '881144',
      },
      metadata: {
        seedTag: DEMO_SEED_TAG,
        autoSync: false,
        lastSyncAt: utc(2026, 3, 5, 10, 0).toISOString(),
      },
      createdAt: utc(2026, 2, 26, 10, 20),
      updatedAt: utc(2026, 3, 5, 10, 0),
    },
  ];
}

function buildAnalyticsData() {
  const dashboards = [
    {
      id: 'demo_dashboard_nova_team',
      orgId: 'demo_team_nova',
      userId: 'demo_user_ava',
      name: 'Nova Team Command Center',
      type: 'team',
      config: {
        seedTag: DEMO_SEED_TAG,
        focus: ['forecast', 'coaching', 'pipeline'],
      },
      layout: { columns: 12, rowHeight: 96 },
      createdAt: utc(2026, 3, 1, 9, 0),
      updatedAt: utc(2026, 3, 14, 9, 0),
    },
    {
      id: 'demo_dashboard_helio_team',
      orgId: 'demo_team_helio',
      userId: 'demo_user_noah',
      name: 'Helio Executive Dashboard',
      type: 'team',
      config: {
        seedTag: DEMO_SEED_TAG,
        focus: ['renewal', 'board', 'latency'],
      },
      layout: { columns: 12, rowHeight: 96 },
      createdAt: utc(2026, 3, 1, 9, 5),
      updatedAt: utc(2026, 3, 14, 9, 5),
    },
    {
      id: 'demo_dashboard_academy_team',
      orgId: 'demo_team_academy',
      userId: 'demo_user_olivia',
      name: 'Academy Launch Dashboard',
      type: 'team',
      config: {
        seedTag: DEMO_SEED_TAG,
        focus: ['lti', 'faculty', 'assessment'],
      },
      layout: { columns: 12, rowHeight: 96 },
      createdAt: utc(2026, 3, 1, 9, 10),
      updatedAt: utc(2026, 3, 14, 9, 10),
    },
    {
      id: 'demo_dashboard_ava_personal',
      orgId: 'demo_team_nova',
      userId: 'demo_user_ava',
      name: 'Ava Personal Scorecard',
      type: 'user',
      config: { seedTag: DEMO_SEED_TAG, focus: ['boardroom', 'challenge'] },
      layout: { columns: 12, rowHeight: 96 },
      createdAt: utc(2026, 3, 1, 9, 15),
      updatedAt: utc(2026, 3, 14, 9, 15),
    },
  ];

  const widgets = [
    {
      id: 'demo_widget_nova_volume',
      dashboardId: 'demo_dashboard_nova_team',
      type: 'metric',
      title: 'Session Volume',
      config: { metric: 'sessions_completed', period: '14d' },
      position: { x: 0, y: 0, w: 4, h: 2 },
      createdAt: utc(2026, 3, 1, 9, 0),
      updatedAt: utc(2026, 3, 14, 9, 0),
    },
    {
      id: 'demo_widget_nova_quality',
      dashboardId: 'demo_dashboard_nova_team',
      type: 'chart',
      title: 'Assessment Trend',
      config: { metric: 'avg_assessment_score', chart: 'line' },
      position: { x: 4, y: 0, w: 8, h: 4 },
      createdAt: utc(2026, 3, 1, 9, 1),
      updatedAt: utc(2026, 3, 14, 9, 1),
    },
    {
      id: 'demo_widget_helio_exec',
      dashboardId: 'demo_dashboard_helio_team',
      type: 'table',
      title: 'Executive Readiness',
      config: { metric: 'exec_readiness', period: '30d' },
      position: { x: 0, y: 0, w: 12, h: 4 },
      createdAt: utc(2026, 3, 1, 9, 5),
      updatedAt: utc(2026, 3, 14, 9, 5),
    },
    {
      id: 'demo_widget_academy_lti',
      dashboardId: 'demo_dashboard_academy_team',
      type: 'metric',
      title: 'LTI Launches',
      config: { metric: 'lti_launches', period: '30d' },
      position: { x: 0, y: 0, w: 4, h: 2 },
      createdAt: utc(2026, 3, 1, 9, 10),
      updatedAt: utc(2026, 3, 14, 9, 10),
    },
    {
      id: 'demo_widget_ava_challenges',
      dashboardId: 'demo_dashboard_ava_personal',
      type: 'gauge',
      title: 'Challenge Momentum',
      config: { metric: 'challenge_score', target: 90 },
      position: { x: 0, y: 0, w: 4, h: 3 },
      createdAt: utc(2026, 3, 1, 9, 15),
      updatedAt: utc(2026, 3, 14, 9, 15),
    },
  ];

  const reports = [
    {
      id: 'demo_report_nova_weekly',
      dashboardId: 'demo_dashboard_nova_team',
      orgId: 'demo_team_nova',
      userId: 'demo_user_ava',
      name: 'Nova Weekly Coaching Summary',
      description:
        'Weekly summary for coaching, forecast, and challenge activity.',
      type: 'usage',
      query: { window: '7d', segments: ['team', 'manager'] },
      schedule: '0 9 * * MON',
      format: 'pdf',
      status: 'active',
      lastRunAt: utc(2026, 3, 14, 8, 45),
      createdAt: utc(2026, 3, 1, 9, 20),
      updatedAt: utc(2026, 3, 14, 8, 45),
    },
    {
      id: 'demo_report_helio_exec',
      dashboardId: 'demo_dashboard_helio_team',
      orgId: 'demo_team_helio',
      userId: 'demo_user_noah',
      name: 'Helio Executive Rollup',
      description: 'Executive readiness and renewal performance summary.',
      type: 'performance',
      query: { window: '30d', includeRenewals: true },
      schedule: '0 7 * * FRI',
      format: 'json',
      status: 'active',
      lastRunAt: utc(2026, 3, 14, 7, 30),
      createdAt: utc(2026, 3, 1, 9, 25),
      updatedAt: utc(2026, 3, 14, 7, 30),
    },
    {
      id: 'demo_report_academy_lti',
      dashboardId: 'demo_dashboard_academy_team',
      orgId: 'demo_team_academy',
      userId: 'demo_user_olivia',
      name: 'Academy LMS Adoption Report',
      description:
        'Tracks LTI launches, assignment quality, and faculty adoption.',
      type: 'custom',
      query: { window: '14d', includeLti: true },
      schedule: '0 10 * * WED',
      format: 'json',
      status: 'active',
      lastRunAt: utc(2026, 3, 13, 10, 0),
      createdAt: utc(2026, 3, 1, 9, 30),
      updatedAt: utc(2026, 3, 13, 10, 0),
    },
  ];

  const reportExecutions = [
    {
      id: 'demo_report_execution_nova_weekly',
      reportId: 'demo_report_nova_weekly',
      status: 'completed',
      resultData: { delivered: true, topScore: 85, generatedBy: DEMO_SEED_TAG },
      error: null,
      duration: 4312,
      startedAt: utc(2026, 3, 14, 8, 45),
      completedAt: utc(2026, 3, 14, 8, 45 + 1),
    },
    {
      id: 'demo_report_execution_helio_exec',
      reportId: 'demo_report_helio_exec',
      status: 'completed',
      resultData: {
        delivered: true,
        execReadiness: 0.87,
        generatedBy: DEMO_SEED_TAG,
      },
      error: null,
      duration: 3187,
      startedAt: utc(2026, 3, 14, 7, 30),
      completedAt: utc(2026, 3, 14, 7, 31),
    },
    {
      id: 'demo_report_execution_academy_lti',
      reportId: 'demo_report_academy_lti',
      status: 'completed',
      resultData: { delivered: true, launches: 14, generatedBy: DEMO_SEED_TAG },
      error: null,
      duration: 2720,
      startedAt: utc(2026, 3, 13, 10, 0),
      completedAt: utc(2026, 3, 13, 10, 1),
    },
  ];

  const metricBlueprints = [
    {
      metricType: 'simulation',
      category: 'usage',
      name: 'sessions_completed',
      unit: 'count',
      values: { demo_team_nova: 5, demo_team_helio: 4, demo_team_academy: 3 },
    },
    {
      metricType: 'simulation',
      category: 'quality',
      name: 'avg_assessment_score',
      unit: 'score',
      values: {
        demo_team_nova: 79,
        demo_team_helio: 82,
        demo_team_academy: 86,
      },
    },
    {
      metricType: 'api_call',
      category: 'performance',
      name: 'avg_response_latency',
      unit: 'ms',
      values: {
        demo_team_nova: 860,
        demo_team_helio: 780,
        demo_team_academy: 690,
      },
    },
  ];

  const metrics = [];
  const events = [];
  const performanceLogs = [];
  const statistics = [];
  const ownerByTeam = {
    demo_team_nova: 'demo_user_ava',
    demo_team_helio: 'demo_user_noah',
    demo_team_academy: 'demo_user_olivia',
  };

  for (let offset = 0; offset < 10; offset += 1) {
    for (const blueprint of metricBlueprints) {
      for (const team of teamDefinitions) {
        const value =
          blueprint.values[team.id] -
          offset +
          (blueprint.metricType === 'simulation' ? 0 : offset * 3);
        metrics.push({
          id: `demo_metric_${team.id}_${blueprint.name}_${offset}`,
          orgId: team.id,
          userId: ownerByTeam[team.id],
          sessionId: null,
          metricType: blueprint.metricType,
          category: blueprint.category,
          name: blueprint.name,
          value,
          unit: blueprint.unit,
          metadata: { seedTag: DEMO_SEED_TAG, offsetDays: offset },
          timestamp: addMinutes(
            daysAgo(offset + 1, 9, 0),
            team.id === 'demo_team_helio' ? 30 : 0,
          ),
          createdAt: addMinutes(daysAgo(offset + 1, 9, 0), 2),
        });
      }
    }
  }

  for (const team of teamDefinitions) {
    statistics.push(
      {
        id: `demo_stat_${team.id}_week_quality`,
        orgId: team.id,
        period: 'week',
        periodKey: '2026-W11',
        metricType: 'simulation',
        category: 'quality',
        aggregates: {
          count: 6,
          avg:
            team.id === 'demo_team_nova'
              ? 79
              : team.id === 'demo_team_helio'
                ? 82
                : 86,
          min: 69,
          max: 87,
          p50: 80,
          p95: 87,
        },
        createdAt: utc(2026, 3, 14, 8, 0),
        updatedAt: utc(2026, 3, 14, 8, 0),
      },
      {
        id: `demo_stat_${team.id}_month_usage`,
        orgId: team.id,
        period: 'month',
        periodKey: '2026-03',
        metricType: 'simulation',
        category: 'usage',
        aggregates: {
          count:
            team.id === 'demo_team_nova'
              ? 18
              : team.id === 'demo_team_helio'
                ? 14
                : 12,
          sum:
            team.id === 'demo_team_nova'
              ? 18
              : team.id === 'demo_team_helio'
                ? 14
                : 12,
          avg: 1,
        },
        createdAt: utc(2026, 3, 14, 8, 5),
        updatedAt: utc(2026, 3, 14, 8, 5),
      },
    );

    events.push(
      {
        id: `demo_event_analytics_${team.id}_page_view`,
        orgId: team.id,
        userId: ownerByTeam[team.id],
        sessionId: null,
        eventType: 'page_view',
        eventName: 'analytics_dashboard_opened',
        properties: { seedTag: DEMO_SEED_TAG, dashboard: team.id },
        context: { browser: 'Chrome', locale: team.locale, device: 'desktop' },
        timestamp: utc(2026, 3, 14, 8, 10),
      },
      {
        id: `demo_event_analytics_${team.id}_feature_use`,
        orgId: team.id,
        userId: ownerByTeam[team.id],
        sessionId: null,
        eventType: 'feature_use',
        eventName: 'report_export_clicked',
        properties: { seedTag: DEMO_SEED_TAG, format: 'pdf' },
        context: { browser: 'Chrome', locale: team.locale, device: 'desktop' },
        timestamp: utc(2026, 3, 14, 8, 20),
      },
    );

    performanceLogs.push(
      {
        id: `demo_perf_${team.id}_sessions`,
        service: 'gateway',
        endpoint: '/api/v1/sessions',
        method: 'GET',
        statusCode: 200,
        duration:
          team.id === 'demo_team_nova'
            ? 182
            : team.id === 'demo_team_helio'
              ? 161
              : 144,
        userId: ownerByTeam[team.id],
        orgId: team.id,
        metadata: { seedTag: DEMO_SEED_TAG, cache: 'hit' },
        timestamp: utc(2026, 3, 14, 8, 30),
      },
      {
        id: `demo_perf_${team.id}_assessment`,
        service: 'simulation',
        endpoint: '/api/v1/assessments/runs/latest',
        method: 'GET',
        statusCode: 200,
        duration:
          team.id === 'demo_team_nova'
            ? 244
            : team.id === 'demo_team_helio'
              ? 228
              : 206,
        userId: ownerByTeam[team.id],
        orgId: team.id,
        metadata: { seedTag: DEMO_SEED_TAG, cache: 'miss' },
        timestamp: utc(2026, 3, 14, 8, 32),
      },
    );
  }

  return {
    dashboards,
    widgets,
    reports,
    reportExecutions,
    metrics,
    statistics,
    events,
    performanceLogs,
  };
}

function buildLtiData() {
  return {
    platforms: [
      {
        id: 'demo_lti_platform_canvas',
        name: 'Northwind Canvas',
        consumerKey: null,
        consumerSecret: null,
        issuer: 'https://canvas.demo.pitch.local',
        clientId: 'canvas-demo-client',
        authLoginUrl:
          'https://canvas.demo.pitch.local/api/lti/authorize_redirect',
        authTokenUrl: 'https://canvas.demo.pitch.local/login/oauth2/token',
        keysetUrl: 'https://canvas.demo.pitch.local/api/lti/security/jwks',
        redirectUris: ['http://localhost:8000/api/lti/v1.3/launch'],
        isActive: true,
        createdAt: utc(2026, 2, 15, 10, 0),
        updatedAt: utc(2026, 3, 14, 10, 0),
      },
      {
        id: 'demo_lti_platform_blackboard',
        name: 'Northwind Blackboard',
        consumerKey: null,
        consumerSecret: null,
        issuer: 'https://blackboard.demo.pitch.local',
        clientId: 'blackboard-demo-client',
        authLoginUrl: 'https://blackboard.demo.pitch.local/oidc/auth',
        authTokenUrl: 'https://blackboard.demo.pitch.local/oidc/token',
        keysetUrl: 'https://blackboard.demo.pitch.local/oidc/jwks',
        redirectUris: ['http://localhost:8000/api/lti/v1.3/launch'],
        isActive: true,
        createdAt: utc(2026, 2, 18, 11, 0),
        updatedAt: utc(2026, 3, 14, 10, 5),
      },
    ],
    deployments: [
      {
        id: 'demo_lti_deployment_canvas',
        platformId: 'demo_lti_platform_canvas',
        deploymentId: 'canvas-course-301',
      },
      {
        id: 'demo_lti_deployment_blackboard',
        platformId: 'demo_lti_platform_blackboard',
        deploymentId: 'blackboard-sales-501',
      },
    ],
    nonces: [
      {
        id: 'demo_lti_nonce_canvas',
        nonce: 'demo-nonce-canvas',
        state: 'demo-state-canvas',
        platformId: 'demo_lti_platform_canvas',
        expiresAt: utc(2026, 3, 14, 19, 0),
        usedAt: null,
        createdAt: utc(2026, 3, 14, 18, 0),
      },
    ],
    sessions: [
      {
        id: 'demo_lti_session_canvas',
        platformId: 'demo_lti_platform_canvas',
        deploymentId: 'canvas-course-301',
        version: 'V1P3',
        userId: 'canvas-user-olivia',
        email: 'olivia@pitchdemo.local',
        name: 'Olivia Carter',
        roles: ['INSTRUCTOR'],
        contextId: 'canvas-course-301',
        contextLabel: 'SALES-301',
        contextTitle: 'Sales Leadership Lab',
        resourceLinkId: 'sales-leadership-lab-link',
        resourceLinkTitle: 'LTI Launch Roleplay',
        sub: 'canvas-sub-olivia',
        nonce: 'demo-nonce-canvas',
        issuedAt: utc(2026, 3, 11, 18, 55),
        pitchSessionId: 'demo_session_academy_lti',
        pitchUserId: 'demo_user_olivia',
        deepLinkReturnUrl: 'https://canvas.demo.pitch.local/deep_link_return',
        namesRolesServiceUrl:
          'https://canvas.demo.pitch.local/api/lti/names_roles',
        lineItemsServiceUrl:
          'https://canvas.demo.pitch.local/api/lti/line_items',
        ltiDeploymentId: 'demo_lti_deployment_canvas',
        createdAt: utc(2026, 3, 11, 18, 55),
        updatedAt: utc(2026, 3, 11, 19, 26),
      },
      {
        id: 'demo_lti_session_blackboard',
        platformId: 'demo_lti_platform_blackboard',
        deploymentId: 'blackboard-sales-501',
        version: 'V1P3',
        userId: 'bb-user-ethan',
        email: 'ethan@pitchdemo.local',
        name: 'Ethan Brooks',
        roles: ['INSTRUCTOR'],
        contextId: 'blackboard-sales-501',
        contextLabel: 'SELL-501',
        contextTitle: 'Enterprise Conversation Studio',
        resourceLinkId: 'enterprise-conversation-link',
        resourceLinkTitle: 'Executive Alignment Simulation',
        sub: 'blackboard-sub-ethan',
        nonce: null,
        issuedAt: utc(2026, 3, 10, 18, 0),
        pitchSessionId: 'demo_session_helio_exec_video',
        pitchUserId: 'demo_user_ethan',
        deepLinkReturnUrl:
          'https://blackboard.demo.pitch.local/deep_link_return',
        namesRolesServiceUrl:
          'https://blackboard.demo.pitch.local/api/lti/names_roles',
        lineItemsServiceUrl:
          'https://blackboard.demo.pitch.local/api/lti/line_items',
        ltiDeploymentId: 'demo_lti_deployment_blackboard',
        createdAt: utc(2026, 3, 10, 18, 0),
        updatedAt: utc(2026, 3, 10, 18, 35),
      },
    ],
    lineItems: [
      {
        id: 'demo_lti_lineitem_canvas',
        sessionId: 'demo_lti_session_canvas',
        label: 'Week 1 Roleplay',
        scoreMaximum: 100,
        resourceId: 'assignment-week-1',
        tag: 'roleplay',
        lineItemUrl: 'https://canvas.demo.pitch.local/api/lti/line_items/week1',
        createdAt: utc(2026, 3, 11, 18, 56),
        updatedAt: utc(2026, 3, 11, 19, 26),
      },
      {
        id: 'demo_lti_lineitem_blackboard',
        sessionId: 'demo_lti_session_blackboard',
        label: 'Executive Alignment Assessment',
        scoreMaximum: 100,
        resourceId: 'assignment-exec-1',
        tag: 'assessment',
        lineItemUrl:
          'https://blackboard.demo.pitch.local/api/lti/line_items/exec1',
        createdAt: utc(2026, 3, 10, 18, 1),
        updatedAt: utc(2026, 3, 10, 18, 35),
      },
    ],
    scores: [
      {
        id: 'demo_lti_score_canvas',
        lineItemId: 'demo_lti_lineitem_canvas',
        userId: 'canvas-sub-olivia',
        scoreGiven: 87,
        scoreMaximum: 100,
        comment: 'Strong launch framing and clear faculty rollout path.',
        activityProgress: 'COMPLETED',
        gradingProgress: 'FULLY_GRADED',
        submittedAt: utc(2026, 3, 11, 19, 28),
        createdAt: utc(2026, 3, 11, 19, 28),
        updatedAt: utc(2026, 3, 11, 19, 28),
      },
      {
        id: 'demo_lti_score_blackboard',
        lineItemId: 'demo_lti_lineitem_blackboard',
        userId: 'blackboard-sub-ethan',
        scoreGiven: 85,
        scoreMaximum: 100,
        comment: 'Boardroom narrative stayed concise and sponsor-ready.',
        activityProgress: 'COMPLETED',
        gradingProgress: 'FULLY_GRADED',
        submittedAt: utc(2026, 3, 10, 18, 36),
        createdAt: utc(2026, 3, 10, 18, 36),
        updatedAt: utc(2026, 3, 10, 18, 36),
      },
    ],
  };
}

function buildSimulationData() {
  const userLookup = new Map(demoUsers.map((user) => [user.id, user]));
  const teamLookup = new Map(teamDefinitions.map((team) => [team.id, team]));
  const scenarioLookup = new Map(
    scenarioDefinitions.map((scenario) => [scenario.id, scenario]),
  );
  const personaLookup = new Map(
    personaDefinitions.map((persona) => [persona.id, persona]),
  );
  const rubricLookup = new Map(
    rubricCatalog.map((rubric) => [rubric.id, rubric]),
  );

  const postgres = {
    llmRoutingConfigs: [
      {
        id: 'demo_llm_routing_global',
        scope: 'global',
        orgId: null,
        userId: null,
        name: 'default',
        isActive: true,
        config: {
          seedTag: DEMO_SEED_TAG,
          provider: 'openai',
          defaultModel: 'gpt-4o-mini',
          fallbackModel: 'gpt-4o-mini',
        },
        createdAt: utc(2026, 3, 1, 8, 0),
        updatedAt: utc(2026, 3, 14, 8, 0),
      },
      {
        id: 'demo_llm_routing_helio',
        scope: 'org',
        orgId: 'demo_team_helio',
        userId: null,
        name: 'enterprise-governance',
        isActive: true,
        config: {
          seedTag: DEMO_SEED_TAG,
          provider: 'openai',
          defaultModel: 'gpt-4o-mini',
          systemBias: 'executive',
        },
        createdAt: utc(2026, 3, 1, 8, 5),
        updatedAt: utc(2026, 3, 14, 8, 5),
      },
    ],
    hintConfigs: [
      {
        id: 'demo_hint_config_global',
        scope: 'global',
        orgId: null,
        userId: null,
        sessionId: null,
        name: 'default',
        isActive: true,
        enabled: true,
        strategy: 'contextual',
        maxHintsPerRequest: 3,
        inactivityThresholdSeconds: 30,
        llmProvider: 'openai',
        llmModel: 'gpt-4o-mini',
        temperature: 0.6,
        maxTokens: 300,
        config: { seedTag: DEMO_SEED_TAG, prioritizeObjectives: true },
        createdAt: utc(2026, 3, 1, 8, 10),
        updatedAt: utc(2026, 3, 14, 8, 10),
      },
      {
        id: 'demo_hint_config_boardroom',
        scope: 'session',
        orgId: 'demo_team_nova',
        userId: 'demo_user_mia',
        sessionId: 'demo_session_nova_boardroom_video',
        name: 'boardroom-urgent',
        isActive: true,
        enabled: true,
        strategy: 'reactive',
        maxHintsPerRequest: 2,
        inactivityThresholdSeconds: 20,
        llmProvider: 'openai',
        llmModel: 'gpt-4o-mini',
        temperature: 0.5,
        maxTokens: 220,
        config: { seedTag: DEMO_SEED_TAG, voice: 'executive' },
        createdAt: utc(2026, 3, 14, 16, 0),
        updatedAt: utc(2026, 3, 14, 16, 0),
      },
    ],
    scenarios: scenarioDefinitions.map((scenario) => ({
      ...scenario,
      updatedAt: scenario.createdAt,
    })),
    personas: personaDefinitions.map((persona) => ({
      ...persona,
      updatedAt: persona.createdAt,
    })),
    rubrics: rubricCatalog.map((rubric) => ({
      id: rubric.id,
      orgId: rubric.orgId,
      name: rubric.name,
      version: rubric.version,
      createdAt: utc(2026, 3, 1, 8, 15),
      updatedAt: utc(2026, 3, 14, 8, 15),
    })),
    criteria: rubricCatalog.flatMap((rubric) =>
      rubric.criteria.map((criterion) => ({
        ...criterion,
        rubricId: rubric.id,
        createdAt: utc(2026, 3, 1, 8, 16 + criterion.order),
      })),
    ),
    sessions: [],
    sessionMembers: [],
    iterations: [],
    turns: [],
    messages: [],
    toolCalls: [],
    events: [],
    metrics: [],
    draftEmails: [],
    callSessions: [],
    recordings: [],
    mediaAssets: [],
    ingestionJobs: [],
    transcripts: [],
    redactionSpans: [],
    evalArtifacts: [],
    benchmarks: [
      {
        id: 'demo_benchmark_nova_score',
        orgId: 'demo_team_nova',
        name: 'forecast_confidence',
        metric: 'avg_score',
        value: 78,
        window: '30d',
        createdAt: utc(2026, 3, 14, 7, 50),
        updatedAt: utc(2026, 3, 14, 7, 50),
      },
      {
        id: 'demo_benchmark_helio_score',
        orgId: 'demo_team_helio',
        name: 'exec_alignment',
        metric: 'avg_score',
        value: 82,
        window: '30d',
        createdAt: utc(2026, 3, 14, 7, 51),
        updatedAt: utc(2026, 3, 14, 7, 51),
      },
      {
        id: 'demo_benchmark_academy_score',
        orgId: 'demo_team_academy',
        name: 'faculty_rollout',
        metric: 'avg_score',
        value: 86,
        window: '30d',
        createdAt: utc(2026, 3, 14, 7, 52),
        updatedAt: utc(2026, 3, 14, 7, 52),
      },
      {
        id: 'demo_benchmark_nova_completion',
        orgId: 'demo_team_nova',
        name: 'completion_rate',
        metric: 'completion_rate',
        value: 0.86,
        window: '30d',
        createdAt: utc(2026, 3, 14, 7, 53),
        updatedAt: utc(2026, 3, 14, 7, 53),
      },
      {
        id: 'demo_benchmark_helio_latency',
        orgId: 'demo_team_helio',
        name: 'response_speed',
        metric: 'avg_latency_ms',
        value: 812,
        window: '30d',
        createdAt: utc(2026, 3, 14, 7, 54),
        updatedAt: utc(2026, 3, 14, 7, 54),
      },
    ],
    scorecards: [],
    scoreItems: [],
    coachTips: [],
    assessmentRuns: [],
    assessmentLabels: [],
    assessmentSummaries: [],
    challenges: challengeDefinitions,
    challengeParticipations: [
      {
        id: 'demo_participation_challenge_mia',
        challengeId: 'demo_challenge_daily_beginner',
        userId: 'demo_user_mia',
        sessionId: 'demo_session_challenge_pricing',
        score: 84,
        completedAt: utc(2026, 3, 13, 16, 20),
        createdAt: utc(2026, 3, 13, 15, 58),
        updatedAt: utc(2026, 3, 13, 16, 20),
      },
      {
        id: 'demo_participation_challenge_ava',
        challengeId: 'demo_challenge_daily_beginner',
        userId: 'demo_user_ava',
        sessionId: 'demo_session_nova_discovery',
        score: 91,
        completedAt: utc(2026, 3, 14, 9, 10),
        createdAt: utc(2026, 3, 14, 8, 45),
        updatedAt: utc(2026, 3, 14, 9, 10),
      },
      {
        id: 'demo_participation_challenge_noah',
        challengeId: 'demo_challenge_monthly_master',
        userId: 'demo_user_noah',
        sessionId: 'demo_session_helio_exec_video',
        score: 94,
        completedAt: utc(2026, 3, 10, 18, 35),
        createdAt: utc(2026, 3, 10, 17, 55),
        updatedAt: utc(2026, 3, 10, 18, 35),
      },
      {
        id: 'demo_participation_challenge_olivia',
        challengeId: 'demo_challenge_daily_intermediate',
        userId: 'demo_user_olivia',
        sessionId: 'demo_session_academy_lti',
        score: 76,
        completedAt: utc(2026, 3, 11, 19, 28),
        createdAt: utc(2026, 3, 11, 18, 50),
        updatedAt: utc(2026, 3, 11, 19, 28),
      },
      {
        id: 'demo_participation_challenge_ethan',
        challengeId: 'demo_challenge_weekly_expert',
        userId: 'demo_user_ethan',
        sessionId: 'demo_session_helio_renewal',
        score: 81,
        completedAt: utc(2026, 3, 8, 14, 30),
        createdAt: utc(2026, 3, 8, 13, 55),
        updatedAt: utc(2026, 3, 8, 14, 30),
      },
    ],
    reportRequests: [],
  };

  const mongo = {
    reportSnapshots: [],
    assessmentReports: [],
    hints: [],
    eventLogs: [],
    evalArtifactData: [],
    llmTraces: [],
    enrichedTranscripts: [],
    sessionInvitations: [],
  };

  function buildConversationSegments(sessionSeed) {
    return sessionSeed.conversation.map((message, index) => ({
      _id: `seg_${sessionSeed.key}_${index + 1}`,
      startMs: index * 15000,
      endMs: index * 15000 + 12000,
      text: message.text,
      speakerId: message.role === 'user' ? 'rep' : 'buyer',
      sentiment:
        message.role === 'user'
          ? { score: 0.35, label: 'positive' }
          : { score: 0.12, label: 'neutral' },
    }));
  }

  function buildBenchmarkComparisons(teamId, totalScore) {
    const baseline =
      teamId === 'demo_team_nova' ? 78 : teamId === 'demo_team_helio' ? 82 : 86;
    return [
      {
        name: 'average_score',
        metric: 'avg_score',
        sessionValue: totalScore,
        benchmarkValue: baseline,
        percentile: Math.max(
          55,
          Math.min(98, Math.round((totalScore / Math.max(baseline, 1)) * 70)),
        ),
      },
      {
        name: 'completion_rate',
        metric: 'completion_rate',
        sessionValue: totalScore >= 75 ? 0.94 : 0.82,
        benchmarkValue: teamId === 'demo_team_nova' ? 0.86 : 0.89,
        percentile: totalScore >= 80 ? 88 : 67,
      },
    ];
  }

  function buildReportChunks(sessionSeed, turns) {
    return chunk(turns, 4).map((turnGroup, index) => ({
      chunkIndex: index,
      turnIds: turnGroup.map((turn) => turn.id),
      summary:
        index === 0
          ? 'The conversation established context and clarified the main source of friction.'
          : 'The final turns moved from objection handling into a concrete next step.',
    }));
  }

  function buildSessionArtifacts(sessionSeed, rich = false) {
    const team = teamLookup.get(sessionSeed.teamId);
    const owner = userLookup.get(sessionSeed.ownerId);
    const scenario = sessionSeed.scenarioId
      ? scenarioLookup.get(sessionSeed.scenarioId)
      : null;
    const persona = sessionSeed.personaId
      ? personaLookup.get(sessionSeed.personaId)
      : null;

    if (!team || !owner) {
      throw new Error(`Missing team or owner for session ${sessionSeed.id}`);
    }

    const sessionRecord = {
      id: sessionSeed.id,
      orgId: team.id,
      name: sessionSeed.name,
      type: sessionSeed.type,
      tags: sessionSeed.tags,
      sessionConfig: jsonClone(sessionSeed.sessionConfig),
      orgSnapshot: buildOrgSnapshot(team),
      scenarioId: sessionSeed.scenarioId,
      personaId: sessionSeed.personaId,
      language: sessionSeed.language || 'en-US',
      crmContextId: sessionSeed.crmContextId || null,
      status: sessionSeed.status,
      endedReason: sessionSeed.status === 'ended' ? 'completed' : null,
      createdAt: sessionSeed.createdAt,
      updatedAt: sessionSeed.endedAt || sessionSeed.createdAt,
      endedAt: sessionSeed.endedAt,
    };

    postgres.sessions.push(sessionRecord);

    const ownerMemberId = `demo_member_${sessionSeed.key}_owner`;
    postgres.sessionMembers.push({
      id: ownerMemberId,
      sessionId: sessionSeed.id,
      userId: owner.id,
      role: 'owner',
      userSnapshot: buildUserSnapshot(owner),
      joinedAt: sessionSeed.startedAt,
      updatedAt: sessionSeed.endedAt || sessionSeed.startedAt,
    });

    for (const [index, collaboratorId] of (
      sessionSeed.collaboratorIds || []
    ).entries()) {
      const collaborator = userLookup.get(collaboratorId);
      if (!collaborator) continue;
      postgres.sessionMembers.push({
        id: `demo_member_${sessionSeed.key}_collab_${index + 1}`,
        sessionId: sessionSeed.id,
        userId: collaborator.id,
        role: index === 0 ? 'editor' : 'viewer',
        userSnapshot: buildUserSnapshot(collaborator),
        joinedAt: addMinutes(sessionSeed.startedAt, 1 + index),
        updatedAt:
          sessionSeed.endedAt || addMinutes(sessionSeed.startedAt, 1 + index),
      });
    }

    if (sessionSeed.inviteeId) {
      const inviter = owner;
      const invitee = userLookup.get(sessionSeed.inviteeId);
      if (invitee) {
        mongo.sessionInvitations.push({
          _id: `demo_session_invitation_${sessionSeed.key}`,
          sessionId: sessionSeed.id,
          inviterId: inviter.id,
          inviterSnapshot: buildUserSnapshot(inviter),
          inviteeId: invitee.id,
          inviteeSnapshot: buildUserSnapshot(invitee),
          status: 'pending',
          message: 'Join as an observer for the boardroom walkthrough.',
          respondedAt: null,
          createdAt: addMinutes(sessionSeed.createdAt, 2),
          updatedAt: addMinutes(sessionSeed.createdAt, 2),
        });
      }
    }

    const iterationId = `demo_iteration_${sessionSeed.key}_1`;
    postgres.iterations.push({
      id: iterationId,
      sessionId: sessionSeed.id,
      sessionMemberId: ownerMemberId,
      iterationNumber: 1,
      status: sessionSeed.status === 'ended' ? 'completed' : 'active',
      endedReason: sessionSeed.status === 'ended' ? 'completed' : null,
      userSnapshot: buildUserSnapshot(owner),
      startedAt: sessionSeed.startedAt,
      endedAt: sessionSeed.endedAt,
    });

    const turns = sessionSeed.conversation.map((message, index) => {
      const createdAt = addMinutes(sessionSeed.startedAt, index * 3);
      const turn = {
        id: `demo_turn_${sessionSeed.key}_${index + 1}`,
        iterationId,
        role: message.role,
        text: message.text,
        audioAssetId: null,
        attachments: null,
        metadata: null,
        order: index + 1,
        createdAt,
      };
      postgres.turns.push(turn);
      postgres.messages.push({
        id: `demo_message_${sessionSeed.key}_${index + 1}`,
        iterationId,
        turnId: turn.id,
        role: message.role,
        content: message.text,
        redaction: null,
        language: sessionSeed.language || 'en-US',
        createdAt,
      });
      return turn;
    });

    const coreMetricId = `demo_metric_session_${sessionSeed.key}`;
    postgres.metrics.push({
      id: coreMetricId,
      iterationId,
      tokensInput: sessionSeed.metrics?.tokensInput ?? 420,
      tokensOutput: sessionSeed.metrics?.tokensOutput ?? 610,
      toolCount: sessionSeed.metrics?.toolCount ?? 0,
      latencyMs: sessionSeed.metrics?.latencyMs ?? 480,
      costUsd: sessionSeed.metrics?.costUsd ?? 0.11,
      model: sessionSeed.metrics?.model ?? 'gpt-4o-mini',
      createdAt: addMinutes(sessionSeed.startedAt, 2),
    });

    postgres.events.push({
      id: `demo_event_${sessionSeed.key}_started`,
      iterationId,
      type: 'simulation_started',
      payload: { seedTag: DEMO_SEED_TAG, sessionType: sessionSeed.type },
      mongoEventLogId: null,
      createdAt: sessionSeed.startedAt,
    });

    if (sessionSeed.status === 'ended') {
      const eventLogId = `demo_eventlog_${sessionSeed.key}`;
      mongo.eventLogs.push({
        _id: eventLogId,
        eventId: `demo_event_${sessionSeed.key}_analytics`,
        iterationId,
        sessionMemberId: ownerMemberId,
        type: 'analytics_updated',
        payload: {
          seedTag: DEMO_SEED_TAG,
          sessionId: sessionSeed.id,
          totalTurns: turns.length,
          totalWords: sessionSeed.conversation.reduce(
            (sum, item) => sum + textWordCount(item.text),
            0,
          ),
        },
        context: {
          userId: owner.id,
          orgId: team.id,
          traceId: `trace_${sessionSeed.key}`,
          correlationId: `corr_${sessionSeed.key}`,
          source: 'seed-demo',
          version: 'v1',
        },
        metadata: {
          size: 512,
          compressed: false,
          retryCount: 0,
          processingTimeMs: 82,
        },
        createdAt: addMinutes(sessionSeed.startedAt, turns.length * 2),
        updatedAt: addMinutes(sessionSeed.startedAt, turns.length * 2),
      });

      postgres.events.push({
        id: `demo_event_${sessionSeed.key}_analytics`,
        iterationId,
        type: 'analytics_updated',
        payload: { seedTag: DEMO_SEED_TAG, status: 'captured' },
        mongoEventLogId: eventLogId,
        createdAt: addMinutes(sessionSeed.startedAt, turns.length * 2),
      });
      postgres.events.push({
        id: `demo_event_${sessionSeed.key}_completed`,
        iterationId,
        type: 'simulation_completed',
        payload: { seedTag: DEMO_SEED_TAG, endedReason: 'completed' },
        mongoEventLogId: null,
        createdAt: sessionSeed.endedAt,
      });
    }

    for (const [index, toolSpec] of (
      sessionSeed.toolCallSpecs || []
    ).entries()) {
      const turn =
        turns.find((candidate) => candidate.order === toolSpec.turnOrder) ||
        null;
      postgres.toolCalls.push({
        id: `demo_toolcall_${sessionSeed.key}_${index + 1}`,
        iterationId,
        turnId: turn ? turn.id : null,
        name: toolSpec.name,
        input: toolSpec.input,
        output: toolSpec.output,
        latencyMs: toolSpec.latencyMs,
        success: toolSpec.success,
        createdAt: turn
          ? addMinutes(turn.createdAt, 1)
          : addMinutes(sessionSeed.startedAt, 1),
      });
    }

    for (const [index, draft] of (sessionSeed.draftEmails || []).entries()) {
      postgres.draftEmails.push({
        id: `demo_draft_${sessionSeed.key}_${index + 1}`,
        iterationId,
        audience: draft.audience,
        purpose: draft.purpose,
        tone: draft.tone,
        bullets: draft.bullets,
        body: draft.body,
        createdAt: addMinutes(
          sessionSeed.endedAt || sessionSeed.startedAt,
          2 + index,
        ),
        updatedAt: addMinutes(
          sessionSeed.endedAt || sessionSeed.startedAt,
          2 + index,
        ),
      });
    }

    if (sessionSeed.call) {
      postgres.callSessions.push({
        id: sessionSeed.call.id,
        iterationId,
        tracks: sessionSeed.call.tracks,
        sdpOffer: 'v=0\no=- 0 0 IN IP4 127.0.0.1',
        sdpAnswer:
          sessionSeed.status === 'ended'
            ? 'v=0\no=- 0 0 IN IP4 127.0.0.1'
            : null,
        status: sessionSeed.call.status,
        createdAt: sessionSeed.startedAt,
        updatedAt: sessionSeed.endedAt || sessionSeed.startedAt,
      });
    }

    if (sessionSeed.transcript) {
      const assetId = sessionSeed.transcript.assetId;
      const pdfAssetId = `demo_asset_${sessionSeed.key}_report_pdf`;
      postgres.mediaAssets.push(
        {
          id: assetId,
          mimeType: sessionSeed.transcript.mimeType,
          sizeBytes: BigInt(sessionSeed.transcript.durationMs * 18),
          storageKey: sessionSeed.transcript.storageKey,
          url: storageUrl(sessionSeed.transcript.storageKey),
          ownerIterationId: iterationId,
          createdAt: sessionSeed.startedAt,
          updatedAt: sessionSeed.endedAt || sessionSeed.startedAt,
        },
        {
          id: pdfAssetId,
          mimeType: 'application/pdf',
          sizeBytes: BigInt(242880),
          storageKey: `reports/${sessionSeed.key}.pdf`,
          url: storageUrl(`reports/${sessionSeed.key}.pdf`),
          ownerIterationId: iterationId,
          createdAt: addMinutes(
            sessionSeed.endedAt || sessionSeed.startedAt,
            3,
          ),
          updatedAt: addMinutes(
            sessionSeed.endedAt || sessionSeed.startedAt,
            3,
          ),
        },
      );

      const callId = sessionSeed.call
        ? sessionSeed.call.id
        : `demo_call_${sessionSeed.key}`;
      if (!sessionSeed.call) {
        postgres.callSessions.push({
          id: callId,
          iterationId,
          tracks: ['audio'],
          sdpOffer: null,
          sdpAnswer: null,
          status: sessionSeed.status === 'ended' ? 'ended' : 'active',
          createdAt: sessionSeed.startedAt,
          updatedAt: sessionSeed.endedAt || sessionSeed.startedAt,
        });
      }

      postgres.recordings.push({
        id: `demo_recording_${sessionSeed.key}`,
        callId,
        layout: sessionSeed.type === 'video' ? 'speaker' : 'speaker',
        tracks: sessionSeed.type === 'video' ? ['audio', 'video'] : ['audio'],
        assetId,
        durationMs: sessionSeed.transcript.durationMs,
        createdAt: sessionSeed.endedAt || sessionSeed.startedAt,
      });

      postgres.ingestionJobs.push({
        id: `demo_ingest_${sessionSeed.key}`,
        assetId,
        pipeline: 'transcribe_enrich',
        status: 'completed',
        error: null,
        transcriptId: `demo_transcript_${sessionSeed.key}`,
        startedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 1),
        completedAt: addMinutes(
          sessionSeed.endedAt || sessionSeed.startedAt,
          2,
        ),
        createdAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 1),
        updatedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
      });

      postgres.transcripts.push({
        id: `demo_transcript_${sessionSeed.key}`,
        assetId,
        iterationId,
        language: sessionSeed.language || 'en-US',
        text: sessionSeed.conversation
          .map((message) => `${message.role.toUpperCase()}: ${message.text}`)
          .join('\n'),
        metadata: {
          seedTag: DEMO_SEED_TAG,
          durationMs: sessionSeed.transcript.durationMs,
          speakerCount: 2,
          wordCount: sessionSeed.conversation.reduce(
            (sum, item) => sum + textWordCount(item.text),
            0,
          ),
        },
        createdAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
        updatedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
      });

      mongo.enrichedTranscripts.push({
        _id: new mongoose.Types.ObjectId(
          (7000 + mongo.enrichedTranscripts.length)
            .toString(16)
            .padStart(24, '0'),
        ),
        assetId,
        iterationId,
        sessionMemberId: ownerMemberId,
        language: sessionSeed.language || 'en-US',
        segments: buildConversationSegments(sessionSeed),
        speakers: [
          {
            _id: 'rep',
            label: owner.name,
            role: 'agent',
            totalDurationMs: Math.round(
              sessionSeed.transcript.durationMs * 0.46,
            ),
            segmentCount: Math.ceil(sessionSeed.conversation.length / 2),
          },
          {
            _id: 'buyer',
            label: persona ? persona.name : 'Buyer',
            role: 'customer',
            totalDurationMs: Math.round(
              sessionSeed.transcript.durationMs * 0.54,
            ),
            segmentCount: Math.floor(sessionSeed.conversation.length / 2),
          },
        ],
        enrichment: {
          summary: sessionSeed.transcript.summary,
          topics: sessionSeed.transcript.topics.map((topic) => ({
            ...topic,
            mentions: 2,
          })),
          sentiment: {
            overall: sessionSeed.transcript.sentiment.overall,
            trend: sessionSeed.transcript.sentiment.trend,
          },
          entities: {
            organizations: [team.name],
            people: persona ? [persona.name] : [],
            products: ['PITCH'],
          },
          highlights: [
            {
              type: 'key_moment',
              text: sessionSeed.conversation[0].text,
              startMs: 0,
              endMs: 12000,
              importance: 0.78,
            },
          ],
          analyzedAt: addMinutes(
            sessionSeed.endedAt || sessionSeed.startedAt,
            3,
          ),
          modelVersion: 'demo-enrichment-v1',
          processingTimeMs: 980,
        },
        durationMs: sessionSeed.transcript.durationMs,
        wordCount: sessionSeed.conversation.reduce(
          (sum, item) => sum + textWordCount(item.text),
          0,
        ),
        speakerCount: 2,
        createdAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
        updatedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
      });

      if (rich) {
        postgres.reportRequests.push({
          id: `demo_report_request_${sessionSeed.key}_pdf`,
          iterationId,
          format: 'pdf',
          status: 'ready',
          assetId: pdfAssetId,
          error: null,
          createdAt: addMinutes(
            sessionSeed.endedAt || sessionSeed.startedAt,
            4,
          ),
          updatedAt: addMinutes(
            sessionSeed.endedAt || sessionSeed.startedAt,
            4,
          ),
        });
      }
    }

    if (rich && sessionSeed.assessment) {
      const rubric = rubricLookup.get(sessionSeed.rubricId);
      if (!rubric) {
        throw new Error(
          `Missing rubric ${sessionSeed.rubricId} for session ${sessionSeed.id}`,
        );
      }

      const totalScore = sessionSeed.assessment.scoreItems.reduce(
        (sum, item) => sum + item.score,
        0,
      );
      const scorecardId = `demo_scorecard_${sessionSeed.key}`;
      postgres.scorecards.push({
        id: scorecardId,
        iterationId,
        rubricId: rubric.id,
        totalScore,
        maxScore: 100,
        locale: sessionSeed.language || 'en-US',
        createdAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 1),
        updatedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
      });

      rubric.criteria.forEach((criterion, index) => {
        const scoreItem = sessionSeed.assessment.scoreItems[index];
        postgres.scoreItems.push({
          id: `demo_score_item_${sessionSeed.key}_${index + 1}`,
          scorecardId,
          criterionId: criterion.id,
          score: scoreItem.score,
          details: { feedback: scoreItem.details, seedTag: DEMO_SEED_TAG },
          createdAt: addMinutes(
            sessionSeed.endedAt || sessionSeed.startedAt,
            2,
          ),
        });
      });

      sessionSeed.assessment.coachTips.forEach((tip, index) => {
        postgres.coachTips.push({
          id: `demo_coach_tip_${sessionSeed.key}_${index + 1}`,
          scorecardId,
          text: tip.text,
          link: tip.link || null,
          excerptRef: index === 0 ? turns[0].id : null,
          createdAt: addMinutes(
            sessionSeed.endedAt || sessionSeed.startedAt,
            2 + index,
          ),
        });
      });

      const assessmentRunId = `demo_assessment_${sessionSeed.key}`;
      const scoreBreakdown = scoreBreakdownFromCriterionScores(
        rubric.criteria,
        sessionSeed.assessment.scoreItems.map((item) => item.score),
      );

      postgres.assessmentRuns.push({
        id: assessmentRunId,
        iterationId,
        status: 'completed',
        mode: sessionSeed.assessment.mode,
        inputHash: `demo_hash_${sessionSeed.key}`,
        config: {
          version: 'demo-v1',
          seedTag: DEMO_SEED_TAG,
          rubricId: rubric.id,
        },
        engineVersion: 'demo-assessor-1.0',
        totalScore,
        startedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 1),
        completedAt: addMinutes(
          sessionSeed.endedAt || sessionSeed.startedAt,
          2,
        ),
        mongoReportId: assessmentRunId,
        createdAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 1),
        updatedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
      });

      postgres.assessmentSummaries.push({
        id: `demo_assessment_summary_${sessionSeed.key}`,
        assessmentRunId,
        totalScore,
        scoreBreakdown,
        narrativeSummary: sessionSeed.assessment.narrativeSummary,
        coachTips: sessionSeed.assessment.coachTips,
        createdAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
        updatedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
      });

      sessionSeed.assessment.labels.forEach((label, index) => {
        const turn = turns.find(
          (candidate) => candidate.order === label.turnOrder,
        );
        if (!turn) return;
        postgres.assessmentLabels.push({
          id: `demo_assessment_label_${sessionSeed.key}_${index + 1}`,
          assessmentRunId,
          turnId: turn.id,
          label: label.label,
          confidence: label.confidence,
          scoreDelta: label.scoreDelta,
          evidence: label.evidence,
          isFinal: true,
          createdAt: addMinutes(turn.createdAt, 1),
        });
      });

      const evalArtifactId = `demo_eval_${sessionSeed.key}`;
      const lastUserTurn =
        [...turns].reverse().find((turn) => turn.role === 'user') ||
        turns[turns.length - 1];
      postgres.evalArtifacts.push({
        id: evalArtifactId,
        iterationId,
        turnId: lastUserTurn ? lastUserTurn.id : null,
        kind: 'llm_judge',
        score: Number((totalScore / 100).toFixed(2)),
        createdAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
      });

      mongo.evalArtifactData.push({
        _id: evalArtifactId,
        iterationId,
        sessionMemberId: ownerMemberId,
        turnId: lastUserTurn ? lastUserTurn.id : null,
        kind: 'llm_judge',
        data: {
          llmJudge: {
            model: 'gpt-4o-mini',
            prompt: 'Evaluate the learner turn against the rubric.',
            response: sessionSeed.assessment.narrativeSummary,
            reasoning: sessionSeed.assessment.narrativeSummary,
            score: Number((totalScore / 100).toFixed(2)),
            criteria: rubric.criteria.map((criterion, index) => ({
              name: criterion.label,
              score: sessionSeed.assessment.scoreItems[index].score,
              feedback: sessionSeed.assessment.scoreItems[index].details,
            })),
          },
        },
        score: Number((totalScore / 100).toFixed(2)),
        metadata: {
          evaluatorVersion: 'demo-judge-v1',
          modelVersion: 'gpt-4o-mini',
          evaluatedAt: addMinutes(
            sessionSeed.endedAt || sessionSeed.startedAt,
            2,
          ),
          processingTimeMs: 711,
          contextUsed: {
            retrievedDocs: 2,
            totalTokens: sessionSeed.metrics?.tokensInput ?? 0,
          },
        },
        createdAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
        updatedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
      });

      const reportRequestId = `demo_report_request_${sessionSeed.key}_json`;
      postgres.reportRequests.push({
        id: reportRequestId,
        iterationId,
        format: 'json',
        status: 'ready',
        assetId: null,
        error: null,
        createdAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 3),
        updatedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 3),
      });

      const transcriptRecord =
        postgres.transcripts.find((item) => item.iterationId === iterationId) ||
        null;
      const benchmarkComparisons = buildBenchmarkComparisons(
        team.id,
        totalScore,
      );
      mongo.reportSnapshots.push({
        _id: reportRequestId,
        iterationId,
        sessionMemberId: ownerMemberId,
        format: 'json',
        generatedAt: addMinutes(
          sessionSeed.endedAt || sessionSeed.startedAt,
          3,
        ),
        data: {
          session: {
            id: sessionSeed.id,
            mode: sessionSeed.type,
            scenario: scenario
              ? { name: scenario.name, description: scenario.description }
              : undefined,
            persona: persona
              ? { name: persona.name, traits: persona.traits }
              : undefined,
            duration: sessionSeed.endedAt
              ? Math.round(
                  (sessionSeed.endedAt.getTime() -
                    sessionSeed.startedAt.getTime()) /
                    60000,
                )
              : undefined,
            startedAt: sessionSeed.startedAt,
            endedAt: sessionSeed.endedAt,
            status: sessionSeed.status,
          },
          turns: turns.map((turn) => ({
            order: turn.order,
            role: turn.role,
            text: turn.text,
            timestamp: turn.createdAt,
            metadata: turn.metadata || undefined,
          })),
          transcript: transcriptRecord
            ? {
                id: transcriptRecord.id,
                language: transcriptRecord.language,
                text: transcriptRecord.text,
                durationMs: transcriptRecord.metadata.durationMs,
                speakerCount: transcriptRecord.metadata.speakerCount,
                wordCount: transcriptRecord.metadata.wordCount,
                summary: sessionSeed.transcript
                  ? sessionSeed.transcript.summary
                  : undefined,
                topics: sessionSeed.transcript
                  ? sessionSeed.transcript.topics
                  : undefined,
                sentiment: sessionSeed.transcript
                  ? sessionSeed.transcript.sentiment
                  : undefined,
              }
            : undefined,
          scorecard: {
            id: scorecardId,
            rubric: { name: rubric.name, version: rubric.version },
            totalScore,
            maxScore: 100,
            percentage: totalScore,
            items: rubric.criteria.map((criterion, index) => ({
              criterion: criterion.label,
              score: sessionSeed.assessment.scoreItems[index].score,
              maxPoints: criterion.maxPoints,
              details: sessionSeed.assessment.scoreItems[index].details,
            })),
            coachTips: sessionSeed.assessment.coachTips.map((tip) => ({
              text: tip.text,
              link: tip.link || undefined,
            })),
          },
          metrics: {
            tokensInput: sessionSeed.metrics?.tokensInput,
            tokensOutput: sessionSeed.metrics?.tokensOutput,
            toolCount: sessionSeed.metrics?.toolCount,
            averageLatencyMs: sessionSeed.metrics?.latencyMs,
            cost: sessionSeed.metrics?.costUsd,
          },
          benchmarks: benchmarkComparisons,
          insights: {
            strengths: sessionSeed.assessment.insights.strengths,
            areasForImprovement:
              sessionSeed.assessment.insights.areasForImprovement,
            recommendations: sessionSeed.assessment.insights.recommendations,
            highlights: [
              {
                type: 'turn',
                text: turns[0].text,
                timestamp: 0,
              },
            ],
          },
          evaluations: [
            {
              kind: 'llm_judge',
              score: Number((totalScore / 100).toFixed(2)),
              summary: sessionSeed.assessment.narrativeSummary,
            },
          ],
        },
        metadata: {
          version: 'demo-report-v1',
          generatedBy: 'seed-demo',
          templateVersion: 'v1',
          locale: sessionSeed.language || 'en-US',
          includeTranscript: Boolean(transcriptRecord),
          includeScorecard: true,
          includeMetrics: true,
        },
        createdAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 3),
        updatedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 3),
      });

      const turnAnnotationLookup = new Map(
        sessionSeed.assessment.labels.map((label) => {
          const turn = turns.find(
            (candidate) => candidate.order === label.turnOrder,
          );
          return [
            label.turnOrder,
            {
              turnId: turn ? turn.id : null,
              role: turn ? turn.role : 'user',
              text: turn ? turn.text : '',
              label: label.label,
              confidence: label.confidence,
              evidence: label.evidence,
              scoreDelta: label.scoreDelta,
              reasonSummary: sessionSeed.assessment.scoreItems[0].details,
              isFinal: true,
            },
          ];
        }),
      );

      mongo.assessmentReports.push({
        _id: assessmentRunId,
        runId: assessmentRunId,
        iterationId,
        sessionMemberId: ownerMemberId,
        sessionId: sessionSeed.id,
        mode: sessionSeed.assessment.mode,
        configVersion: 'demo-v1',
        engineVersion: 'demo-assessor-1.0',
        reportVersion: 'demo-report-v1',
        report: {
          totalScore,
          scoreBreakdown,
          summary: {
            narrativeSummary: sessionSeed.assessment.narrativeSummary,
            coachTips: sessionSeed.assessment.coachTips,
            objectiveMet: totalScore >= 75,
          },
          turnAnnotations: sessionSeed.assessment.labels
            .map((label) => turnAnnotationLookup.get(label.turnOrder))
            .filter(Boolean),
          chunks: buildReportChunks(sessionSeed, turns),
          conversationHistory: turns.map((turn) => ({
            turnId: turn.id,
            role: turn.role,
            text: turn.text,
            createdAt: turn.createdAt.toISOString(),
            iterationId,
            iterationNumber: 1,
            isEvaluated: sessionSeed.assessment.labels.some(
              (label) => label.turnOrder === turn.order,
            ),
          })),
        },
        trace: {
          nodeTimings: [
            { node: 'prepare_context', ms: 54 },
            { node: 'judge_turns', ms: 281 },
            { node: 'compose_summary', ms: 119 },
          ],
          warnings: [],
          partial: false,
          reasonSummaries: [sessionSeed.assessment.narrativeSummary],
        },
        createdAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
        updatedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 2),
      });

      mongo.hints.push({
        _id: `demo_hint_${sessionSeed.key}`,
        sessionId: sessionSeed.id,
        turnId: turns[turns.length - 1].id,
        userId: owner.id,
        orgId: team.id,
        strategy: 'contextual',
        hints: [
          {
            id: `demo_hint_item_${sessionSeed.key}_1`,
            type: 'follow_up',
            content:
              'Confirm the named owner and the review date before ending the conversation.',
            rationale:
              'The conversation is close to a commitment and can be tightened with one explicit owner.',
            score: 0.89,
            context: {
              conversationLength: turns.length,
              lastUserMessage:
                turns[turns.length - 2]?.text || turns[turns.length - 1].text,
            },
          },
        ],
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.4,
          maxTokens: 180,
        },
        usage: {
          promptTokens: 180,
          completionTokens: 48,
          totalTokens: 228,
          cost: 0.01,
        },
        conversationContext: {
          messages: turns.slice(-4).map((turn) => ({
            role: turn.role,
            content: turn.text,
            timestamp: turn.createdAt,
          })),
          conversationLength: turns.length,
          lastUserMessageAt: turns
            .filter((turn) => turn.role === 'user')
            .slice(-1)[0]?.createdAt,
          inactivityDuration: 22,
          objectives: [
            scenario?.config?.objective || 'Complete the simulation',
          ],
          completedObjectives:
            totalScore >= 75 ? ['Primary objective achieved'] : [],
          pendingObjectives:
            totalScore >= 75 ? [] : ['Sharpen the next-step ask'],
        },
        generatedAt: addMinutes(
          sessionSeed.endedAt || sessionSeed.startedAt,
          1,
        ),
        requestId: `demo_hint_request_${sessionSeed.key}`,
        metadata: { seedTag: DEMO_SEED_TAG },
        createdAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 1),
        updatedAt: addMinutes(sessionSeed.endedAt || sessionSeed.startedAt, 1),
      });

      const llmTurns = turns
        .filter((turn) => turn.role === 'assistant')
        .slice(0, 2);
      llmTurns.forEach((turn, index) => {
        mongo.llmTraces.push({
          _id: `demo_llm_trace_${sessionSeed.key}_${index + 1}`,
          iterationId,
          sessionMemberId: ownerMemberId,
          turnId: turn.id,
          toolCallId: null,
          messageId: `demo_message_${sessionSeed.key}_${turn.order}`,
          provider: 'openai',
          llmModel: 'gpt-4o-mini',
          modelVersion: '2026-02',
          request: {
            messages: turns
              .slice(Math.max(0, turn.order - 3), turn.order - 1)
              .map((messageTurn) => ({
                role: messageTurn.role,
                content: messageTurn.text,
              })),
            temperature: 0.5,
            maxTokens: 240,
            topP: 1,
            stream: false,
          },
          response: {
            content: turn.text,
            role: 'assistant',
            finishReason: 'stop',
            toolCalls: [],
          },
          usage: {
            promptTokens: 240,
            completionTokens: 95,
            totalTokens: 335,
            cost: 0.02,
          },
          performance: {
            latencyMs: 620 + index * 25,
            timeToFirstTokenMs: 180,
            tokensPerSecond: 18.2,
            requestId: `demo_llm_request_${sessionSeed.key}_${index + 1}`,
          },
          context: {
            userId: owner.id,
            orgId: team.id,
            traceId: `trace_${sessionSeed.key}_${index + 1}`,
            purpose: 'chat',
          },
          error: { occurred: false, retryCount: 0 },
          createdAt: addMinutes(turn.createdAt, 0),
          updatedAt: addMinutes(turn.createdAt, 0),
        });
      });
    }

    if (sessionSeed.key === 'nova_security_voice') {
      const sensitiveMessage = postgres.messages.find(
        (message) => message.id === 'demo_message_nova_security_voice_5',
      );
      if (sensitiveMessage) {
        postgres.redactionSpans.push({
          id: 'demo_redaction_nova_security_voice',
          messageId: sensitiveMessage.id,
          spans: [{ start: 87, end: 100, label: 'POLICY_REFERENCE' }],
          createdAt: addMinutes(sensitiveMessage.createdAt, 1),
        });
      }
    }
  }

  for (const seed of richSessionSeeds) {
    buildSessionArtifacts(seed, true);
  }

  for (const seed of simpleSessionSeeds) {
    buildSessionArtifacts(seed, false);
  }

  return { postgres, mongo };
}

function buildUserManagementData(planIdByKey) {
  const users = demoUsers.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    settings: buildUserSettings(user),
    isActive: true,
    createdAt: user.createdAt,
    updatedAt: user.lastSeen,
    lastSeen: user.lastSeen,
  }));

  const oauthAccounts = demoUsers.map((user, index) => ({
    id: `demo_oauth_${user.slug}`,
    provider: user.authProvider,
    providerId: user.authProviderId,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    accessToken: `demo_access_${index + 1}`,
    refreshToken: `demo_refresh_${index + 1}`,
    expiresAt: utc(2026, 3, 31, 12, 0),
    userId: user.id,
    createdAt: user.createdAt,
    updatedAt: user.lastSeen,
  }));

  const refreshTokens = demoUsers.map((user, index) => ({
    id: `demo_refresh_token_${user.slug}`,
    token: `demo_rt_${index + 1}_${user.slug}`,
    userId: user.id,
    expiresAt: utc(2026, 4, 1, 0, 0),
    createdAt: utc(2026, 3, 1, 9, 0),
  }));

  const teams = teamDefinitions.map((team) => ({
    id: team.id,
    name: team.name,
    slug: team.slug,
    isActive: true,
    availableTokens: team.subscription.allowance,
    usedTokens: team.subscription.used,
    billingEmail: team.billingEmail,
    billingAddress: team.billingAddress,
    metadata: {
      pendingSignupInvites: team.pendingSignupInvites,
      audit: {
        ownerUserId:
          team.memberships.find((membership) => membership.role === 'OWNER')
            ?.userId || null,
        createdByUserId:
          team.memberships.find((membership) => membership.role === 'OWNER')
            ?.userId || null,
        createdAt: team.createdAt.toISOString(),
        updatedByUserId:
          team.memberships.find((membership) => membership.role === 'OWNER')
            ?.userId || null,
        updatedAt: utc(2026, 3, 14, 12, 0).toISOString(),
        version: 3,
      },
      profile: {
        industry: team.industry,
        timezone: team.timezone,
        locale: team.locale,
      },
      preferences: {
        defaultColorMode: 'system',
        allowMemberInvites: true,
      },
      tags: team.tags,
      notes: team.notes,
    },
    createdAt: team.createdAt,
    updatedAt: utc(2026, 3, 14, 12, 0),
    deletedAt: null,
  }));

  const memberships = teamDefinitions.flatMap((team) =>
    team.memberships.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      teamId: team.id,
      role: membership.role,
      tokenLimit: membership.tokenLimit,
      isActive: true,
      invitedAt: addMinutes(team.createdAt, 5),
      acceptedAt: membership.acceptedAt,
      invitedByUserId:
        team.memberships.find((member) => member.role === 'OWNER')?.userId ||
        null,
    })),
  );

  const subscriptions = teamDefinitions.map((team) => ({
    id: team.subscription.id,
    teamId: team.id,
    planId: planIdByKey[team.subscription.planKey],
    interval: team.subscription.interval,
    limits: team.subscription.seats,
    isActive: true,
    currentPeriodStart: team.subscription.currentPeriodStart,
    currentPeriodEnd: team.subscription.currentPeriodEnd,
    cancelAtPeriodEnd: false,
    metadata: {
      audit: {
        createdByUserId:
          team.memberships.find((membership) => membership.role === 'OWNER')
            ?.userId || null,
        createdAt: team.createdAt.toISOString(),
        updatedByUserId:
          team.memberships.find((membership) => membership.role === 'OWNER')
            ?.userId || null,
        updatedAt: utc(2026, 3, 14, 12, 0).toISOString(),
        version: 2,
      },
      billing: {
        provider: 'demo-billing',
        externalSubscriptionId: `ext_${team.subscription.id}`,
        externalCustomerId: `cust_${team.id}`,
      },
      seating: {
        seats: team.subscription.seats,
      },
      notes: team.subscription.notes,
    },
    createdAt: team.createdAt,
    updatedAt: utc(2026, 3, 14, 12, 0),
    canceledAt: null,
  }));

  const tokenHistories = teamDefinitions.flatMap((team, index) => {
    const currentPeriodStart = team.subscription.currentPeriodStart;
    return [
      {
        id: `demo_token_history_${team.id}_current`,
        availableTokens: team.subscription.allowance,
        usedTokens: team.subscription.used,
        teamId: team.id,
        date: currentPeriodStart,
      },
      {
        id: `demo_token_history_${team.id}_previous`,
        availableTokens: team.subscription.allowance,
        usedTokens: Math.max(0, team.subscription.used - 2200 - index * 700),
        teamId: team.id,
        date: addDays(currentPeriodStart, -30),
      },
      {
        id: `demo_token_history_${team.id}_earlier`,
        availableTokens: team.subscription.allowance,
        usedTokens: Math.max(0, team.subscription.used - 4100 - index * 900),
        teamId: team.id,
        date: addDays(currentPeriodStart, -60),
      },
    ];
  });

  const coinBalances = teamDefinitions.map((team) => ({
    teamId: team.id,
    subscriptionId: team.subscription.id,
    periodKey: `${team.subscription.id}:${team.subscription.currentPeriodStart.getTime()}-${team.subscription.currentPeriodEnd.getTime()}`,
    allowance: team.subscription.allowance,
    reserved:
      team.id === 'demo_team_nova'
        ? 600
        : team.id === 'demo_team_helio'
          ? 1500
          : 300,
    usedActual: team.subscription.used,
    remaining: team.subscription.remaining,
    lastReservationId: `demo_reservation_${team.id}`,
    lastEventId: `demo_adjust_event_${team.id}`,
    lastRequestId: `demo_request_${team.id}`,
    createdAt: utc(2026, 3, 1, 0, 5),
    updatedAt: utc(2026, 3, 14, 12, 0),
  }));

  const coinLedgers = teamDefinitions.flatMap((team) => {
    const planId = planIdByKey[team.subscription.planKey];
    const periodKey = `${team.subscription.id}:${team.subscription.currentPeriodStart.getTime()}-${team.subscription.currentPeriodEnd.getTime()}`;
    const ownerId =
      team.memberships.find((membership) => membership.role === 'OWNER')
        ?.userId || team.memberships[0].userId;
    return [
      {
        teamId: team.id,
        userId: ownerId,
        subscriptionId: team.subscription.id,
        planId,
        periodKey,
        requestId: `demo_request_refill_${team.id}`,
        reservationId: `demo_refill_${team.id}`,
        type: 'REFILL',
        allowance: team.subscription.allowance,
        remainingAfter: team.subscription.allowance,
        createdAt: team.subscription.currentPeriodStart,
      },
      {
        teamId: team.id,
        userId: ownerId,
        subscriptionId: team.subscription.id,
        planId,
        periodKey,
        requestId: `demo_request_${team.id}`,
        reservationId: `demo_reservation_${team.id}`,
        type: 'RESERVE',
        estimatedCoins:
          team.id === 'demo_team_helio'
            ? 1800
            : team.id === 'demo_team_nova'
              ? 900
              : 450,
        sessionId:
          team.id === 'demo_team_helio'
            ? 'demo_session_helio_exec_video'
            : team.id === 'demo_team_nova'
              ? 'demo_session_nova_discovery'
              : 'demo_session_academy_lti',
        model: 'gpt-4o-mini',
        remainingAfter:
          team.subscription.remaining +
          (team.id === 'demo_team_helio' ? 240 : 120),
        createdAt: utc(2026, 3, 14, 9, 0),
      },
      {
        teamId: team.id,
        userId: ownerId,
        subscriptionId: team.subscription.id,
        planId,
        periodKey,
        requestId: `demo_request_${team.id}`,
        reservationId: `demo_reservation_${team.id}`,
        type: 'ADJUST',
        deltaCoins:
          team.id === 'demo_team_helio'
            ? -240
            : team.id === 'demo_team_nova'
              ? -120
              : -60,
        eventId: `demo_adjust_event_${team.id}`,
        sessionId:
          team.id === 'demo_team_helio'
            ? 'demo_session_helio_exec_video'
            : team.id === 'demo_team_nova'
              ? 'demo_session_nova_discovery'
              : 'demo_session_academy_lti',
        model: 'gpt-4o-mini',
        remainingAfter: team.subscription.remaining,
        createdAt: utc(2026, 3, 14, 9, 25),
      },
    ];
  });

  return {
    users,
    oauthAccounts,
    refreshTokens,
    teams,
    memberships,
    subscriptions,
    tokenHistories,
    coinBalances,
    coinLedgers,
    notifications: buildNotificationRecords(),
  };
}

async function purgeUserManagementData(
  userPrisma,
  userMongoConnection,
  skipMongo = false,
) {
  await userPrisma.refreshToken.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await userPrisma.oAuthAccount.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await userPrisma.tokenHistory.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await userPrisma.subscription.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await userPrisma.teamMembership.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await userPrisma.team.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await userPrisma.user.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });

  if (!skipMongo && userMongoConnection) {
    await Promise.all([
      userMongoConnection
        .collection('notifications')
        .deleteMany({ 'metadata.seedTag': DEMO_SEED_TAG }),
      userMongoConnection
        .collection('coin_balances')
        .deleteMany({ teamId: { $regex: `^${DEMO_PREFIX}` } }),
      userMongoConnection
        .collection('coin_ledgers')
        .deleteMany({ teamId: { $regex: `^${DEMO_PREFIX}` } }),
    ]);
  }
}

async function purgeSupportData(supportPrisma) {
  await supportPrisma.chat.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await supportPrisma.emailLog.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await supportPrisma.supportTicket.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await supportPrisma.fAQ.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await supportPrisma.user.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
}

async function purgeCrmData(crmPrisma) {
  await crmPrisma.integration.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
}

async function purgeAnalyticsData(analyticsPrisma) {
  await analyticsPrisma.reportExecution.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await analyticsPrisma.report.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await analyticsPrisma.widget.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await analyticsPrisma.dashboard.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await analyticsPrisma.statistic.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await analyticsPrisma.metric.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await analyticsPrisma.event.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await analyticsPrisma.performanceLog.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
}

async function purgeSimulationData(
  simulationPrisma,
  simulationMongoConnection,
  skipMongo = false,
) {
  await simulationPrisma.turnAssessmentLabel.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.assessmentSummary.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.assessmentRun.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.coachTip.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.scoreItem.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.scorecard.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.reportRequest.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.challengeParticipation.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.challenge.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.benchmark.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.evalArtifact.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.redactionSpan.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.ingestionJob.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.recording.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.transcript.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.callSession.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.mediaAsset.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.draftEmail.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.metric.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.event.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.toolCall.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.message.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.turn.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.iteration.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.sessionMember.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.session.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.scenario.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.persona.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.criterion.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.rubric.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.hintConfig.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await simulationPrisma.llmRoutingConfig.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });

  if (!skipMongo && simulationMongoConnection) {
    await Promise.all([
      simulationMongoConnection
        .collection('reportSnapshots')
        .deleteMany({ _id: { $regex: `^${DEMO_PREFIX}` } }),
      simulationMongoConnection
        .collection('assessment_reports')
        .deleteMany({ _id: { $regex: `^${DEMO_PREFIX}` } }),
      simulationMongoConnection
        .collection('hints')
        .deleteMany({ _id: { $regex: `^${DEMO_PREFIX}` } }),
      simulationMongoConnection
        .collection('eventLogs')
        .deleteMany({ _id: { $regex: `^${DEMO_PREFIX}` } }),
      simulationMongoConnection
        .collection('evalArtifactData')
        .deleteMany({ _id: { $regex: `^${DEMO_PREFIX}` } }),
      simulationMongoConnection
        .collection('llmTraces')
        .deleteMany({ _id: { $regex: `^${DEMO_PREFIX}` } }),
      simulationMongoConnection
        .collection('sessionInvitations')
        .deleteMany({ _id: { $regex: `^${DEMO_PREFIX}` } }),
      simulationMongoConnection
        .collection('enrichedTranscripts')
        .deleteMany({ assetId: { $regex: `^${DEMO_PREFIX}` } }),
    ]);
  }
}

async function purgeLtiData(ltiPrisma) {
  await ltiPrisma.ltiScore.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await ltiPrisma.ltiLineItem.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await ltiPrisma.ltiSession.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await ltiPrisma.ltiNonce.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await ltiPrisma.ltiDeployment.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
  await ltiPrisma.ltiPlatform.deleteMany({
    where: { id: { startsWith: DEMO_PREFIX } },
  });
}

async function createManyIfAny(model, data) {
  if (!data.length) return;
  await model.createMany({ data });
}

async function insertMongoIfAny(collection, docs) {
  if (!docs.length) return;
  await collection.insertMany(docs);
}

async function seedPlans(userPrisma) {
  const planIdByKey = {};

  for (const plan of planCatalog) {
    const saved = await userPrisma.plan.upsert({
      where: { name: plan.name },
      create: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        planLevel: plan.planLevel,
        maxCoins: plan.maxCoins,
        isActive: true,
      },
      update: {
        description: plan.description,
        planLevel: plan.planLevel,
        maxCoins: plan.maxCoins,
        isActive: true,
      },
    });
    planIdByKey[plan.key] = saved.id;
  }

  return planIdByKey;
}

async function main() {
  ensureEnvLoaded();
  const skipMongo =
    process.argv.includes('--skip-mongo') ||
    process.env.SEED_SKIP_MONGO === '1';
  const skipLti =
    process.argv.includes('--skip-lti') || process.env.SEED_SKIP_LTI === '1';

  if (!skipMongo) {
    const requiredMongoVars = ['MONGODB_URL', 'USER_MANAGEMENT_MONGODB_URL'];
    for (const envVar of requiredMongoVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable ${envVar}`);
      }
    }
  }

  let userPrisma;
  let simulationPrisma;
  let supportPrisma;
  let analyticsPrisma;
  let crmPrisma;
  let ltiPrisma;

  let userMongoConnection;
  let simulationMongoConnection;

  try {
    console.log('Connecting to databases...');
    [userPrisma, simulationPrisma, supportPrisma, analyticsPrisma, crmPrisma] =
      await Promise.all([
        connectPrismaClient(
          UserPrismaClient,
          'USER_DATABASE_URL',
          'USER_DIRECT_URL',
          'User DB',
        ),
        connectPrismaClient(
          SimulationPrismaClient,
          'SIMULATION_DATABASE_URL',
          'SIMULATION_DIRECT_URL',
          'Simulation DB',
        ),
        connectPrismaClient(
          SupportPrismaClient,
          'SUPPORT_DATABASE_URL',
          'SUPPORT_DIRECT_URL',
          'Support DB',
        ),
        connectPrismaClient(
          AnalyticsPrismaClient,
          'ANALYTICS_DATABASE_URL',
          'ANALYTICS_DIRECT_URL',
          'Analytics DB',
        ),
        connectPrismaClient(
          CrmPrismaClient,
          'CRM_DATABASE_URL',
          'CRM_DIRECT_URL',
          'CRM DB',
        ),
      ]);

    if (skipLti) {
      console.log('Skipping LTI connection by request.');
    } else {
      ltiPrisma = await connectOptionalPrismaClient(
        LtiPrismaClient,
        'LTI_DATABASE_URL',
        'LTI_DIRECT_URL',
        'LTI',
      );
    }

    if (!skipMongo) {
      userMongoConnection = await mongoose
        .createConnection(process.env.USER_MANAGEMENT_MONGODB_URL)
        .asPromise();
      simulationMongoConnection = await mongoose
        .createConnection(process.env.MONGODB_URL)
        .asPromise();
    } else {
      console.log('Skipping MongoDB connections by request.');
    }

    console.log('Building seed payload...');
    const simulationData = buildSimulationData();
    const supportData = buildSupportData();
    const crmData = buildCrmData();
    const analyticsData = buildAnalyticsData();
    const ltiData = ltiPrisma ? buildLtiData() : null;

    console.log('Removing previous demo data...');
    await purgeUserManagementData(userPrisma, userMongoConnection, skipMongo);
    await purgeSupportData(supportPrisma);
    await purgeCrmData(crmPrisma);
    await purgeAnalyticsData(analyticsPrisma);
    await purgeSimulationData(
      simulationPrisma,
      simulationMongoConnection,
      skipMongo,
    );

    let shouldSeedLti = Boolean(ltiPrisma);
    if (shouldSeedLti) {
      shouldSeedLti = await runOptionalPrismaSection('LTI demo data', () =>
        purgeLtiData(ltiPrisma),
      );
    }

    console.log('Seeding plan catalog...');
    const planIdByKey = await seedPlans(userPrisma);
    const userManagementData = buildUserManagementData(planIdByKey);

    console.log('Seeding user management data...');
    await createManyIfAny(userPrisma.user, userManagementData.users);
    await createManyIfAny(
      userPrisma.oAuthAccount,
      userManagementData.oauthAccounts,
    );
    await createManyIfAny(
      userPrisma.refreshToken,
      userManagementData.refreshTokens,
    );
    await createManyIfAny(userPrisma.team, userManagementData.teams);
    await createManyIfAny(
      userPrisma.teamMembership,
      userManagementData.memberships,
    );
    await createManyIfAny(
      userPrisma.subscription,
      userManagementData.subscriptions,
    );
    await createManyIfAny(
      userPrisma.tokenHistory,
      userManagementData.tokenHistories,
    );
    if (!skipMongo) {
      await insertMongoIfAny(
        userMongoConnection.collection('notifications'),
        userManagementData.notifications,
      );
      await insertMongoIfAny(
        userMongoConnection.collection('coin_balances'),
        userManagementData.coinBalances,
      );
      await insertMongoIfAny(
        userMongoConnection.collection('coin_ledgers'),
        userManagementData.coinLedgers,
      );
    }

    console.log('Seeding support data...');
    await createManyIfAny(supportPrisma.user, supportData.users);
    await createManyIfAny(supportPrisma.fAQ, supportData.faqs);
    await createManyIfAny(supportPrisma.chat, supportData.chats);
    await createManyIfAny(supportPrisma.chatMessage, supportData.chatMessages);
    await createManyIfAny(supportPrisma.emailLog, supportData.emailLogs);
    await createManyIfAny(supportPrisma.supportTicket, supportData.tickets);

    console.log('Seeding CRM data...');
    await createManyIfAny(crmPrisma.integration, crmData);

    console.log('Seeding analytics data...');
    await createManyIfAny(analyticsPrisma.dashboard, analyticsData.dashboards);
    await createManyIfAny(analyticsPrisma.widget, analyticsData.widgets);
    await createManyIfAny(analyticsPrisma.report, analyticsData.reports);
    await createManyIfAny(
      analyticsPrisma.reportExecution,
      analyticsData.reportExecutions,
    );
    await createManyIfAny(analyticsPrisma.metric, analyticsData.metrics);
    await createManyIfAny(analyticsPrisma.statistic, analyticsData.statistics);
    await createManyIfAny(analyticsPrisma.event, analyticsData.events);
    await createManyIfAny(
      analyticsPrisma.performanceLog,
      analyticsData.performanceLogs,
    );

    console.log('Seeding simulation data...');
    await createManyIfAny(
      simulationPrisma.llmRoutingConfig,
      simulationData.postgres.llmRoutingConfigs,
    );
    await createManyIfAny(
      simulationPrisma.hintConfig,
      simulationData.postgres.hintConfigs,
    );
    await createManyIfAny(
      simulationPrisma.scenario,
      simulationData.postgres.scenarios,
    );
    await createManyIfAny(
      simulationPrisma.persona,
      simulationData.postgres.personas,
    );
    await createManyIfAny(
      simulationPrisma.rubric,
      simulationData.postgres.rubrics,
    );
    await createManyIfAny(
      simulationPrisma.criterion,
      simulationData.postgres.criteria,
    );
    await createManyIfAny(
      simulationPrisma.session,
      simulationData.postgres.sessions,
    );
    await createManyIfAny(
      simulationPrisma.sessionMember,
      simulationData.postgres.sessionMembers,
    );
    await createManyIfAny(
      simulationPrisma.iteration,
      simulationData.postgres.iterations,
    );
    await createManyIfAny(simulationPrisma.turn, simulationData.postgres.turns);
    await createManyIfAny(
      simulationPrisma.message,
      simulationData.postgres.messages,
    );
    await createManyIfAny(
      simulationPrisma.toolCall,
      simulationData.postgres.toolCalls,
    );
    await createManyIfAny(
      simulationPrisma.event,
      simulationData.postgres.events,
    );
    await createManyIfAny(
      simulationPrisma.metric,
      simulationData.postgres.metrics,
    );
    await createManyIfAny(
      simulationPrisma.draftEmail,
      simulationData.postgres.draftEmails,
    );
    await createManyIfAny(
      simulationPrisma.mediaAsset,
      simulationData.postgres.mediaAssets,
    );
    await createManyIfAny(
      simulationPrisma.callSession,
      simulationData.postgres.callSessions,
    );
    await createManyIfAny(
      simulationPrisma.recording,
      simulationData.postgres.recordings,
    );
    await createManyIfAny(
      simulationPrisma.ingestionJob,
      simulationData.postgres.ingestionJobs,
    );
    await createManyIfAny(
      simulationPrisma.transcript,
      simulationData.postgres.transcripts,
    );
    await createManyIfAny(
      simulationPrisma.redactionSpan,
      simulationData.postgres.redactionSpans,
    );
    await createManyIfAny(
      simulationPrisma.evalArtifact,
      simulationData.postgres.evalArtifacts,
    );
    await createManyIfAny(
      simulationPrisma.benchmark,
      simulationData.postgres.benchmarks,
    );
    await createManyIfAny(
      simulationPrisma.scorecard,
      simulationData.postgres.scorecards,
    );
    await createManyIfAny(
      simulationPrisma.scoreItem,
      simulationData.postgres.scoreItems,
    );
    await createManyIfAny(
      simulationPrisma.coachTip,
      simulationData.postgres.coachTips,
    );
    await createManyIfAny(
      simulationPrisma.assessmentRun,
      simulationData.postgres.assessmentRuns,
    );
    await createManyIfAny(
      simulationPrisma.turnAssessmentLabel,
      simulationData.postgres.assessmentLabels,
    );
    await createManyIfAny(
      simulationPrisma.assessmentSummary,
      simulationData.postgres.assessmentSummaries,
    );
    await createManyIfAny(
      simulationPrisma.challenge,
      simulationData.postgres.challenges,
    );
    await createManyIfAny(
      simulationPrisma.challengeParticipation,
      simulationData.postgres.challengeParticipations,
    );
    await createManyIfAny(
      simulationPrisma.reportRequest,
      simulationData.postgres.reportRequests,
    );

    if (!skipMongo) {
      await insertMongoIfAny(
        simulationMongoConnection.collection('reportSnapshots'),
        simulationData.mongo.reportSnapshots,
      );
      await insertMongoIfAny(
        simulationMongoConnection.collection('assessment_reports'),
        simulationData.mongo.assessmentReports,
      );
      await insertMongoIfAny(
        simulationMongoConnection.collection('hints'),
        simulationData.mongo.hints,
      );
      await insertMongoIfAny(
        simulationMongoConnection.collection('eventLogs'),
        simulationData.mongo.eventLogs,
      );
      await insertMongoIfAny(
        simulationMongoConnection.collection('evalArtifactData'),
        simulationData.mongo.evalArtifactData,
      );
      await insertMongoIfAny(
        simulationMongoConnection.collection('llmTraces'),
        simulationData.mongo.llmTraces,
      );
      await insertMongoIfAny(
        simulationMongoConnection.collection('enrichedTranscripts'),
        simulationData.mongo.enrichedTranscripts,
      );
      await insertMongoIfAny(
        simulationMongoConnection.collection('sessionInvitations'),
        simulationData.mongo.sessionInvitations,
      );
    }

    if (shouldSeedLti) {
      console.log('Seeding LTI data...');
      shouldSeedLti = await runOptionalPrismaSection(
        'LTI demo data',
        async () => {
          await createManyIfAny(ltiPrisma.ltiPlatform, ltiData.platforms);
          await createManyIfAny(ltiPrisma.ltiDeployment, ltiData.deployments);
          await createManyIfAny(ltiPrisma.ltiNonce, ltiData.nonces);
          await createManyIfAny(ltiPrisma.ltiSession, ltiData.sessions);
          await createManyIfAny(ltiPrisma.ltiLineItem, ltiData.lineItems);
          await createManyIfAny(ltiPrisma.ltiScore, ltiData.scores);
        },
      );
    }

    console.log('Validating demo counts...');
    const [userCount, sessionCount, challengeCount, supportTicketCount] =
      await Promise.all([
        userPrisma.user.count({ where: { id: { startsWith: DEMO_PREFIX } } }),
        simulationPrisma.session.count({
          where: { id: { startsWith: DEMO_PREFIX } },
        }),
        simulationPrisma.challenge.count({
          where: { id: { startsWith: DEMO_PREFIX } },
        }),
        supportPrisma.supportTicket.count({
          where: { id: { startsWith: DEMO_PREFIX } },
        }),
      ]);

    console.log(`Demo users: ${userCount}`);
    console.log(`Demo sessions: ${sessionCount}`);
    console.log(`Demo challenges: ${challengeCount}`);
    console.log(`Demo support tickets: ${supportTicketCount}`);
    if (!shouldSeedLti) {
      console.log('LTI demo data was skipped.');
    }
    console.log('Demo seed completed successfully.');
  } finally {
    await Promise.allSettled([
      userPrisma ? userPrisma.$disconnect() : Promise.resolve(),
      simulationPrisma ? simulationPrisma.$disconnect() : Promise.resolve(),
      supportPrisma ? supportPrisma.$disconnect() : Promise.resolve(),
      analyticsPrisma ? analyticsPrisma.$disconnect() : Promise.resolve(),
      crmPrisma ? crmPrisma.$disconnect() : Promise.resolve(),
      ltiPrisma ? ltiPrisma.$disconnect() : Promise.resolve(),
      userMongoConnection ? userMongoConnection.close() : Promise.resolve(),
      simulationMongoConnection
        ? simulationMongoConnection.close()
        : Promise.resolve(),
    ]);
  }
}

main().catch((error) => {
  console.error('Demo seed failed.');
  console.error(error);
  process.exitCode = 1;
});
