export const VOICES = [
  { id: "af_heart", name: "Heart", desc: "Warm, kind teacher", accent: "US", gender: "female", emoji: "💜", lang: "en" },
  { id: "af_bella", name: "Bella", desc: "Bright & cheerful", accent: "US", gender: "female", emoji: "🌟", lang: "en" },
  { id: "af_nicole", name: "Nicole", desc: "Soft & calm", accent: "US", gender: "female", emoji: "🌙", lang: "en" },
  { id: "af_sky", name: "Sky", desc: "Young & lively", accent: "US", gender: "female", emoji: "☁️", lang: "en" },
  { id: "am_michael", name: "Michael", desc: "Friendly big brother", accent: "US", gender: "male", emoji: "🧢", lang: "en" },
  { id: "am_puck", name: "Puck", desc: "Playful & fun", accent: "US", gender: "male", emoji: "🎈", lang: "en" },
  { id: "am_fenrir", name: "Fenrir", desc: "Deep storyteller", accent: "US", gender: "male", emoji: "🐺", lang: "en" },
  { id: "bf_emma", name: "Emma", desc: "Gentle British", accent: "UK", gender: "female", emoji: "🌷", lang: "en" },
  { id: "bm_george", name: "George", desc: "Clear British", accent: "UK", gender: "male", emoji: "🎩", lang: "en" },
  { id: "bm_fable", name: "Fable", desc: "British storyteller", accent: "UK", gender: "male", emoji: "📖", lang: "en" },
  { id: "hf_alpha", name: "Ayesha", desc: "Warm Urdu teacher", accent: "Urdu", gender: "female", emoji: "🌸", lang: "ur" },
  { id: "hf_beta", name: "Zainab", desc: "Soft Urdu voice", accent: "Urdu", gender: "female", emoji: "🌼", lang: "ur" },
  { id: "hm_omega", name: "Bilal", desc: "Clear Urdu voice", accent: "Urdu", gender: "male", emoji: "🌙", lang: "ur" },
  { id: "hm_psi", name: "Hamza", desc: "Friendly Urdu storyteller", accent: "Urdu", gender: "male", emoji: "📗", lang: "ur" },
] as const;

export type LanguageId = "en" | "ur";
export const LANGUAGES: { id: LanguageId; name: string; native: string; dir: "ltr" | "rtl"; note: string }[] = [
  { id: "en", name: "English", native: "English", dir: "ltr", note: "Both video styles" },
  { id: "ur", name: "Urdu", native: "اردو", dir: "rtl", note: "Urdu narration and Urdu on-screen text (Diagram explainer style)" },
];
export const DEFAULT_VOICE_FOR: Record<LanguageId, string> = { en: "af_heart", ur: "hf_alpha" };
export function voicesFor(lang: LanguageId) {
  return VOICES.filter((v) => v.lang === lang);
}

export type VoiceId = (typeof VOICES)[number]["id"];

export const SUBJECTS = [
  { id: "Math", emoji: "➕" },
  { id: "Science", emoji: "🔬" },
  { id: "English", emoji: "🔤" },
  { id: "Islamic Studies", emoji: "🕌" },
  { id: "Quran", emoji: "📖" },
  { id: "Seerah", emoji: "🐪" },
  { id: "General Knowledge", emoji: "🌍" },
] as const;

export const AGE_GROUPS = [
  { id: "4-5", label: "4–5 yrs", emoji: "🧸" },
  { id: "6-7", label: "6–7 yrs", emoji: "🎒" },
  { id: "8-9", label: "8–9 yrs", emoji: "🚲" },
  { id: "10-12", label: "10–12 yrs", emoji: "🔭" },
] as const;

export const SHORT_DURATIONS = [15, 30, 45, 60, 90, 120, 180] as const;

export const PALETTES = [
  { id: "bright", name: "Bright", colors: ["#FFF6C7", "#7B5CD6", "#FF8A1F", "#2DBE60"] },
  { id: "pastel", name: "Pastel", colors: ["#F4EEFF", "#B9A3FB", "#FFC8DD", "#BDE0FE"] },
  { id: "ocean", name: "Ocean", colors: ["#E2F8FF", "#2F7DF6", "#14B8A6", "#8FDDF7"] },
  { id: "sunset", name: "Sunset", colors: ["#FFE2EE", "#FF8A1F", "#E64BA6", "#FFD2A6"] },
  { id: "forest", name: "Forest", colors: ["#E6FAEA", "#2DBE60", "#8CCB6A", "#6B4226"] },
  { id: "candy", name: "Candy", colors: ["#FFE6F3", "#E64BA6", "#8E5CF0", "#FFC21A"] },
] as const;

export const MUSIC = [
  { id: "none", name: "No music", desc: "Voice + gentle sound effects. Suits many Muslim families.", emoji: "🤫" },
  { id: "cheerful", name: "Cheerful", desc: "Soft, bouncy background tune", emoji: "🎶" },
  { id: "calm", name: "Calm", desc: "Slow, peaceful background", emoji: "🌿" },
] as const;

