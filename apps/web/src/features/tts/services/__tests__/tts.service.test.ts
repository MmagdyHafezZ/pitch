import { TtsService } from '../tts.service'
import { api } from '@/lib/client'

jest.mock('@/lib/client', () => ({
  api: {
    tts: {
      listProviders: jest.fn(),
      getVoices: jest.fn(),
      speak: jest.fn(),
    },
  },
}))

const mocked = api.tts as jest.Mocked<typeof api.tts>

beforeEach(() => jest.clearAllMocks())

describe('TtsService', () => {
  it('listProviders delegates to api.tts.listProviders', async () => {
    const providers = [{ name: 'openai', voices: ['alloy'] }]
    mocked.listProviders.mockResolvedValue(providers as any)

    const result = await TtsService.listProviders()
    expect(mocked.listProviders).toHaveBeenCalled()
    expect(result).toEqual(providers)
  })

  it('getVoices delegates with provider name', async () => {
    const response = { provider: 'openai', voices: ['alloy', 'ash'] }
    mocked.getVoices.mockResolvedValue(response as any)

    const result = await TtsService.getVoices('openai')
    expect(mocked.getVoices).toHaveBeenCalledWith('openai')
    expect(result).toEqual(response)
  })

  it('speak delegates with request and returns Blob', async () => {
    const blob = new Blob(['audio'], { type: 'audio/mp3' })
    mocked.speak.mockResolvedValue(blob)

    const result = await TtsService.speak({
      text: 'Hello',
      provider: 'openai',
      voice: 'alloy',
      model: 'tts-1',
    })
    expect(mocked.speak).toHaveBeenCalledWith({
      text: 'Hello',
      provider: 'openai',
      voice: 'alloy',
      model: 'tts-1',
    })
    expect(result).toBe(blob)
  })

  it('propagates errors from the api layer', async () => {
    mocked.listProviders.mockRejectedValue(new Error('Service unavailable'))
    await expect(TtsService.listProviders()).rejects.toThrow('Service unavailable')
  })
})
