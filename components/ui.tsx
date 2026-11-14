"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { forwardRef, useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------------- Button ---------------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warm";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-500 text-white shadow-pop hover:bg-brand-600 active:bg-brand-700",
  secondary: "bg-white text-brand-700 ring-2 ring-brand-200 hover:bg-brand-50",
  ghost: "text-brand-700 hover:bg-brand-50",
  danger: "bg-white text-red-600 ring-2 ring-red-200 hover:bg-red-50",
  success: "bg-leaf text-white shadow-[0_10px_30px_-10px_rgba(45,190,96,0.6)] hover:brightness-105",
  warm: "bg-orange text-white shadow-[0_10px_30px_-10px_rgba(255,138,31,0.6)] hover:brightness-105",
};
const SIZES = { sm: "h-9 px-3.5 text-sm gap-1.5", md: "h-11 px-5 text-[15px] gap-2", lg: "h-14 px-7 text-lg gap-2.5" };

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center rounded-2xl font-display font-semibold tracking-wide transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ---------------- Card ---------------- */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("card", className)} {...rest}>
      {children}
    </div>
  );
}

/* ---------------- Toggle ---------------- */
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
        "flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition",
        checked ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-200",
      )}
    >
      {emoji && <span className="text-2xl">{emoji}</span>}
      <span className="flex-1">
        <span className="block font-bold text-ink">{label}</span>
        {desc && <span className="block text-xs text-slate-500">{desc}</span>}
      </span>
      <span className={cx("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-brand-500" : "bg-slate-300")}>
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cx("absolute top-1 h-5 w-5 rounded-full bg-white shadow", checked ? "right-1" : "left-1")}
        />
      </span>
    </button>
  );
}

/* ---------------- Chip ---------------- */
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
    brand: "border-brand-500 bg-brand-500 text-white",
    orange: "border-orange bg-orange text-white",
    leaf: "border-leaf bg-leaf text-white",
    sky: "border-sky bg-sky text-white",
    rose: "border-rose bg-rose text-white",
  }[color];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5 font-display text-sm font-semibold transition active:scale-95",
        active ? on : "border-brand-100 bg-white text-brand-700 hover:border-brand-300",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", className)}>{children}</span>;
}

/* ---------------- Field ---------------- */
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

/* ---------------- Progress ---------------- */
export function Progress({ value, className, color = "bg-brand-500", striped }: { value: number; className?: string; color?: string; striped?: boolean }) {
  return (
    <div className={cx("h-3 w-full overflow-hidden rounded-full bg-brand-100", className)}>
      <motion.div
        className={cx("relative h-full rounded-full", color)}
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

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-2xl bg-brand-100/70", className)} />;
}

/* ---------------- Empty ---------------- */
export function Empty({ emoji, title, text, action }: { emoji: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-brand-200 bg-white/60 px-6 py-14 text-center">
      <div className="mb-3 animate-floaty text-6xl">{emoji}</div>
      <h3 className="text-xl font-semibold text-ink">{title}</h3>
      {text && <p className="mt-1 max-w-md text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- Modal ---------------- */
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
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className={cx("relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-4xl bg-white p-5 shadow-2xl sm:p-7", className)}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 rounded-full bg-brand-50 p-2 text-brand-700 transition hover:bg-brand-100"
            >
              <X className="h-5 w-5" />
            </button>
            {title && <h2 className="mb-4 pr-10 text-2xl font-semibold">{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Section heading ---------------- */
export function PageHeader({ emoji, title, subtitle, actions }: { emoji: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-semibold text-ink sm:text-4xl">
          <span className="inline-block animate-floaty">{emoji}</span>
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
