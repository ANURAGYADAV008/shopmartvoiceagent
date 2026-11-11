import type { ChatResponse, VoiceChatResponse, VoiceHealth } from './types'

const configuredBase = import.meta.env.VITE_API_URL?.trim()
export const API_BASE = configuredBase
  ? configuredBase.replace(/\/$/, '')
  : '/api'

export class ApiError extends Error {
  status?: number
  requestId?: string

  constructor(
    message: string,
    options?: { status?: number; requestId?: string },
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options?.status
    this.requestId = options?.requestId
  }
}

async function parseError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get('X-Request-ID') ?? undefined
  const unavailable = [502, 503, 504].includes(response.status)
  let message = unavailable
    ? 'The assistant API is temporarily unavailable. Please try again in a moment.'
    : `The assistant returned an error (${response.status}).`

  let bodyText = ''
  try {
    bodyText = await response.text()
  } catch {
    // Ignore unreadable bodies and keep the status-based fallback.
  }

  // Vercel Deployment Protection answers API calls with a login page instead
  // of JSON, so surface the real cause rather than a generic parse error.
  if (
    response.url.includes('vercel.com') ||
    bodyText.includes('Protected by Vercel Authentication') ||
    bodyText.includes('Log in to Vercel')
  ) {
    return new ApiError(
      'The backend deployment is protected by Vercel Authentication. Disable Deployment Protection for the backend project in Vercel, then try again.',
      { status: response.status, requestId },
    )
  }

  try {
    const body = JSON.parse(bodyText) as {
      detail?: string | Array<{ msg?: string }>
      message?: string
    }

    if (typeof body.detail === 'string') {
      message = body.detail
    } else if (Array.isArray(body.detail)) {
      message =
        body.detail
          .map((item) => item.msg)
          .filter(Boolean)
          .join(', ') || message
    } else if (typeof body.message === 'string') {
      message = body.message
    }
  } catch {
    // Keep the status-based fallback when the response is not JSON.
  }

  return new ApiError(message, { status: response.status, requestId })
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  signal: AbortSignal | undefined,
  timeoutMessage: string,
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 180_000)

  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })

    if (!response.ok) {
      throw await parseError(response)
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof ApiError) throw error

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(timeoutMessage)
    }

    if (error instanceof TypeError) {
      throw new ApiError(
        'Could not reach the assistant API. Check that the backend is running and try again.',
      )
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Something unexpected happened.',
    )
  } finally {
    window.clearTimeout(timeoutId)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

export async function sendChat(
  query: string,
  threadId: string,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  return fetchJson<ChatResponse>(
    `${API_BASE}/rag`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, thread_id: threadId }),
    },
    signal,
    'The request took too long. The assistant may still be processing it — wait a moment, then check your bag.',
  )
}

function audioExtension(contentType: string): string {
  if (contentType.includes('mp4')) return 'm4a'
  if (contentType.includes('ogg')) return 'ogg'
  if (contentType.includes('flac')) return 'flac'
  if (contentType.includes('aac')) return 'aac'
  if (contentType.includes('wav')) return 'wav'
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3'
  return 'wav'
}

export async function sendVoiceChat(
  audio: Blob,
  threadId: string,
  signal?: AbortSignal,
): Promise<VoiceChatResponse> {
  const form = new FormData()
  form.append('file', audio, `voice.${audioExtension(audio.type)}`)
  form.append('thread_id', threadId)
  form.append('speak', 'true')

  return fetchJson<VoiceChatResponse>(
    `${API_BASE}/voice/chat`,
    { method: 'POST', body: form },
    signal,
    'Voice processing took too long. Please try a shorter question.',
  )
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!response.ok) return false

    // A protected deployment redirects to the Vercel login page, which still
    // returns HTTP 200. Require the API's JSON health payload instead.
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) return false

    const body = (await response.json()) as { status?: string }
    return body.status === 'ok'
  } catch {
    return false
  }
}

export async function checkVoiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/voice/health`, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!response.ok) return false

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) return false

    const body = (await response.json()) as VoiceHealth
    return body.configured === true && body.status === 'ok'
  } catch {
    return false
  }
}
