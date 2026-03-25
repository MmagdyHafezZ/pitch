import { api } from '@/lib/client'
import type { CalendarEvent, CalendarConnectionStatus } from '../types/calendar.types'

export const CalendarService = {
  google: {
    connect: () => api.calendar.google.connect(),
    status: () => api.calendar.google.status() as Promise<CalendarConnectionStatus>,
    disconnect: () => api.calendar.google.disconnect(),
    events: (params?: { from?: string; to?: string; maxResults?: number }) =>
      api.calendar.google.events(params) as Promise<CalendarEvent[]>,
  },
  microsoft: {
    connect: () => api.calendar.microsoft.connect(),
    status: () => api.calendar.microsoft.status() as Promise<CalendarConnectionStatus>,
    disconnect: () => api.calendar.microsoft.disconnect(),
    events: (params?: { from?: string; to?: string; maxResults?: number }) =>
      api.calendar.microsoft.events(params) as Promise<CalendarEvent[]>,
  },
  upcoming: (lookAheadDays?: number) =>
    api.calendar.upcoming(lookAheadDays) as Promise<CalendarEvent[]>,
  suggestions: {
    list: () => api.calendar.suggestions.list() as Promise<any[]>,
    accept: (sessionId: string) => api.calendar.suggestions.accept(sessionId),
    dismiss: (sessionId: string) => api.calendar.suggestions.dismiss(sessionId),
  },
}
