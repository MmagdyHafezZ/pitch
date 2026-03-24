'use client'

import { useQuery } from '@tanstack/react-query'
import { CalendarService } from '../services/calendar.service'
import type { CalendarEvent } from '../types/calendar.types'

export function useCalendarEvents(lookAheadDays = 7) {
  return useQuery<CalendarEvent[]>({
    queryKey: ['calendar', 'upcoming', lookAheadDays],
    queryFn: () => CalendarService.upcoming(lookAheadDays),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })
}

export function useCalendarSuggestions() {
  return useQuery({
    queryKey: ['calendar', 'suggestions'],
    queryFn: () => CalendarService.suggestions.list(),
    staleTime: 1000 * 60 * 2,
  })
}
