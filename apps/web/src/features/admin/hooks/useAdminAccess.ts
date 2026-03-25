'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth'
import { adminApi } from '../services/admin.service'

export function useAdminAccess() {
  const token = useAuthStore((state) => state.token)

  const query = useQuery({
    queryKey: ['admin-access', 'me'],
    queryFn: () => adminApi.getMe(),
    enabled: Boolean(token),
    retry: false,
    staleTime: 1000 * 60 * 5,
  })

  return {
    adminIdentity: query.data ?? null,
    isSystemAdmin: query.data?.isSystemAdmin === true,
    isCheckingAccess: query.isLoading || query.isFetching,
    accessError: query.error,
    refetchAccess: query.refetch,
  }
}
