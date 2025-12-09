import { useQuery } from '@tanstack/react-query'
import { getSessions } from '../api/simulation.api'

export function useSessions() {
    return useQuery({
        queryKey: ['sessions'],
        queryFn: getSessions,
    })
}
