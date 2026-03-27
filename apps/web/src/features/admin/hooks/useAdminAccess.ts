'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth'
import { adminApi } from '../services/admin.service'

export function useAdminAccess() {
  const token = useAuthStore((state) => state.token)
  const userId = useAuthStore((state) => state.user?.id ?? null)

  const query = useQuery({
    queryKey: ['admin-access', 'me', userId],
    queryFn: () => adminApi.getMe(),
    enabled: Boolean(token && userId),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: token && userId ? 30_000 : false,
  })

  return {
    adminIdentity: query.data ?? null,
    isSystemAdmin: query.data?.isSystemAdmin === true,
    isCheckingAccess: Boolean(token) && (!userId || query.isLoading || query.isFetching),
    accessError: query.error,
    refetchAccess: query.refetch,
  }
}
