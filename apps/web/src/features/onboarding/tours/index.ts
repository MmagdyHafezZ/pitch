import type { DriveStep } from 'driver.js'

export const homeTourSteps: DriveStep[] = [
  {
    element: '[data-tour-id="home-header"]',
    popover: {
      title: 'Your Dashboard',
      description:
        "This is your home screen. Get a quick snapshot of your team's activity, recent sessions, and key metrics at a glance.",
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="home-sessions"]',
    popover: {
      title: 'Recent Sessions',
      description:
        'Your most recent practice sessions appear here. Click any session to review performance, scores, and AI feedback.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="home-analytics"]',
    popover: {
      title: 'Analytics at a Glance',
      description:
        'Track your progress over time. Charts show trends in scores, talk time, and engagement metrics.',
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
        'Start here to launch a new practice session. Choose a scenario, configure your AI coach, and start practicing.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="sessions-list"]',
    popover: {
      title: 'All Your Sessions',
      description:
        'Browse all past and ongoing sessions. Filter by status, date, or team member to find what you need quickly.',
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
        'Deep-dive into performance data. Track individual and team progress, identify patterns, and measure coaching effectiveness.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour-id="analytics-charts"]',
    popover: {
      title: 'Performance Charts',
      description:
        'Visualize metrics over time. Compare sessions, filter by date range, and export data for reporting.',
      side: 'top',
      align: 'start',
    },
  },
]

export const teamConfigTourSteps: DriveStep[] = [
  {
    element: '[data-tour-id="team-members"]',
    popover: {
      title: 'Team Members',
      description: 'Manage your team here. View all members, their roles, and activity levels.',
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
]
