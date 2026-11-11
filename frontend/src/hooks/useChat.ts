import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, sendChat, sendVoiceChat } from '../lib/api'
import { base64ToObjectUrl, transcodeToWav } from '../lib/audio'
import { createId, createThreadId, loadChat, saveChat } from '../lib/storage'
import type { CartItem, ChatMessage } from '../lib/types'

export function useChat() {
  const [savedChat] = useState(loadChat)
  const [threadId, setThreadId] = useState(
    () => savedChat?.threadId ?? createThreadId(),
  )
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => savedChat?.messages ?? [],
  )
  const [cart, setCart] = useState<CartItem[]>(() => savedChat?.cart ?? [])
  const [isLoading, setIsLoading] = useState(false)
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null)

  const requestSeq = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const audioUrlsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const urls = audioUrlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  useEffect(() => {
    if (isLoading) return
    saveChat({ threadId, messages, cart })
  }, [threadId, messages, cart, isLoading])

  const runRequest = useCallback(
    async (query: string) => {
      const seq = ++requestSeq.current
      const controller = new AbortController()
      const assistantId = createId()

      abortRef.current = controller
      setIsLoading(true)
      setMessages((previous) => [
        ...previous,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          status: 'loading',
          createdAt: Date.now(),
        },
      ])

      try {
        const response = await sendChat(query, threadId, controller.signal)
        if (seq !== requestSeq.current) return

        const answer =
          response.answer?.trim() ||
          "I couldn't put together an answer for that. Please try asking another way."

        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: answer,
                  products: response.used_context ?? [],
                  status: 'complete' as const,
                }
              : message,
          ),
        )

        if (Array.isArray(response.shopping_cart)) {
          setCart(response.shopping_cart)
        }
        setLastFailedQuery(null)
      } catch (error) {
        if (seq !== requestSeq.current) return

        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Something unexpected happened.'

        setMessages((previous) =>
          previous.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  status: 'error' as const,
                  error: message,
                }
              : item,
          ),
        )
        setLastFailedQuery(query)
      } finally {
        if (seq === requestSeq.current) {
          setIsLoading(false)
          abortRef.current = null
        }
      }
    },
    [threadId],
  )

  const sendMessage = useCallback(
    (text: string) => {
      const query = text.trim()
      if (!query || isLoading) return

      setMessages((previous) => [
        ...previous,
        {
          id: createId(),
          role: 'user',
          content: query,
          status: 'complete',
          createdAt: Date.now(),
        },
      ])

      void runRequest(query)
    },
    [isLoading, runRequest],
  )

  const sendVoice = useCallback(
    async (audio: Blob) => {
      if (isLoading) return

      const seq = ++requestSeq.current
      const controller = new AbortController()
      const userId = createId()
      const assistantId = createId()

      abortRef.current = controller
      setIsLoading(true)
      setLastFailedQuery(null)
      setMessages((previous) => [
        ...previous,
        {
          id: userId,
          role: 'user',
          content: '',
          modality: 'voice',
          status: 'loading',
          createdAt: Date.now(),
        },
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          status: 'loading',
          createdAt: Date.now(),
        },
      ])

      try {
        const wav = await transcodeToWav(audio)
        const response = await sendVoiceChat(wav, threadId, controller.signal)
        if (seq !== requestSeq.current) return

        const answer =
          response.answer?.trim() ||
          "I couldn't put together an answer for that. Please try asking another way."

        let audioUrl: string | undefined
        if (response.audio_base64) {
          const url = base64ToObjectUrl(
            response.audio_base64,
            response.audio_content_type || 'audio/mpeg',
          )
          if (url) {
            audioUrlsRef.current.add(url)
            audioUrl = url
          }
        }

        const transcript = response.transcript?.trim() || 'Voice message'

        setMessages((previous) =>
          previous.map((message) => {
            if (message.id === userId) {
              return {
                ...message,
                content: transcript,
                status: 'complete' as const,
              }
            }
            if (message.id === assistantId) {
              return {
                ...message,
                content: answer,
                products: response.used_context ?? [],
                audioUrl,
                status: 'complete' as const,
              }
            }
            return message
          }),
        )

        if (Array.isArray(response.shopping_cart)) {
          setCart(response.shopping_cart)
        }
      } catch (error) {
        if (seq !== requestSeq.current) return

        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Something unexpected happened.'

        setMessages((previous) =>
          previous.map((item) => {
            if (item.id === userId) {
              return {
                ...item,
                content: item.content || 'Voice message',
                status: 'complete' as const,
              }
            }
            if (item.id === assistantId) {
              return {
                ...item,
                status: 'error' as const,
                error: message,
              }
            }
            return item
          }),
        )
      } finally {
        if (seq === requestSeq.current) {
          setIsLoading(false)
          abortRef.current = null
        }
      }
    },
    [isLoading, threadId],
  )

  const retryLast = useCallback(() => {
    if (!lastFailedQuery || isLoading) return

    setMessages((previous) => {
      const next = [...previous]
      const last = next[next.length - 1]
      if (last?.role === 'assistant' && last.status === 'error') {
        next.pop()
      }
      return next
    })

    void runRequest(lastFailedQuery)
  }, [isLoading, lastFailedQuery, runRequest])

  const startNewChat = useCallback(() => {
    if (isLoading) return

    requestSeq.current += 1
    abortRef.current?.abort()
    abortRef.current = null

    audioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    audioUrlsRef.current.clear()

    setThreadId(createThreadId())
    setMessages([])
    setCart([])
    setLastFailedQuery(null)
    setIsLoading(false)
  }, [isLoading])

  return {
    threadId,
    messages,
    cart,
    isLoading,
    lastFailedQuery,
    sendMessage,
    sendVoice,
    retryLast,
    startNewChat,
  }
}
