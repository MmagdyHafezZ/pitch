import { create } from 'zustand'
import { api } from '@/lib/client'

type AdminStoreState = {
  isAdmin: boolean | null // null = not yet checked
  checking: boolean
  check: () => Promise<void>
  reset: () => void
}

export const useAdminStore = create<AdminStoreState>((set, get) => ({
  isAdmin: null,
  checking: false,

  check: async () => {
    // Skip if already checked or in-flight
    if (get().isAdmin !== null || get().checking) return
    set({ checking: true })
    try {
      await api.admin.check()
      set({ isAdmin: true, checking: false })
    } catch {
      set({ isAdmin: false, checking: false })
    }
  },

  reset: () => set({ isAdmin: null, checking: false }),
}))
