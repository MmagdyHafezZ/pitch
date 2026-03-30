'use client'

import { create } from 'zustand'
import { api, queryClient } from '@/lib/client'

type BillingInterval = 'MONTH' | 'YEAR'

type PlanLike = {
  id: string
  name?: string
  description?: string | null
  planLevel?: string
  maxCoins?: number
  isActive?: boolean
}

type SubscriptionLike = {
  id: string
  teamId?: string
  planId?: string
  interval?: BillingInterval | string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
  plan?: PlanLike | null
}

type TeamConfigStore = {
  orgUsers: any[]
  orgUsersLoading: boolean
  orgUsersError: string | null

  plans: PlanLike[]
  plansLoading: boolean
  plansError: string | null

  subscriptionsByTeam: Record<string, SubscriptionLike | null>
  subscriptionLoadingByTeam: Record<string, boolean>
  subscriptionErrorByTeam: Record<string, string | null>

  fetchOrgUsers: () => Promise<any[]>
  fetchPlans: () => Promise<PlanLike[]>
  fetchSubscriptionByTeam: (teamId: string) => Promise<SubscriptionLike | null>
  loadSubscriptionPanelData: (teamId: string) => Promise<void>
  selectTeamPlan: (
    teamId: string,
    input: { planId: string; interval: BillingInterval }
  ) => Promise<SubscriptionLike>
}

const notFoundSubscriptionError =
  /not found|couldn'?t find a subscription|cannot get\s+\/api\/v\d+\/subscriptions\/teams\/|membership not found|team not found/i
const plansRouteMissingError = /cannot get\s+\/api\/v\d+\/plans/i

export const useTeamConfigStore = create<TeamConfigStore>()((set, get) => ({
  orgUsers: [],
  orgUsersLoading: false,
  orgUsersError: null,

  plans: [],
  plansLoading: false,
  plansError: null,

  subscriptionsByTeam: {},
  subscriptionLoadingByTeam: {},
  subscriptionErrorByTeam: {},

  fetchOrgUsers: async () => {
    set({ orgUsersLoading: true, orgUsersError: null })
    try {
      const users = await api.users.getAll()
      const normalized = Array.isArray(users) ? users : []
      set({ orgUsers: normalized, orgUsersLoading: false })
      return normalized
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load organization users'
      set({ orgUsersLoading: false, orgUsersError: message })
      throw error
    }
  },

  fetchPlans: async () => {
    set({ plansLoading: true, plansError: null })
    try {
      const plansResponse = await api.plans.getAll()
      const normalizedPlans = Array.isArray(plansResponse)
        ? plansResponse
        : Array.isArray((plansResponse as any)?.plans)
          ? (plansResponse as any).plans
          : []

      const sorted = normalizedPlans
        .filter(Boolean)
        .sort((a: PlanLike, b: PlanLike) =>
          String(a?.name ?? '').localeCompare(String(b?.name ?? ''))
        )

      set({ plans: sorted, plansLoading: false })
      return sorted
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error)
      if (plansRouteMissingError.test(rawMessage)) {
        set({ plans: [], plansLoading: false, plansError: null })
        return []
      }

      const fallbackMessage = error instanceof Error ? error.message : 'Failed to load plans'
      set({ plansLoading: false, plansError: fallbackMessage })
      throw error
    }
  },

  fetchSubscriptionByTeam: async (teamId: string) => {
    set((state) => ({
      subscriptionLoadingByTeam: { ...state.subscriptionLoadingByTeam, [teamId]: true },
      subscriptionErrorByTeam: { ...state.subscriptionErrorByTeam, [teamId]: null },
    }))

    try {
      const subscription = await api.subscriptions.getByTeamId(teamId).catch((err) => {
        const message = err instanceof Error ? err.message : String(err)
        if (notFoundSubscriptionError.test(message)) {
          return null
        }
        throw err
      })

      const normalized = (subscription as SubscriptionLike | null) ?? null
      set((state) => ({
        subscriptionsByTeam: { ...state.subscriptionsByTeam, [teamId]: normalized },
        subscriptionLoadingByTeam: { ...state.subscriptionLoadingByTeam, [teamId]: false },
      }))
      return normalized
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load subscription data'
      set((state) => ({
        subscriptionLoadingByTeam: { ...state.subscriptionLoadingByTeam, [teamId]: false },
        subscriptionErrorByTeam: { ...state.subscriptionErrorByTeam, [teamId]: message },
      }))
      throw error
    }
  },

  loadSubscriptionPanelData: async (teamId: string) => {
    await Promise.all([get().fetchPlans(), get().fetchSubscriptionByTeam(teamId)])
  },

  selectTeamPlan: async (teamId: string, input) => {
    set((state) => ({
      subscriptionLoadingByTeam: { ...state.subscriptionLoadingByTeam, [teamId]: true },
      subscriptionErrorByTeam: { ...state.subscriptionErrorByTeam, [teamId]: null },
    }))

    try {
      const current = get().subscriptionsByTeam[teamId]
      const currentPlanId = current?.planId ?? current?.plan?.id ?? null
      let nextSubscription: SubscriptionLike

      if (!current?.id) {
        nextSubscription = await api.subscriptions.create({
          teamId,
          planId: input.planId,
          interval: input.interval,
        })
      } else if (currentPlanId === input.planId) {
        nextSubscription = await api.subscriptions.update(current.id, {
          teamId,
          planId: input.planId,
          interval: input.interval,
        })
      } else {
        nextSubscription = await api.subscriptions.upgrade(current.id, {
          teamId,
          planId: input.planId,
          interval: input.interval,
        })
      }

      set((state) => ({
        subscriptionsByTeam: { ...state.subscriptionsByTeam, [teamId]: nextSubscription },
        subscriptionLoadingByTeam: { ...state.subscriptionLoadingByTeam, [teamId]: false },
      }))
      void queryClient.invalidateQueries({ queryKey: ['coins'] })

      return nextSubscription
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update subscription'
      set((state) => ({
        subscriptionLoadingByTeam: { ...state.subscriptionLoadingByTeam, [teamId]: false },
        subscriptionErrorByTeam: { ...state.subscriptionErrorByTeam, [teamId]: message },
      }))
      throw error
    }
  },
}))
