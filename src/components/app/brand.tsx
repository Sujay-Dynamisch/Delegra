import { cn } from "@/lib/utils";

/**
 * The Delegra mark: a "D" whose bowl splits into lanes, one task routed out to many agents.
 * Outer D in ink, inner lane arc and hub in Delegra Violet.
 */
export function DelegraMark({ className, mono }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="3 0 108 190" className={cn("h-8 w-auto", className)} aria-hidden="true" fill="none" strokeLinecap="round">
      {/* Outer D: stem with rounded ends, and the bowl. */}
      <path d="M15 12V178" stroke="var(--brand-ink, #0b0b12)" strokeWidth="21" />
      <path d="M15 12A83 83 0 0 1 15 178" stroke="var(--brand-ink, #0b0b12)" strokeWidth="21" />
      {/* Inner lane: short leads from the stem, then the arc; the bowl's inner edge leaves the gap. */}
      <path d="M15 58H30A37 37 0 0 1 30 132H15" stroke={mono ? "currentColor" : "var(--brand-violet, #4f3bf5)"} strokeWidth="23" strokeLinejoin="round" />
      <circle cx="33" cy="95" r="14" fill={mono ? "currentColor" : "var(--brand-violet, #4f3bf5)"} />
    </svg>
  );
}

/** App icon: white mark on a violet rounded square. */
export function DelegraIcon({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#4f3bf5] shadow-sm shadow-[#4f3bf5]/30", className)}>
      <svg viewBox="0 0 40 48" className="h-[62%] w-auto" aria-hidden="true" fill="none" strokeLinecap="round">
        <path d="M8 6V42" stroke="#fff" strokeWidth="6.5" />
        <path d="M8 6a18 18 0 0 1 0 36" stroke="#fff" strokeWidth="6.5" />
        <path d="M9 15a9 9 0 0 1 0 18" stroke="#b9b0ff" strokeWidth="5" />
        <circle cx="11.5" cy="24" r="3.2" fill="#fff" />
      </svg>
    </span>
  );
}

/** Mark + lowercase wordmark (Space Grotesk SemiBold, tight tracking). */
export function DelegraLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* Light theme: the ink-and-violet mark. Dark theme: the violet app icon. */}
      <DelegraMark className="h-9 dark:hidden" />
      <DelegraIcon className="hidden dark:grid" />
      <span className="font-brand text-[22px] leading-none font-semibold tracking-[-0.045em] lowercase">delegra</span>
    </span>
  );
}
