import clsx from 'clsx'
import { Check, Copy, Mic, RotateCcw, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ChatMessage, Product } from '../lib/types'
import { AudioPlayer } from './AudioPlayer'
import { Markdown } from './Markdown'
import { ProductCard } from './ProductCard'
import { ThinkingIndicator } from './ThinkingIndicator'

interface MessageBubbleProps {
  message: ChatMessage
  isLoading: boolean
  canRetry: boolean
  onAddToCart: (product: Product) => void
  onRetry: () => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard access may be blocked by the browser.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="mt-2.5 flex items-center gap-1.5 rounded-full px-2 py-1 text-[10.5px] font-medium text-muted/80 transition hover:bg-ink/5 hover:text-ink"
      aria-label={copied ? 'Copied' : 'Copy answer'}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function MessageBubble({
  message,
  isLoading,
  canRetry,
  onAddToCart,
  onRetry,
}: MessageBubbleProps) {
  const products = useMemo(() => {
    const seen = new Set<string>()
    return (message.products ?? []).filter((product) => {
      const key = product.image_url || product.description
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [message.products])

  if (message.role === 'user') {
    const isVoice = message.modality === 'voice'

    return (
      <div className="animate-fade-up flex justify-end">
        <div className="max-w-[88%] whitespace-pre-wrap rounded-[21px] rounded-br-md bg-forest px-4 py-2.5 text-[13.5px] leading-relaxed text-[#faf6ed] shadow-[0_8px_24px_-18px_rgba(35,53,43,0.8)] sm:max-w-[78%]">
          {isVoice && (
            <span className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#faf6ed]/55">
              <Mic size={10} />
              Voice
            </span>
          )}
          <span
            className={clsx(
              !message.content && 'animate-pulse text-[#faf6ed]/65',
            )}
          >
            {message.content || (isVoice ? 'Transcribing your voice…' : '')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-up flex items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-forest text-[#fbf7ef] shadow-[0_6px_16px_-10px_rgba(35,53,43,0.8)]">
        <Sparkles size={14} strokeWidth={1.8} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            ShopSmart
          </span>
          {message.status === 'loading' && (
            <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-accent-dark">
              Working
            </span>
          )}
        </div>

        {message.status === 'loading' && <ThinkingIndicator />}

        {message.status === 'error' && (
          <div className="max-w-lg rounded-2xl border border-[#e8c0b2] bg-[#fdf1ec] p-4">
            <p className="text-[13px] font-semibold text-[#8e351c]">
              I couldn&apos;t finish that request.
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#8e351c]/80">
              {message.error}
            </p>
            {canRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={isLoading}
                className="mt-3 flex items-center gap-1.5 rounded-full bg-[#8e351c] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#742a15] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw size={12} />
                Try again
              </button>
            )}
          </div>
        )}

        {message.status === 'complete' && message.content && (
          <Markdown>{message.content}</Markdown>
        )}

        {message.status === 'complete' && products.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                Products in this answer
              </span>
              <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-accent-dark">
                {products.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
              {products.map((product, index) => (
                <ProductCard
                  key={`${product.image_url}-${index}`}
                  product={product}
                  onAdd={onAddToCart}
                  disabled={isLoading}
                />
              ))}
            </div>
          </div>
        )}

        {message.status === 'complete' && message.audioUrl && (
          <AudioPlayer src={message.audioUrl} />
        )}

        {message.status === 'complete' && message.content && (
          <CopyButton text={message.content} />
        )}
      </div>
    </div>
  )
}
