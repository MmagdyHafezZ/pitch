import { TextDecoder, TextEncoder } from 'util'
import { ReadableStream, TransformStream, WritableStream } from 'stream/web'

if (typeof globalThis.Response === 'undefined') {
  // Defer to undici when running inside a Node-based Jest environment
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const undici = require('undici')

  globalThis.fetch = globalThis.fetch ?? undici.fetch
  globalThis.Headers = globalThis.Headers ?? undici.Headers
  globalThis.Request = globalThis.Request ?? undici.Request
  globalThis.Response = globalThis.Response ?? undici.Response

  if (!globalThis.FormData && undici.FormData) {
    globalThis.FormData = undici.FormData
  }

  if (!globalThis.File && undici.File) {
    globalThis.File = undici.File
  }
}

if (typeof globalThis.BroadcastChannel === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BroadcastChannel } = require('worker_threads')
    if (BroadcastChannel) {
      globalThis.BroadcastChannel = BroadcastChannel
    }
  } catch (error) {
    // Skip when BroadcastChannel is unavailable (older Node releases)
  }
}

if (!globalThis.TextEncoder) {
  // @ts-expect-error - assigning Node TextEncoder to global scope for Jest
  globalThis.TextEncoder = TextEncoder
}

if (!globalThis.TextDecoder) {
  // @ts-expect-error - assigning Node TextDecoder to global scope for Jest
  globalThis.TextDecoder = TextDecoder
}

if (!globalThis.TransformStream) {
  // @ts-expect-error - assigning Node TransformStream to global scope for Jest
  globalThis.TransformStream = TransformStream
}

if (!globalThis.ReadableStream) {
  // @ts-expect-error - assigning Node ReadableStream to global scope for Jest
  globalThis.ReadableStream = ReadableStream
}

if (!globalThis.WritableStream) {
  // @ts-expect-error - assigning Node WritableStream to global scope for Jest
  globalThis.WritableStream = WritableStream
}
