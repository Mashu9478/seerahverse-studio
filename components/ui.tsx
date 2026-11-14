"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { forwardRef, useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ================================================================ Button
 * primary  – violet→fuchsia gradient, glow, light sweep
 * secondary – glass with hairline border
 * ghost    – text only
 * danger / success / warm – coloured variants
 * outline  – transparent with gradient border feel
 */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warm" | "outline";
const VARIANTS: Record<Variant, string> = {
  primary:
    "text-white bg-brand-grad bg-[length:200%_200%] animate-gradient-x shadow-pop hover:shadow-glow ring-1 ring-inset ring-white/20 hover:brightness-110",
  secondary:
    "text-fg bg-white/[0.06] ring-1 ring-inset ring-white/12 hover:bg-white/[0.1] hover:ring-white/25 backdrop-blur",
  ghost: "text-fg-muted hover:text-fg hover:bg-white/[0.06]",
  outline: "text-brand-800 ring-1 ring-inset ring-brand-400/40 hover:ring-brand-300 hover:bg-brand-500/10",
  danger: "text-red-700 bg-red-50 ring-1 ring-inset ring-red-200 hover:bg-red-100",
  success:
    "text-[#04130D] bg-gradient-to-r from-[#34D399] to-[#22D3EE] shadow-[0_10px_40px_-12px_rgba(52,211,153,0.7)] hover:brightness-110",
  warm: "text-[#1A0D02] bg-warm-grad shadow-[0_10px_40px_-12px_rgba(251,146,60,0.7)] hover:brightness-110",
};
const SIZES = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-xl",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-14 px-7 text-base gap-2.5 rounded-2xl",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  const shiny = variant === "primary" || variant === "success" || variant === "warm";
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "group/btn relative inline-flex select-none items-center justify-center overflow-hidden font-display font-semibold tracking-tight transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {shiny && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 transition-opacity group-hover/btn:animate-shine group-hover/btn:opacity-100"
        />
      )}
      <span className="relative inline-flex items-center gap-[inherit]">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </span>
    </button>
  );
});

/** Square icon-only button with tooltip label. */
export function IconButton({
  label,
  children,
  className,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl text-fg-muted ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.08] hover:text-fg active:scale-95",
        active && "bg-brand-500/20 text-brand-800 ring-brand-400/40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ================================================================ Card */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("card", className)} {...rest}>
      {children}
    </div>
  );
}

/** Card with an animated gradient border that lights up on hover. */
export function GlowCard({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("group relative rounded-3xl p-px", className)} {...rest}>
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/15 via-white/[0.04] to-white/[0.02] transition duration-500 group-hover:from-brand-400/70 group-hover:via-fuchsia-500/30 group-hover:to-cyan-400/50" />
      <div className="relative h-full rounded-[calc(1.5rem-1px)] bg-bg-card/95 backdrop-blur-xl">{children}</div>
    </div>
  );
}

/* ================================================================ Toggle */
export function Toggle({
  checked,
  onChange,
  label,
  desc,
  emoji,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
  emoji?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition duration-200",
        checked ? "border-brand-400/40 bg-brand-500/[0.12] shadow-[0_0_0_1px_rgba(167,139,250,0.15)]" : "border-white/[0.08] bg-white/[0.03] hover:border-white/20",
      )}
    >
      {emoji && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-xl">{emoji}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{label}</span>
        {desc && <span className="block text-xs text-fg-subtle">{desc}</span>}
      </span>
      <Switch checked={checked} />
    </button>
  );
}

export function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      className={cx(
        "relative h-6 w-11 shrink-0 rounded-full transition duration-300",
        checked ? "bg-brand-grad shadow-[0_0_16px_-2px_rgba(139,92,246,0.8)]" : "bg-white/15",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cx("absolute top-1 h-4 w-4 rounded-full bg-[#fff] shadow", checked ? "right-1" : "left-1")}
      />
    </span>
  );
}

