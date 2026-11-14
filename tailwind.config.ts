import type { Config } from "tailwindcss";

/**
 * SeerahVerse Studio — dark design system.
 * Surfaces: bg (page) → panel → card → elev. Text: fg → muted → subtle.
 * Legacy light-theme class names (brand-50, text-ink, bg-*-soft, slate-*) are remapped to dark-friendly
 * values so older markup stays readable; new code should use the semantic tokens below.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#06060B", panel: "#0B0A13", card: "#111019", elev: "#17151F", hover: "#1D1B28" },
        line: { DEFAULT: "rgba(255,255,255,0.08)", strong: "rgba(255,255,255,0.14)" },
        fg: { DEFAULT: "#EDECF5", muted: "#A3A0B8", subtle: "#6E6A84" },
        // brand: 50–200 dark violet surfaces, 300–600 vivid, 700–900 light text tints
        brand: {
          50: "#151226", 100: "#1C1835", 200: "#2A2350", 300: "#A78BFA", 400: "#9B7BFF",
          500: "#8B5CF6", 600: "#7C4DFF", 700: "#C4B5FD", 800: "#DDD6FE", 900: "#EDE9FE",
        },
        ink: "#EDECF5",
        accent: { cyan: "#22D3EE", pink: "#F472B6", amber: "#FBBF24", emerald: "#34D399", orange: "#FB923C", sky: "#38BDF8", rose: "#FB7185" },
        orange: { DEFAULT: "#FB923C", soft: "rgba(251,146,60,0.12)" },
        leaf: { DEFAULT: "#34D399", soft: "rgba(52,211,153,0.12)" },
        sky: { DEFAULT: "#38BDF8", soft: "rgba(56,189,248,0.12)" },
        rose: { DEFAULT: "#F472B6", soft: "rgba(244,114,182,0.12)" },
        sun: { DEFAULT: "#FBBF24", soft: "rgba(251,191,36,0.12)" },
        slate: {
          50: "#14131D", 100: "#1A1925", 200: "#2A2838", 300: "#3A3850", 400: "#7D7A94",
          500: "#A3A0B8", 600: "#BDBACF", 700: "#D4D2E3", 800: "#E4E3EF", 900: "#F1F0F8",
        },
        red: { 50: "rgba(244,63,94,0.10)", 100: "rgba(244,63,94,0.16)", 200: "rgba(244,63,94,0.35)", 500: "#F43F5E", 600: "#FB7185", 700: "#FDA4AF", 800: "#FECDD3" },
        amber: { 50: "rgba(251,191,36,0.10)", 100: "rgba(251,191,36,0.16)", 200: "rgba(251,191,36,0.35)", 500: "#F59E0B", 600: "#FBBF24", 700: "#FCD34D", 800: "#FDE68A" },
        emerald: { 50: "rgba(52,211,153,0.10)", 100: "rgba(52,211,153,0.16)", 200: "rgba(52,211,153,0.35)", 500: "#10B981", 600: "#34D399", 700: "#6EE7B7", 800: "#A7F3D0" },
        green: { 50: "rgba(52,211,153,0.10)", 100: "rgba(52,211,153,0.16)", 200: "rgba(52,211,153,0.35)", 500: "#22C55E", 600: "#4ADE80", 700: "#86EFAC", 800: "#BBF7D0" },
      },
      fontFamily: {
        display: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        fun: ["Fredoka", "ui-rounded", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.8)",
        pop: "0 10px 40px -10px rgba(139,92,246,0.65)",
        glow: "0 0 0 1px rgba(167,139,250,0.35), 0 12px 50px -12px rgba(139,92,246,0.7)",
        "glow-cyan": "0 0 0 1px rgba(34,211,238,0.35), 0 12px 50px -12px rgba(34,211,238,0.55)",
        card: "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 30px 60px -30px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        "brand-grad": "linear-gradient(135deg, #8B5CF6 0%, #C026D3 55%, #F472B6 100%)",
        "cool-grad": "linear-gradient(135deg, #22D3EE 0%, #8B5CF6 100%)",
        "warm-grad": "linear-gradient(135deg, #FBBF24 0%, #FB923C 50%, #F472B6 100%)",
        "card-grad": "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)",
        grid: "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
      },
      borderRadius: { "4xl": "2rem" },
      keyframes: {
        wiggle: { "0%,100%": { transform: "rotate(-4deg)" }, "50%": { transform: "rotate(4deg)" } },
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        shine: { "0%": { transform: "translateX(-120%) skewX(-20deg)" }, "60%,100%": { transform: "translateX(220%) skewX(-20deg)" } },
        aurora: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(6%,-4%,0) scale(1.08)" },
          "66%": { transform: "translate3d(-5%,5%,0) scale(0.96)" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        "pulse-ring": { "0%": { transform: "scale(0.9)", opacity: "0.7" }, "100%": { transform: "scale(1.6)", opacity: "0" } },
        "gradient-x": { "0%,100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
      },
      animation: {
        wiggle: "wiggle 0.6s ease-in-out infinite",
        floaty: "floaty 4s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        shine: "shine 3.2s ease-in-out infinite",
        aurora: "aurora 18s ease-in-out infinite",
        "spin-slow": "spin-slow 12s linear infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite",
        "gradient-x": "gradient-x 6s ease infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
