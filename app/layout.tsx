import type { Metadata } from "next";
import { Toaster } from "sonner";
import "@fontsource/fredoka/600.css";
import "@fontsource/sora/400.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AI_LEARNING_VIDEO_GENERATION_BY_HAMAS", template: "%s · AI_LEARNING_VIDEO_GENERATION_BY_HAMAS" },
  description: "Create animated, narrated kids' learning videos for YouTube — Shorts and long videos, one or many at a time.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans antialiased">
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          richColors
          closeButton
          toastOptions={{ style: { fontFamily: '"Plus Jakarta Sans", sans-serif', borderRadius: 16, background: "#17151F", border: "1px solid rgba(255,255,255,0.1)" } }}
        />
      </body>
    </html>
  );
}
