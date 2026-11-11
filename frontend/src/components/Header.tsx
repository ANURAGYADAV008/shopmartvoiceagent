import clsx from 'clsx'
import { Plus, ShoppingBag } from 'lucide-react'
import type { ApiStatus } from '../lib/types'

interface HeaderProps {
  cartItems: number
  apiStatus: ApiStatus
  canStartNewChat: boolean
  onOpenCart: () => void
  onNewChat: () => void
}

const statusStyles = {
  checking: {
    dot: 'bg-amber-400 animate-pulse',
    text: 'Checking',
    className: 'text-muted',
    title: 'Checking the backend connection',
  },
  online: {
    dot: 'bg-emerald-500',
    text: 'API online',
    className: 'text-emerald-700',
    title: 'Connected to the FastAPI backend',
  },
  offline: {
    dot: 'bg-red-500',
    text: 'API offline',
    className: 'text-red-600',
    title: 'The assistant API is not reachable.',
  },
} satisfies Record<
  ApiStatus,
  { dot: string; text: string; className: string; title: string }
>

export function Header({
  cartItems,
  apiStatus,
  canStartNewChat,
  onOpenCart,
  onNewChat,
}: HeaderProps) {
  const status = statusStyles[apiStatus]

  return (
    <header className="relative z-20 shrink-0 border-b border-line/60 bg-canvas/70 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] w-full max-w-[1120px] items-center justify-between px-4 sm:h-[76px] sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-forest text-[#fbf7ef] shadow-[0_10px_24px_-14px_rgba(35,53,43,0.9)]">
            <ShoppingBag size={18} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink">
                ShopSmart
              </span>
              <span className="hidden rounded-full bg-accent-soft px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-accent-dark sm:inline">
                Beta
              </span>
            </div>
            <p className="hidden text-[10.5px] tracking-[0.01em] text-muted sm:block">
              AI electronics assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span
            title={status.title}
            aria-live="polite"
            className="mr-1 flex items-center gap-1.5 rounded-full border border-line/70 bg-surface/65 px-2.5 py-1.5 text-[10px] font-medium"
          >
            <span
              aria-hidden="true"
              className={clsx('size-1.5 rounded-full', status.dot)}
            />
            <span className={clsx('hidden sm:inline', status.className)}>
              {status.text}
            </span>
          </span>

          <button
            type="button"
            onClick={onNewChat}
            disabled={!canStartNewChat}
            title={
              canStartNewChat
                ? 'Start a new chat and bag'
                : 'Send a message to start a new chat'
            }
            aria-label="Start a new chat"
            className="flex size-9 items-center justify-center rounded-full border border-transparent text-muted transition hover:border-line/70 hover:bg-surface/70 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Plus size={17} strokeWidth={1.8} />
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`Open bag with ${cartItems} items`}
            className="group flex items-center gap-2 rounded-full border border-line/80 bg-surface/80 py-2 pl-2.5 pr-2.5 text-[11.5px] font-semibold text-ink shadow-[0_4px_14px_-10px_rgba(52,42,29,0.35)] transition hover:-translate-y-px hover:border-ink/15 hover:bg-white hover:shadow-[0_8px_20px_-14px_rgba(52,42,29,0.45)] sm:pl-3 sm:pr-3"
          >
            <span className="relative">
              <ShoppingBag
                size={16}
                strokeWidth={1.8}
                className="text-ink/80"
              />
              {cartItems > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex min-w-[13px] items-center justify-center rounded-full bg-accent px-0.5 text-[8px] font-bold leading-[13px] text-white">
                  {cartItems > 99 ? '99+' : cartItems}
                </span>
              )}
            </span>
            <span className="hidden sm:inline">Bag</span>
          </button>
        </div>
      </div>
    </header>
  )
}
