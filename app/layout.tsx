import type { Metadata } from "next";
import { Toaster } from "sonner";
import "@fontsource/fredoka/400.css";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SeerahVerse Video Studio",
  description: "Create animated, narrated kids' learning videos for YouTube — Shorts and long videos, one or many at a time.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "Nunito, sans-serif", borderRadius: 18 } }} />
      </body>
    </html>
  );
}
