'use client'

import { useEffect } from 'react'
import { useCalendarStore } from '../stores/calendar.store'

export function useCalendar() {
  const store = useCalendarStore()
  const fetchStatuses = useCalendarStore((state) => state.fetchStatuses)

  useEffect(() => {
    void fetchStatuses()
  }, [fetchStatuses])

  return store
}