/* ================================================================ Chip */
export function Chip({
  active,
  onClick,
  children,
  className,
  color = "brand",
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  color?: "brand" | "orange" | "leaf" | "sky" | "rose";
}) {
  const on = {
    brand: "border-brand-400/60 bg-brand-500/20 text-brand-900 shadow-[0_0_20px_-6px_rgba(139,92,246,0.9)]",
    orange: "border-orange/60 bg-orange/15 text-[#FED7AA] shadow-[0_0_20px_-6px_rgba(251,146,60,0.9)]",
    leaf: "border-leaf/60 bg-leaf/15 text-[#A7F3D0] shadow-[0_0_20px_-6px_rgba(52,211,153,0.9)]",
    sky: "border-sky/60 bg-sky/15 text-[#BAE6FD] shadow-[0_0_20px_-6px_rgba(56,189,248,0.9)]",
    rose: "border-rose/60 bg-rose/15 text-[#FBCFE8] shadow-[0_0_20px_-6px_rgba(244,114,182,0.9)]",
  }[color];
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, "aria-pressed": active } : {})}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition duration-200",
        onClick && "active:scale-95",
        active ? on : "border-white/10 bg-white/[0.04] text-fg-muted hover:border-white/25 hover:text-fg",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Segmented control (pill tabs). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cx("inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "relative rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition",
            value === o.value ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
          )}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${options.map((x) => x.value).join("")}`} className="absolute inset-0 rounded-lg bg-white/[0.1] ring-1 ring-white/15" />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ================================================================ Badge */
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-white/10", className)}>
      {children}
    </span>
  );
}

/* ================================================================ Field */
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

/* ================================================================ Progress */
export function Progress({
  value,
  className,
  color = "bg-brand-grad",
  striped,
}: {
  value: number;
  className?: string;
  color?: string;
  striped?: boolean;
}) {
  return (
    <div className={cx("h-2.5 w-full overflow-hidden rounded-full bg-white/[0.07]", className)}>
      <motion.div
        className={cx("relative h-full rounded-full shadow-[0_0_14px_rgba(139,92,246,0.6)]", color)}
        initial={false}
        animate={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        transition={{ type: "spring", stiffness: 80, damping: 20 }}
      >
        {striped && (
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ================================================================ Skeleton / Empty */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cx("relative overflow-hidden rounded-2xl bg-white/[0.05]", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

export function Empty({ emoji, title, text, action }: { emoji: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
      <div className="pointer-events-none absolute -top-24 h-48 w-48 rounded-full bg-brand-500/25 blur-3xl" />
      <div className="relative mb-4 grid h-20 w-20 animate-floaty place-items-center rounded-3xl border border-white/10 bg-white/[0.05] text-5xl shadow-glow">
        {emoji}
      </div>
      <h3 className="relative text-xl font-semibold text-fg">{title}</h3>
      {text && <p className="relative mt-1.5 max-w-md text-sm text-fg-muted">{text}</p>}
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}

/* ================================================================ Modal */
export function Modal({
  open,
  onClose,
  children,
  className,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.94, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={cx(
              "relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-bg-elev/95 p-5 shadow-[0_40px_120px_-30px_rgba(0,0,0,1)] backdrop-blur-2xl sm:p-7",
              className,
            )}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 rounded-xl p-2 text-fg-muted ring-1 ring-white/10 transition hover:bg-white/10 hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
            {title && <h2 className="mb-5 pr-10 text-xl font-semibold text-fg">{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ================================================================ Page header */
export function PageHeader({ emoji, title, subtitle, actions }: { emoji: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.1] to-white/[0.02] text-3xl shadow-glow">
          {emoji}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ================================================================ Stat card */
export function StatCard({
  label,
  value,
  icon,
  tone = "violet",
  sub,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "violet" | "cyan" | "amber" | "emerald" | "pink";
  sub?: ReactNode;
}) {
  const t = {
    violet: "from-violet-500/25 text-violet-300",
    cyan: "from-cyan-400/25 text-cyan-300",
    amber: "from-amber-400/25 text-amber-300",
    emerald: "from-emerald-400/25 text-emerald-300",
    pink: "from-pink-500/25 text-pink-300",
  }[tone];
  return (
    <div className="card card-hover relative overflow-hidden p-5">
      <div className={cx("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl", t)} />
      <div className="relative flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">{label}</span>
        {icon && <span className={cx("grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06]", t.split(" ")[1])}>{icon}</span>}
      </div>
      <div className="relative mt-3 font-display text-3xl font-semibold tracking-tight text-fg">{value}</div>
      {sub && <div className="relative mt-1 text-xs text-fg-muted">{sub}</div>}
    </div>
  );
}

/* ================================================================ Decorative background */
export function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute -left-[10%] -top-[20%] h-[55vh] w-[55vw] animate-aurora rounded-full bg-violet-600/25 blur-[120px]" />
      <div className="absolute -right-[10%] top-[10%] h-[45vh] w-[45vw] animate-aurora rounded-full bg-fuchsia-500/15 blur-[120px] [animation-delay:-6s]" />
      <div className="absolute bottom-[-20%] left-[20%] h-[45vh] w-[50vw] animate-aurora rounded-full bg-cyan-500/10 blur-[120px] [animation-delay:-12s]" />
      <div className="grid-bg absolute inset-0" />
    </div>
  );
}

export function GradientText({ children, className, warm }: { children: ReactNode; className?: string; warm?: boolean }) {
  return <span className={cx(warm ? "text-gradient-warm" : "text-gradient", className)}>{children}</span>;
}
