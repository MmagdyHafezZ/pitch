const STORAGE_KEY = 'pitch:team-invite-context'

export interface TeamInviteContext {
  teamId: string
  email?: string
}

export function readTeamInviteContextFromSearch(params: URLSearchParams): TeamInviteContext | null {
  const teamId = params.get('teamId')?.trim() ?? ''
  if (!teamId) return null
  const email = params.get('email')?.trim() || undefined
  return { teamId, email }
}

export function persistTeamInviteContext(context: TeamInviteContext): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context))
}

export function getTeamInviteContext(): TeamInviteContext | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<TeamInviteContext>
    if (!parsed.teamId || typeof parsed.teamId !== 'string') return null
    return {
      teamId: parsed.teamId,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
    }
  } catch {
    return null
  }
}

export function clearTeamInviteContext(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
