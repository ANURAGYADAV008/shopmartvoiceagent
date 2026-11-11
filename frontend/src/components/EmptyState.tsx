import {
  ArrowUpRight,
  Headphones,
  Laptop,
  Speaker,
  Sparkles,
  Watch,
} from 'lucide-react'

interface EmptyStateProps {
  onSuggestion: (prompt: string) => void
}

const suggestions = [
  {
    icon: Headphones,
    label: 'Noise-cancelling headphones under $100',
    prompt: 'Show me wireless noise-cancelling headphones under $100.',
    tone: 'bg-[#fbe9df] text-[#b94b20]',
  },
  {
    icon: Laptop,
    label: 'A laptop stand for my home office',
    prompt: 'Find a sturdy laptop stand for a home office setup.',
    tone: 'bg-[#e9efe9] text-[#2f5b3e]',
  },
  {
    icon: Speaker,
    label: 'A portable speaker for travel',
    prompt: 'Find a portable Bluetooth speaker for travel.',
    tone: 'bg-[#e9eef7] text-[#365d96]',
  },
  {
    icon: Watch,
    label: 'A smartwatch for fitness tracking',
    prompt: 'Recommend a smartwatch for fitness tracking under $200.',
    tone: 'bg-[#f6ecf2] text-[#985073]',
  },
]

export function EmptyState({ onSuggestion }: EmptyStateProps) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[780px] flex-col justify-center py-8 sm:py-11">
      <div className="animate-fade-up">
        <div className="relative mb-6 flex size-16 items-center justify-center">
          <div className="absolute inset-0 rotate-6 rounded-[22px] bg-accent-soft" />
          <div className="relative flex size-16 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#f28a5f_0%,#d95322_100%)] text-white shadow-[0_18px_38px_-20px_rgba(217,83,34,0.75)]">
            <Sparkles size={26} strokeWidth={1.7} />
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Your AI electronics shopper
          </span>
        </div>

        <h1 className="font-display max-w-[620px] text-[43px] leading-[0.98] tracking-[-0.025em] text-ink sm:text-[56px]">
          What are you <span className="italic text-accent">shopping</span> for?
        </h1>

        <p className="mt-4 max-w-[540px] text-[13.5px] leading-[1.7] text-muted sm:text-[14.5px]">
          Ask in your own words. I&apos;ll search the Amazon Electronics catalog,
          compare specs, and help you build the right setup.
        </p>
      </div>

      <div
        className="animate-fade-up mt-7"
        style={{ animationDelay: '90ms' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/80">
            Try asking
          </p>
          <p className="hidden text-[10.5px] text-muted/60 sm:block">
            Search by budget, use case, or feature
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon
            return (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => onSuggestion(suggestion.prompt)}
                className="group flex items-center gap-3 rounded-2xl border border-line/80 bg-white/65 p-3.5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent/25 hover:bg-white hover:shadow-[0_12px_28px_-20px_rgba(59,48,35,0.45)]"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${suggestion.tone}`}
                >
                  <Icon size={16} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1 text-[12.5px] font-medium leading-[1.45] text-ink/85">
                  {suggestion.label}
                </span>
                <ArrowUpRight
                  size={15}
                  className="shrink-0 text-muted/30 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
