export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startTime: string
  endTime: string
  attendees: { email: string; name?: string; self?: boolean }[]
  location?: string
  meetingUrl?: string
  provider: 'google' | 'microsoft'
  isAllDay: boolean
  status: 'confirmed' | 'tentative' | 'cancelled'
  organizerEmail?: string
  htmlLink?: string
}

export interface CalendarConnectionStatus {
  connected: boolean
  provider: 'google' | 'microsoft'
  status?: string
  providerEmail?: string
  updatedAt?: string
}

export type CalendarMode = 'auto' | 'suggest' | 'off'

export interface CalendarSettings {
  mode?: CalendarMode
  lookAheadDays?: number
  defaultSessionType?: 'text' | 'voice' | 'video' | 'phone'
  excludedCalendarIds?: string[]
  lastSyncAt?: string
}
