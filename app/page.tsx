import type { Metadata } from "next";
import { listPublicVideos, publicInfo, type PublicVideo } from "@/lib/public";
import { Navbar } from "@/components/public/Navbar";
import { Hero } from "@/components/public/Hero";
import { Showcase } from "@/components/public/Showcase";
import { Features } from "@/components/public/Features";
import { Footer } from "@/components/public/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "AI_LEARNING_VIDEO_GENERATION_BY_HAMAS — Fun animated lessons for kids" },
  description:
    "Animated, narrated lessons and Shorts for children: maths, science, Quran, Seerah and more — with friendly presenters, quizzes, captions and Islamic values.",
};

async function load() {
  try {
    const [videos, info] = await Promise.all([listPublicVideos({ limit: 120 }), publicInfo()]);
    return { videos, info };
  } catch (e) {
    console.error("public page", e);
    return {
      videos: [] as PublicVideo[],
      info: { channel: "", tagline: "", stats: { videos: 0, seconds: 0, shorts: 0, longs: 0 }, subjects: [] },
    };
  }
}

export default async function HomePage() {
  const { videos, info } = await load();
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <a href="#lessons" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-bg-elev focus:px-4 focus:py-2 focus:text-fg">
        Skip to lessons
      </a>
      <Navbar />
      <main>
        <Hero stats={info.stats} subjectCount={info.subjects.length} />
        <Showcase videos={videos} subjects={info.subjects} />
        <Features />
      </main>
      <Footer tagline={info.tagline} />
    </div>
  );
}
