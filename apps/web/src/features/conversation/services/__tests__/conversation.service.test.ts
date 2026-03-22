import { resolveConversationWsUrl } from '../conversation.service'

describe('resolveConversationWsUrl', () => {
  it('prefers an explicit websocket url when configured', () => {
    expect(resolveConversationWsUrl('https://ws.pitch.test', 'https://api.pitch.test/api/v1')).toBe(
      'https://ws.pitch.test'
    )
  })

  it('derives the websocket origin from the api url when no websocket url is set', () => {
    expect(resolveConversationWsUrl(undefined, 'https://api.pitch.test/api/v1')).toBe(
      'https://api.pitch.test'
    )
  })

  it('falls back to localhost when the api url cannot be parsed', () => {
    expect(resolveConversationWsUrl(undefined, 'not a url')).toBe('http://localhost:8000')
  })
})
