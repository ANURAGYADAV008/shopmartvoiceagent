import { useEffect, useRef } from 'react'
import type { ChatMessage, Product } from '../lib/types'
import { Composer } from './Composer'
import { EmptyState } from './EmptyState'
import { MessageBubble } from './MessageBubble'

interface ChatWorkspaceProps {
  messages: ChatMessage[]
  isLoading: boolean
  canRetry: boolean
  voiceAvailable: boolean
  onSend: (message: string) => void
  onVoice: (audio: Blob) => void
  onAddToCart: (product: Product) => void
  onRetry: () => void
}

export function ChatWorkspace({
  messages,
  isLoading,
  canRetry,
  voiceAvailable,
  onSend,
  onVoice,
  onAddToCart,
  onRetry,
}: ChatWorkspaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length, isLoading])

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-line/80 bg-surface/85 shadow-[0_30px_80px_-45px_rgba(52,42,29,0.45)] backdrop-blur-sm">
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-busy={isLoading}
        className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto px-4 sm:px-7"
      >
        {messages.length === 0 ? (
          <EmptyState onSuggestion={onSend} />
        ) : (
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 py-6 sm:gap-7 sm:py-8">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isLoading={isLoading}
                canRetry={canRetry}
                onAddToCart={onAddToCart}
                onRetry={onRetry}
              />
            ))}
          </div>
        )}
      </div>

      <Composer
        isLoading={isLoading}
        voiceAvailable={voiceAvailable}
        onSend={onSend}
        onVoice={onVoice}
      />
    </section>
  )
}
