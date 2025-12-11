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

export interface User {
    id: string
    email: string
    name: string
    avatar?: string | null
    isActive: boolean
}

export interface CreateSessionDto {
    title: string
    dueDate: string
    type: string
    tags: string[]
    assignedUserIds: string[]
    assignToSelf: boolean
    config: {
        multiTurnEnabled: boolean
        language: string
        accent: string
        tone: string
        speechRate: string
        difficulty: number
    }
}

export interface Team {
    id: string
    name: string
    slug: string
    isActive: boolean
    memberships: {
        role: string
        user: User
    }[]
}

export async function getSessions(): Promise<Session[]> {
    return apiRequest<Session[]>('/sessions')
}

export async function createSession(data: CreateSessionDto): Promise<Session> {
    return apiRequest<Session>('/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function getUsers(): Promise<User[]> {
    return apiRequest<User[]>('/users')
}

export async function getTeams(): Promise<Team[]> {
    return apiRequest<Team[]>('/teams')
}
