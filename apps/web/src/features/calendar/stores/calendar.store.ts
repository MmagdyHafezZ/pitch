'use client'

import { create } from 'zustand'
import { CalendarService } from '../services/calendar.service'
import type { CalendarEvent, CalendarConnectionStatus } from '../types/calendar.types'

type CalendarState = {
  googleStatus: CalendarConnectionStatus | null
  microsoftStatus: CalendarConnectionStatus | null
  events: CalendarEvent[]
  suggestions: any[]
  loadingEvents: boolean
  loadingStatus: boolean
  error: string | null

  fetchStatuses: () => Promise<void>
  fetchUpcoming: (lookAheadDays?: number) => Promise<void>
  fetchSuggestions: () => Promise<void>
  acceptSuggestion: (sessionId: string) => Promise<void>
  dismissSuggestion: (sessionId: string) => Promise<void>
  connectGoogle: () => Promise<void>
  connectMicrosoft: () => Promise<void>
  disconnectGoogle: () => Promise<void>
  disconnectMicrosoft: () => Promise<void>
}

export const useCalendarStore = create<CalendarState>()((set, get) => ({
  googleStatus: null,
  microsoftStatus: null,
  events: [],
  suggestions: [],
  loadingEvents: false,
  loadingStatus: false,
  error: null,

  fetchStatuses: async () => {
    set({ loadingStatus: true, error: null })
    try {
      const [google, microsoft] = await Promise.allSettled([
        CalendarService.google.status(),
        CalendarService.microsoft.status(),
      ])
      set({
        googleStatus: google.status === 'fulfilled' ? google.value : null,
        microsoftStatus: microsoft.status === 'fulfilled' ? microsoft.value : null,
        loadingStatus: false,
      })
    } catch {
      set({ loadingStatus: false })
    }
  },

  fetchUpcoming: async (lookAheadDays = 7) => {
    set({ loadingEvents: true, error: null })
    try {
      const events = await CalendarService.upcoming(lookAheadDays)
      set({ events, loadingEvents: false })
    } catch (err) {
      set({
        loadingEvents: false,
        error: err instanceof Error ? err.message : 'Failed to load events',
      })
    }
  },

  fetchSuggestions: async () => {
    try {
      const suggestions = await CalendarService.suggestions.list()
      set({ suggestions })
    } catch {}
  },

  acceptSuggestion: async (sessionId: string) => {
    await CalendarService.suggestions.accept(sessionId)
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== sessionId),
    }))
  },

  dismissSuggestion: async (sessionId: string) => {
    await CalendarService.suggestions.dismiss(sessionId)
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== sessionId),
    }))
  },

  connectGoogle: async () => {
    const { authUrl } = await CalendarService.google.connect()
    window.location.href = authUrl
  },

  connectMicrosoft: async () => {
    const { authUrl } = await CalendarService.microsoft.connect()
    window.location.href = authUrl
  },

  disconnectGoogle: async () => {
    await CalendarService.google.disconnect()
    set({ googleStatus: { connected: false, provider: 'google', status: 'NOT_CONNECTED' } })
  },

  disconnectMicrosoft: async () => {
    await CalendarService.microsoft.disconnect()
    set({
      microsoftStatus: { connected: false, provider: 'microsoft', status: 'NOT_CONNECTED' },
    })
  },
}))
