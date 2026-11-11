import clsx from 'clsx'
import { useState } from 'react'
import { PackageOpen } from 'lucide-react'

interface ProductImageProps {
  src?: string
  alt: string
  className?: string
  iconSize?: number
}

export function ProductImage({
  src,
  alt,
  className,
  iconSize = 28,
}: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = Boolean(src && failedSrc === src)

  if (!src || failed) {
    return (
      <div
        className={clsx(
          'flex h-full w-full items-center justify-center text-muted/40',
          className,
        )}
      >
        <PackageOpen size={iconSize} strokeWidth={1.4} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={clsx('h-full w-full object-contain', className)}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
    />
  )
}
