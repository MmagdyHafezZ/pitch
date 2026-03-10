import type { DriveStep } from 'driver.js'

export const homeTourSteps: DriveStep[] = [
  {
    element: '[data-tour-id="app-sidebar"]',
    popover: {
      title: 'Workspace Navigation',
      description:
        'Use this sidebar to move between Home, Sessions, Challenges, Analytics, and Team Configuration.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="app-topbar-controls"]',
    popover: {
      title: 'Quick Controls',
      description:
        'These controls give quick access to tour restart, language, notifications, and account actions.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="home-header"]',
    popover: {
      title: 'Dashboard Overview',
      description:
        'This header summarizes your momentum and gives quick actions to start a session or jump to your full session list.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="home-analytics"]',
    popover: {
      title: 'Performance Snapshot',
      description:
        'These KPI cards track total sessions, weekly completions, completion rate, and your current streak.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="home-stat-total"]',
    popover: {
      title: 'Total Sessions',
      description:
        'Use this to monitor all started sessions and quickly compare active vs completed work.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="home-stat-weekly"]',
    popover: {
      title: 'Weekly Completions',
      description:
        'This card highlights completion volume over the last 7 days so you can spot consistency changes.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="home-stat-completion"]',
    popover: {
      title: 'Completion Rate',
      description:
        'Track how often started sessions reach completion. This helps identify drop-off in practice flows.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="home-stat-streak"]',
    popover: {
      title: 'Practice Streak',
      description:
        'Your streak is based on consecutive active days. Keep this moving to reinforce learning momentum.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="home-activity-map"]',
    popover: {
      title: 'Activity Map',
      description:
        'The heatmap shows completed-session volume by day. Darker cells indicate higher activity.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="home-team-snapshot"]',
    popover: {
      title: 'Team Snapshot',
      description:
        'Review team-level participation and completion counts. Use this to spot where coaching support is needed.',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="home-momentum-chart"]',
    popover: {
      title: 'Session Momentum',
      description:
        'This trend compares started vs completed sessions over recent weeks and helps surface trajectory shifts.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="home-sessions"]',
    popover: {
      title: 'Recent Sessions',
      description:
        'Open recent sessions directly from here for quick review, then jump to the full list when needed.',
      side: 'top',
      align: 'start',
    },
  },
]

export const sessionsTourSteps: DriveStep[] = [
  {
    element: '[data-tour-id="sessions-create-btn"]',
    popover: {
      title: 'Create a Session',
      description:
        'Start a new practice flow from here. You can select scenario, persona, and coaching setup before launch.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="sessions-list"]',
    popover: {
      title: 'Session Workspace',
      description:
        'This area contains grouped session cards and supports filter/search controls from the top bar.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="sessions-groups"]',
    popover: {
      title: 'Grouped Session Lists',
      description:
        'Sessions are grouped by personal and team context. Expand or collapse groups to focus on a specific workspace.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="sessions-session-card"]',
    popover: {
      title: 'Session Cards',
      description:
        'Open any card to continue a practice, review transcripts, and check performance analytics.',
      side: 'top',
      align: 'start',
    },
  },
]

export const createSessionTourSteps: DriveStep[] = [
  {
    element: '[data-tour-id="create-session-hero"]',
    popover: {
      title: 'Session Builder',
      description:
        'This wizard guides you through all settings required to launch a high-quality pitch simulation.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="create-session-stepper"]',
    popover: {
      title: 'Step Navigation',
      description:
        'Progress through Basics, Scenario, Persona, AI Brain, CRM, Style, and Review before creating.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="create-session-content"]',
    popover: {
      title: 'Configuration Workspace',
      description:
        'Each step updates this panel so you can configure session details with immediate context.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="create-session-name"]',
    popover: {
      title: 'Session Naming',
      description:
        'Use a specific name that reflects objective or scenario so sessions remain easy to compare later.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="create-session-nav"]',
    popover: {
      title: 'Move Through Steps',
      description:
        'Use Back and Next to refine setup. In full tour mode, we will continue to the next workspace automatically.',
      side: 'top',
      align: 'start',
    },
  },
]

export const analyticsTourSteps: DriveStep[] = [
  {
    element: '[data-tour-id="analytics-dashboard"]',
    popover: {
      title: 'Analytics Dashboard',
      description:
        'This screen is your performance command center for personal and team-level analytics.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="analytics-kpis"]',
    popover: {
      title: 'KPI Summary',
      description:
        'Top cards summarize total sessions, average score, best score, and monthly activity.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="analytics-score-trend"]',
    popover: {
      title: 'Score Trend',
      description: 'Track average score over time to understand long-term skill progression.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="analytics-session-types"]',
    popover: {
      title: 'Session Type Mix',
      description: 'This chart shows how practice time is distributed across session formats.',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="analytics-competencies"]',
    popover: {
      title: 'Competency Breakdown',
      description:
        'Use this bar chart to identify strengths and weaker skills that need targeted practice.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="analytics-history"]',
    popover: {
      title: 'Session History',
      description:
        'Search, filter, sort, and open previous sessions for detailed performance review.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="analytics-team-kpis"]',
    popover: {
      title: 'Team KPI Summary',
      description:
        'On the Team tab, these metrics aggregate member activity and score performance.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="analytics-team-leaderboard"]',
    popover: {
      title: 'Team Leaderboard',
      description:
        'Compare average scores across team members to spot high performers and coaching opportunities.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="analytics-team-members"]',
    popover: {
      title: 'Member Cards',
      description:
        'Each card summarizes one teammate: session counts, average, best score, and recent work.',
      side: 'top',
      align: 'start',
    },
  },
]

export const teamConfigTourSteps: DriveStep[] = [
  {
    element: '[data-tour-id="team-config-header"]',
    popover: {
      title: 'Team Configuration',
      description:
        'This page manages team setup, member access, billing details, and plan subscription.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="team-config-stepper"]',
    popover: {
      title: 'Configuration Steps',
      description:
        'Use the stepper to move between profile, members, billing, and subscription sections.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="team-profile-form"]',
    popover: {
      title: 'Team Profile',
      description: 'Edit team name and billing email used across invites and organization records.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="team-members"]',
    popover: {
      title: 'Team Members',
      description:
        'Manage roster, roles, token limits, and invite status for everyone in your organization team.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="team-invite-btn"]',
    popover: {
      title: 'Invite Team Members',
      description:
        "Add new members to your team by sending them an invite. They'll get access based on the role you assign.",
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="team-billing-form"]',
    popover: {
      title: 'Billing Address',
      description: 'Maintain invoice and address details tied to this team account.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="team-subscription"]',
    popover: {
      title: 'Subscription Plans',
      description: 'Choose plans, interval, and review current subscription state for this team.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="team-config-nav"]',
    popover: {
      title: 'Step Navigation',
      description: 'Use Back and Next to move through the setup flow without leaving this page.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="team-create-hero"]',
    popover: {
      title: 'Create Team Header',
      description:
        'In create mode, this header explains setup and provides quick create/cancel actions.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="team-create-details"]',
    popover: {
      title: 'Create Team Details',
      description: 'Enter the team identity details before provisioning your workspace.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="team-create-billing"]',
    popover: {
      title: 'Create Billing Form',
      description: 'Provide optional billing address details during initial team creation.',
      side: 'top',
      align: 'start',
    },
  },
]

export const challengesTourSteps: DriveStep[] = [
  {
    element: '[data-tour-id="challenges-header"]',
    popover: {
      title: 'Challenges Hub',
      description: 'This screen lists public challenges your team can join for focused practice.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="challenges-refresh"]',
    popover: {
      title: 'Refresh Feed',
      description: 'Use refresh to pull the latest challenge inventory and participation data.',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="challenges-filters"]',
    popover: {
      title: 'Period and Difficulty Filters',
      description: 'Filter by challenge cadence and difficulty to focus on the right level.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="challenges-list"]',
    popover: {
      title: 'Challenge Sections',
      description:
        'Challenges are grouped by difficulty so you can compare available options quickly.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="challenge-card"]',
    popover: {
      title: 'Challenge Card',
      description:
        'Each card shows deadline, participants, and your status. Accept or continue directly from here.',
      side: 'top',
      align: 'start',
    },
  },
]
