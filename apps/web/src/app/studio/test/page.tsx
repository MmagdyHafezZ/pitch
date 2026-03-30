import { readFile } from 'fs/promises'
import path from 'path'
import VoiceLipSyncTest from '@/features/conversation/components/VoiceLipSyncTest'

export const dynamic = 'force-dynamic'

interface CharacterAlignmentPayload {
  characters?: string[]
  character_start_times_seconds?: number[]
  character_end_times_seconds?: number[]
}

interface ElevenLabsLipSyncFixture {
  audio_base64?: string
  alignment?: CharacterAlignmentPayload | null
  normalized_alignment?: CharacterAlignmentPayload | null
}

async function loadFixture() {
  const candidates = [
    path.resolve(process.cwd(), '../api/tmp/lip-sync-test.json'),
    path.resolve(process.cwd(), '../api/tmp/lip-sync-test-sarah.json'),
    path.resolve(process.cwd(), '../api/tmp/elevenlabs-lipsync/smoke-test.response.json'),
  ]

  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, 'utf8')
      return {
        fixture: JSON.parse(raw) as ElevenLabsLipSyncFixture,
        sourcePath: candidate,
        error: null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/ENOENT/i.test(message)) {
        return {
          fixture: null,
          sourcePath: candidate,
          error: `Failed to read fixture at ${candidate}: ${message}`,
        }
      }
    }
  }

  return {
    fixture: null,
    sourcePath: null,
    error:
      'Could not find a saved ElevenLabs lip-sync fixture in apps/api/tmp. Generate one and reload this page.',
  }
}

export default async function StudioLipSyncTestPage() {
  const { fixture, sourcePath, error } = await loadFixture()

  return (
    <VoiceLipSyncTest
      fixture={fixture}
      fixtureSourcePath={sourcePath}
      loadError={error}
      audioMimeType="audio/mpeg"
      modelPath="/models/Pablo.glb"
    />
  )
}
