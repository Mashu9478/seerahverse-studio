import { cx } from "./ui";

/** SeerahVerse mark: an owl-eye monogram on a gradient tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cx("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="svlg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="0.55" stopColor="#C026D3" />
          <stop offset="1" stopColor="#F472B6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#svlg)" />
      <rect x="1" y="1" width="62" height="62" rx="17" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
      <path d="M16 14l7 8M48 14l-7 8" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="23" cy="30" r="9.5" fill="#fff" />
      <circle cx="41" cy="30" r="9.5" fill="#fff" />
      <circle cx="24" cy="31" r="4.6" fill="#1A1033" />
      <circle cx="40" cy="31" r="4.6" fill="#1A1033" />
      <circle cx="25.5" cy="29" r="1.4" fill="#fff" />
      <circle cx="41.5" cy="29" r="1.4" fill="#fff" />
      <path d="M28 40h8l-4 7z" fill="#FBBF24" />
    </svg>
  );
}

export function Logo({ sub = "Video Studio", className }: { sub?: string; className?: string }) {
  return (
    <span className={cx("flex items-center gap-3", className)}>
      <LogoMark className="h-10 w-10 drop-shadow-[0_6px_18px_rgba(139,92,246,0.55)]" />
      <span className="leading-tight">
        <span className="block font-display text-[17px] font-semibold text-fg" style={{ fontKerning: "none" }}>
          SeerahVerse
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-300">{sub}</span>
      </span>
    </span>
  );
}
