import clsx from 'clsx'
import { ArrowLeft, Loader2, ShoppingBag, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import {
  cartCount,
  cartCurrency,
  cartSubtotal,
  formatPrice,
  productTitle,
} from '../lib/format'
import type { CartItem } from '../lib/types'
import { ProductImage } from './ProductImage'

interface CartDrawerProps {
  open: boolean
  items: CartItem[]
  productMeta: Map<string, string>
  isLoading: boolean
  onClose: () => void
  onBrowse: () => void
}

function itemTitle(item: CartItem, productMeta: Map<string, string>): string {
  const description = productMeta.get(item.product_image_url)
  if (description) return productTitle(description)
  if (item.product_id) return `Product ${item.product_id.slice(0, 10)}`
  return 'Catalog item'
}

export function CartDrawer({
  open,
  items,
  productMeta,
  isLoading,
  onClose,
  onBrowse,
}: CartDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const quantity = cartCount(items)
  const subtotal = cartSubtotal(items)
  const currency = cartCurrency(items)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    const focusTimer = window.setTimeout(
      () => closeButtonRef.current?.focus(),
      250,
    )

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      window.clearTimeout(focusTimer)
    }
  }, [open, onClose])

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={clsx(
          'absolute inset-0 bg-[#141b17]/30 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="bag-title"
        className={clsx(
          'absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col border-l border-line/80 bg-[#fbf8f2] shadow-[-30px_0_80px_-40px_rgba(20,27,23,0.5)] transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-line/70 px-5 pb-4 pt-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-forest text-[#fbf7ef]">
                <ShoppingBag size={15} strokeWidth={1.8} />
              </span>
              <h2
                id="bag-title"
                className="text-[15px] font-semibold tracking-[-0.01em] text-ink"
              >
                Your bag
              </h2>
              <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-accent-dark">
                {quantity}
              </span>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 pl-10 text-[10.5px] text-muted">
              {isLoading && (
                <Loader2 size={10} className="animate-spin text-accent" />
              )}
              {isLoading
                ? 'Updating your bag…'
                : 'Items synced with this conversation'}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close bag"
            className="flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-[22px] border border-line/80 bg-white text-muted/50 shadow-[0_12px_30px_-24px_rgba(52,42,29,0.5)]">
              <ShoppingBag size={26} strokeWidth={1.4} />
            </div>
            <p className="mt-5 text-[14px] font-semibold text-ink">
              Your bag is empty
            </p>
            <p className="mt-1.5 max-w-[240px] text-[11.5px] leading-relaxed text-muted">
              Ask ShopSmart to add a product and it will appear here
              automatically.
            </p>
            <button
              type="button"
              onClick={onBrowse}
              className="mt-5 flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-[11.5px] font-semibold text-[#fbf7ef] transition hover:bg-[#16251d]"
            >
              <ArrowLeft size={12} />
              Find something
            </button>
          </div>
        ) : (
          <>
            <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {items.map((item, index) => {
                const title = itemTitle(item, productMeta)
                const unitPrice = formatPrice(item.price, item.currency)
                const lineTotal =
                  item.total_price ??
                  (item.price ?? 0) * (item.quantity || 0)

                return (
                  <li
                    key={`${item.product_id ?? 'item'}-${index}`}
                    className="flex gap-3 border-b border-line/60 py-4 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <div className="size-[76px] shrink-0 overflow-hidden rounded-2xl border border-line/60 bg-[#f4efe6] p-1.5">
                      <ProductImage
                        src={item.product_image_url}
                        alt={title}
                        iconSize={22}
                      />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="line-clamp-2 text-[12px] font-medium leading-[1.45] text-ink">
                        {title}
                      </h3>

                      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full border border-line/80 bg-white px-2 py-0.5 text-[9.5px] font-medium text-muted">
                            Qty {item.quantity}
                          </span>
                          <span className="text-[10px] text-muted/75">
                            {unitPrice} each
                          </span>
                        </div>
                        <span className="shrink-0 text-[12px] font-semibold text-ink">
                          {formatPrice(lineTotal, item.currency)}
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="shrink-0 border-t border-line/70 px-5 pb-5 pt-4">
              <div className="rounded-2xl bg-forest px-4 py-3.5 text-[#fbf7ef]">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] text-white/65">Subtotal</span>
                  <span className="text-[16px] font-semibold tracking-[-0.02em]">
                    {formatPrice(subtotal, currency)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-white/45">
                  <span>{quantity} items</span>
                  <span>Taxes at checkout</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onBrowse}
                className="mt-3 w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-[12px] font-semibold text-ink transition hover:bg-canvas"
              >
                Continue shopping
              </button>
              <p className="mt-2 text-center text-[9.5px] text-muted/60">
                Checkout will be available in a later version.
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
