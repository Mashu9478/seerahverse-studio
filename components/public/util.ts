import type { PublicVideo } from "@/lib/public";

export type { PublicVideo };

export function fmtDuration(sec: number | null | undefined) {
  if (!sec || sec <= 0) return "";
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function fmtMinutes(sec: number) {
  const m = Math.round(sec / 60);
  return m < 1 && sec > 0 ? "<1" : String(m);
}

export const SUBJECT_EMOJI: Record<string, string> = {
  Math: "➗",
  Mathematics: "➗",
  Science: "🔬",
  English: "📖",
  "Islamic Studies": "🕌",
  Quran: "📗",
  Seerah: "🌙",
  "General Knowledge": "🌍",
};

export function subjectEmoji(s: string) {
  return SUBJECT_EMOJI[s] ?? "✨";
}

export function ageLabel(a: string) {
  return a ? `Ages ${a}` : "";
}
