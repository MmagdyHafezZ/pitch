import { useCallback, useMemo, useState } from 'react'

const DEFAULT_LOCALE = 'en'

const DEFAULT_LABELS: Record<string, string> = {
  'tabs.all': 'All',
  'tabs.favorites': 'Favorites',
  'tabs.archived': 'Archived',
  'tabs.created': 'Created',
  'tabs.shared': 'Shared',
  'tabs.myTeams': 'My Teams',
  'tabs.personal': 'Personal',
  'tabs.team': 'Team',
  'common.search': 'Search',
  'common.save': 'Save',
  'common.logout': 'Logout',
  'topbar.searchSessions': 'Search sessions',
  'topbar.searchTeams': 'Search teams',
  'topbar.searchSettings': 'Search settings',
  'topbar.createSession': 'Create Session',
  'topbar.startTour': 'Start tour',
  'topbar.notifications': 'Notifications',
  'topbar.account': 'Account',
  'topbar.markAllRead': 'Mark all as read',
  'topbar.noNotifications': 'No notifications yet.',
  'settings.language.title': 'Language',
  'settings.language.description': 'Choose your preferred app language.',
  'settings.language.platformLabel': 'Platform language',
  'settings.language.defaultSessionDescription': 'This language will be used by default.',
  'settings.language.saving': 'Saving...',
  'settings.language.saved': 'Saved',
}

const LOCALE_OPTIONS = [{ value: DEFAULT_LOCALE, nativeLabel: 'English' }]

export function useI18n() {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE)

  const translate = useCallback((key: string, params?: Record<string, string | number>) => {
    if (key === 'topbar.unreadCount' && params?.count !== undefined) {
      return `${params.count} unread`
    }

    return DEFAULT_LABELS[key] ?? key
  }, [])

  const localeOptions = useMemo(() => LOCALE_OPTIONS, [])

  return {
    t: translate,
    tp: translate,
    locale,
    setLocale: setLocaleState,
    localeOptions,
    isSavingLocale: false,
    localeSaveError: null as string | null,
  }
}
