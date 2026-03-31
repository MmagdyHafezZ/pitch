import { pipeline, env } from '@huggingface/transformers'

// Use Origin Private File System for model caching (persists across sessions)
env.useBrowserCache = true
env.allowLocalModels = false

type WorkerMessage = { type: 'transcribe'; audio: Float32Array; sampleRate: number }

type WorkerResponse =
  | { type: 'loading'; progress: number; message: string }
  | { type: 'ready' }
  | { type: 'result'; text: string }
  | { type: 'error'; message: string }

let transcriber: Awaited<ReturnType<typeof pipeline>> | null = null
let isLoading = false

async function loadModel() {
  if (transcriber || isLoading) return
  isLoading = true

  try {
    const respond = (msg: WorkerResponse) => self.postMessage(msg)

    respond({ type: 'loading', progress: 0, message: 'Loading speech engine…' })

    transcriber = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', {
      dtype: 'q4',
      device: 'wasm',
      progress_callback: (progress: { progress?: number; status?: string }) => {
        if (progress.progress !== undefined) {
          respond({
            type: 'loading',
            progress: Math.round(progress.progress),
            message: `Loading speech engine… ${Math.round(progress.progress)}%`,
          })
        }
      },
    })

    respond({ type: 'ready' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load speech engine'
    self.postMessage({ type: 'error', message } satisfies WorkerResponse)
  } finally {
    isLoading = false
  }
}

async function transcribe(audio: Float32Array) {
  if (!transcriber) {
    self.postMessage({ type: 'error', message: 'Model not loaded' } satisfies WorkerResponse)
    return
  }

  try {
    const result = await transcriber(audio, {
      sampling_rate: 16000,
      return_timestamps: false,
    })

    const text = Array.isArray(result)
      ? ((result[0] as { text?: string })?.text ?? '')
      : ((result as { text?: string })?.text ?? '')

    self.postMessage({ type: 'result', text: text.trim() } satisfies WorkerResponse)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    self.postMessage({ type: 'error', message } satisfies WorkerResponse)
  }
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data

  if (type === 'transcribe') {
    if (!transcriber) {
      await loadModel()
    }
    await transcribe(event.data.audio)
  }
}

// Eagerly load model on worker creation
void loadModel()