export const AI_MODELS = [
  { id: "anthropic/claude-sonnet-5.5", name: "Claude Sonnet 5.5", desc: "Fast & great quality (recommended)" },
  { id: "anthropic/claude-opus-5.5", name: "Claude Opus 5.5", desc: "Best quality, slower, costs more" },
] as const;

export const SCENE_TYPES = [
  { type: "title", name: "Title", emoji: "🎬", desc: "Big bouncy title with hero emojis" },
  { type: "concept", name: "Concept", emoji: "💡", desc: "Explain an idea with points" },
  { type: "objects", name: "Counting objects", emoji: "🍎", desc: "Groups of emoji to count" },
  { type: "equation", name: "Equation", emoji: "🧮", desc: "Math problem, answer pops in" },
  { type: "quiz", name: "Quiz", emoji: "❓", desc: "Question, countdown, reveal" },
  { type: "steps", name: "Steps", emoji: "🪜", desc: "Numbered steps or a cycle" },
  { type: "compare", name: "Compare", emoji: "⚖️", desc: "Two columns to sort things" },
  { type: "story", name: "Story", emoji: "📚", desc: "Characters and props" },
  { type: "fact", name: "Fun fact", emoji: "✨", desc: "Did-you-know card" },
  { type: "islamic", name: "Islamic connection", emoji: "🕌", desc: "Ayah, hadith, Seerah or dua" },
  { type: "recap", name: "Recap", emoji: "⭐", desc: "Star checklist summary" },
  { type: "outro", name: "Outro", emoji: "👋", desc: "Goodbye + subscribe" },
] as const;

export type SceneTypeId = (typeof SCENE_TYPES)[number]["type"];

/** On-screen presenter characters (drawn by the engine). "none" = no character, narrator voice only. */
export const CHARACTERS = [
  { id: "ollie", name: "Ollie the Owl", short: "Ollie", desc: "Wise, cheerful owl in a graduation cap", img: "/characters/ollie.png", color: "#8B5CF6" },
  { id: "maryam", name: "Maryam", short: "Maryam", desc: "Kind teacher girl in a hijab", img: "/characters/maryam.png", color: "#F472B6" },
  { id: "yusuf", name: "Yusuf", short: "Yusuf", desc: "Curious boy with a kufi", img: "/characters/yusuf.png", color: "#38BDF8" },
  { id: "robo", name: "Robo the Robot", short: "Robo", desc: "Friendly science robot", img: "/characters/robo.png", color: "#22D3EE" },
  { id: "sheru", name: "Sheru the Lion Cub", short: "Sheru", desc: "Brave, playful lion cub", img: "/characters/sheru.png", color: "#FBBF24" },
  { id: "none", name: "No character", short: "None", desc: "Just the lesson visuals and a teacher's voice", img: "/characters/none.png", color: "#9A97B0" },
] as const;
export type PresenterId = (typeof CHARACTERS)[number]["id"];
export const PRESENTER_IDS = CHARACTERS.map((c) => c.id) as [PresenterId, ...PresenterId[]];
export function characterById(id: string | undefined | null) {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export const TWEMOJI_CREDIT = "Emoji graphics: Twemoji by X Corp & contributors, CC-BY 4.0.";

export const DEFAULT_APP_SETTINGS = {
  channel: "AI_LEARNING_VIDEO_GENERATION_BY_HAMAS",
  tagline: "learning made fun",
  chip: "",
  voice: "af_heart",
  speed: 0.92,
  music: "none",
  sfx: true,
  mascot: true,
  presenter: "ollie" as string,
  style: "presenter" as string,
  language: "en" as string,
  captions: true,
  palette: "bright",
  format: "long",
  long_minutes: 5,
  short_seconds: 60,
  age_group: "6-7",
  greeting: true,
  subscribe: true,
  model: "anthropic/claude-sonnet-5.5",
  max_parallel: 4,
};

export type AppSettings = typeof DEFAULT_APP_SETTINGS;

export const STATUS_META: Record<string, { label: string; color: string; emoji: string }> = {
  draft: { label: "Draft", color: "bg-white/[0.06] text-fg-muted ring-white/15", emoji: "📝" },
  scripting: { label: "Writing script", color: "bg-violet-500/15 text-violet-300 ring-violet-400/30", emoji: "✍️" },
  review: { label: "Needs review", color: "bg-amber-400/15 text-amber-300 ring-amber-400/30", emoji: "👀" },
  queued: { label: "Queued", color: "bg-sky-400/15 text-sky-300 ring-sky-400/30", emoji: "⏳" },
  rendering: { label: "Rendering", color: "bg-cyan-400/15 text-cyan-300 ring-cyan-400/30", emoji: "🎨" },
  uploading: { label: "Uploading", color: "bg-sky-400/15 text-sky-300 ring-sky-400/30", emoji: "☁️" },
  done: { label: "Done", color: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30", emoji: "🎉" },
  failed: { label: "Failed", color: "bg-rose-500/15 text-rose-300 ring-rose-400/30", emoji: "⚠️" },
  canceled: { label: "Canceled", color: "bg-white/[0.06] text-fg-subtle ring-white/15", emoji: "🚫" },
};
