import { apiRequest } from '@/lib/client'

export interface Session {
    id: string
    title: string
    status: string
    date: string
    tags?: string[]
    description?: string
    score?: number
}

export async function getSessions(): Promise<Session[]> {
    return apiRequest<Session[]>('/sessions')
}
