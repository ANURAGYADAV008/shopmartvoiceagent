import type { PersistedChat } from './types'

const STORAGE_KEY = 'shopsmart.chat.v1'

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createThreadId(): string {
  return createId()
}

export function loadChat(): PersistedChat | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as PersistedChat
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.threadId !== 'string' || !parsed.threadId) return null
    if (!Array.isArray(parsed.messages) || !Array.isArray(parsed.cart)) {
      return null
    }

    const messages = parsed.messages.map((message) =>
      message.status === 'loading'
        ? {
            ...message,
            status: 'error' as const,
            error:
              'This request was interrupted when the page was refreshed. Please try again.',
          }
        : message,
    )

    return { ...parsed, messages }
  } catch {
    return null
  }
}

export function saveChat(chat: PersistedChat): void {
  try {
    // Audio Blob URLs only live for the current page. Persisting them would
    // leave dead players in the transcript after a refresh.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(chat, (key, value) =>
        key === 'audioUrl' ? undefined : value,
      ),
    )
  } catch {
    // Storage can be unavailable in private browsing or when the quota is full.
  }
}

export function clearChat(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors.
  }
}
