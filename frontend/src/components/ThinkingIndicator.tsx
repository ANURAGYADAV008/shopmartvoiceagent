import { useEffect, useState } from 'react'

const stages = [
  'Searching the catalog',
  'Comparing your options',
  'Writing a recommendation',
]

export function ThinkingIndicator() {
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % stages.length)
    }, 2400)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="max-w-md rounded-2xl border border-line/70 bg-white/60 px-4 py-3.5"
    >
      <div className="flex items-center gap-2.5">
        <span className="relative flex size-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
          <span className="relative inline-flex size-2 rounded-full bg-accent" />
        </span>
        <span
          key={stageIndex}
          className="animate-fade-in text-[13px] font-medium text-ink"
        >
          {stages[stageIndex]}
        </span>
        <span className="ml-0.5 flex items-center gap-0.5" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="size-1 animate-bounce rounded-full bg-muted/45"
              style={{ animationDelay: `${index * 120}ms` }}
            />
          ))}
        </span>
      </div>

      <div className="mt-3 space-y-2" aria-hidden="true">
        <div className="shimmer h-2 w-3/4 rounded-full bg-line/60" />
        <div className="shimmer h-2 w-1/2 rounded-full bg-line/50" />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted/80">
        Searching inventory and comparing options. This can take 20–40 seconds.
      </p>
    </div>
  )
}
