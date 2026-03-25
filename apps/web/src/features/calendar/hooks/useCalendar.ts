'use client'

import { useEffect } from 'react'
import { useCalendarStore } from '../stores/calendar.store'

export function useCalendar() {
  const store = useCalendarStore()

  useEffect(() => {
    void store.fetchStatuses()
  }, [])

  return store
}
