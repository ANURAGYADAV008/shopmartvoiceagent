import { ShoppingBag } from 'lucide-react'
import { formatPrice, productTitle } from '../lib/format'
import type { Product } from '../lib/types'
import { ProductImage } from './ProductImage'

interface ProductCardProps {
  product: Product
  onAdd: (product: Product) => void
  disabled?: boolean
}

export function ProductCard({ product, onAdd, disabled }: ProductCardProps) {
  const title = productTitle(product.description)

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-line/80 bg-white p-2.5 shadow-[0_1px_0_rgba(29,31,28,0.02)] transition duration-200 hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-[0_12px_28px_-18px_rgba(59,48,35,0.4)]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[13px] bg-[#f5f0e7] p-3">
        <ProductImage
          src={product.image_url}
          alt={title}
          iconSize={30}
          className="transition duration-300 group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex flex-1 flex-col px-0.5 pt-3">
        <p
          className="line-clamp-3 text-[12.5px] font-medium leading-[1.5] text-ink"
          title={product.description}
        >
          {product.description}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
            {formatPrice(product.price)}
          </p>
          <button
            type="button"
            onClick={() => onAdd(product)}
            disabled={disabled}
            title="Ask the assistant to add this to your bag"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-forest px-2.5 py-1.5 text-[10.5px] font-semibold text-[#fbf7ef] transition hover:bg-[#16251d] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ShoppingBag size={12} strokeWidth={2} />
            Add
          </button>
        </div>
      </div>
    </article>
  )
}
