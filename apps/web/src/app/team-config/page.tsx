import { Suspense } from 'react'
import { TeamConfigPageClient } from './TeamConfigPageClient'

export default function TeamConfigPage() {
  return (
    <Suspense fallback={<div>Loading team configuration…</div>}>
      <TeamConfigPage />
    </Suspense>
  )
}
