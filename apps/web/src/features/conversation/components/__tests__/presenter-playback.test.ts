import { getPresenterPlaybackMode } from '../presenter-playback'

describe('presenter-playback', () => {
  it('prioritizes speaking while assistant audio is playing', () => {
    expect(
      getPresenterPlaybackMode({
        assistantSpeaking: true,
        isListening: true,
        isProcessing: true,
        interimTranscript: 'hello',
        sttCommitRemainingMs: 250,
      })
    ).toBe('speaking')
  })

  it('keeps Pablo in the listening loop while the mic is open for a user turn', () => {
    expect(
      getPresenterPlaybackMode({
        assistantSpeaking: false,
        isListening: true,
        isProcessing: false,
      })
    ).toBe('listening')
  })

  it('stays in the listening loop during interim speech and finalize gaps', () => {
    expect(
      getPresenterPlaybackMode({
        assistantSpeaking: false,
        isListening: false,
        isProcessing: true,
        interimTranscript: 'still talking',
      })
    ).toBe('listening')

    expect(
      getPresenterPlaybackMode({
        assistantSpeaking: false,
        isListening: false,
        isProcessing: true,
        sttCommitRemainingMs: 250,
      })
    ).toBe('listening')
  })

  it('returns to idle when the user turn is genuinely finished', () => {
    expect(
      getPresenterPlaybackMode({
        assistantSpeaking: false,
        isListening: false,
        isProcessing: true,
        interimTranscript: '   ',
        sttCommitRemainingMs: 0,
      })
    ).toBe('idle')
  })
})
