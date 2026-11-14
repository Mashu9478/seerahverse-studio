import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F4F0FF", 100: "#E9E1FF", 200: "#D4C6FF", 300: "#B9A3FB", 400: "#9C7EF0",
          500: "#7B5CD6", 600: "#6A4BC4", 700: "#5B3FB3", 800: "#45308A", 900: "#2B2045",
        },
        ink: "#2B2045",
        orange: { DEFAULT: "#FF8A1F", soft: "#FFF1E3" },
        leaf: { DEFAULT: "#2DBE60", soft: "#E3F8EA" },
        sky: { DEFAULT: "#2F7DF6", soft: "#E4EEFF" },
        rose: { DEFAULT: "#E64BA6", soft: "#FDE6F3" },
        sun: { DEFAULT: "#FFC21A", soft: "#FFF6D9" },
      },
      fontFamily: {
        display: ["Fredoka", "ui-rounded", "system-ui", "sans-serif"],
        sans: ["Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 6px 24px -8px rgba(43,32,69,0.18)",
        pop: "0 10px 30px -10px rgba(123,92,214,0.45)",
      },
      borderRadius: { "4xl": "2rem" },
      keyframes: {
        wiggle: { "0%,100%": { transform: "rotate(-4deg)" }, "50%": { transform: "rotate(4deg)" } },
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        wiggle: "wiggle 0.6s ease-in-out infinite",
        floaty: "floaty 3s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
