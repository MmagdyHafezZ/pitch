'use client'

type CoachChatWidgetProps = {
  context?: {
    page?: string
    sessionId?: string
    recentTurns?: Array<{
      role: string
      text: string
    }>
  }
}

export function CoachChatWidget(_props: CoachChatWidgetProps) {
  return null
}
