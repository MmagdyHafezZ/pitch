import { useQuery } from '@tanstack/react-query'
import { getTeams } from '../api/simulation.api'

export function useTeams() {
    return useQuery({
        queryKey: ['teams'],
        queryFn: getTeams,
    })
}
