import type { CartItem } from './types'

export function formatPrice(
  value: number | null | undefined,
  currency = 'USD',
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'Price unavailable'
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency || 'USD'} ${value.toFixed(2)}`
  }
}

export function truncate(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + (item.quantity || 0), 0)
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((total, item) => {
    const lineTotal =
      item.total_price ?? (item.price ?? 0) * (item.quantity || 0)
    return total + (Number.isFinite(lineTotal) ? lineTotal : 0)
  }, 0)
}

export function cartCurrency(items: CartItem[]): string {
  return items.find((item) => item.currency)?.currency || 'USD'
}

export function productTitle(description: string): string {
  const clean = description.replace(/\s+/g, ' ').trim()
  if (!clean) return 'Product'

  const firstSentence = clean.match(/^.+?[.!?](?:\s|$)/)?.[0] ?? clean
  return truncate(firstSentence, 82)
}
