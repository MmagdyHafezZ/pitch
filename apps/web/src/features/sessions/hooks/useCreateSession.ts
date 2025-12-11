import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSession, CreateSessionDto } from '../api/simulation.api'

export function useCreateSession() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: CreateSessionDto) => createSession(data),
        onSuccess: () => {
            // Invalidate sessions query to refetch the list
            queryClient.invalidateQueries({ queryKey: ['sessions'] })
        },
    })
}
