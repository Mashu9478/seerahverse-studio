"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { DEFAULT_APP_SETTINGS, DEFAULT_VOICE_FOR, VOICES, type AppSettings } from "@/lib/constants";
import type { StyleValue } from "./StylePanel";
import type { VideoSettings } from "@/lib/plan";

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  useEffect(() => {
    api<{ settings: AppSettings }>("/api/settings")
      .then((r) => setSettings(r.settings))
      .catch(() => setSettings(DEFAULT_APP_SETTINGS));
  }, []);
  return settings;
}

export function styleFromSettings(s: AppSettings): StyleValue {
  const language = s.language === "ur" ? "ur" : "en";
  const voiceOk = VOICES.find((v) => v.id === s.voice)?.lang === language;
  return {
    language,
    voice: voiceOk ? s.voice : DEFAULT_VOICE_FOR[language],
    speed: s.speed,
    music: s.music as StyleValue["music"],
    sfx: s.sfx,
    mascot: s.mascot,
    presenter: s.presenter ?? (s.mascot ? "ollie" : "none"),
    style: language === "ur" || s.style === "explainer" ? "explainer" : "presenter",
    captions: s.captions,
    palette: s.palette as StyleValue["palette"],
    chip: s.chip,
    greeting: s.greeting,
    subscribe: s.subscribe,
  };
}

/** Settings payload for a new video from the chosen style. */
export function styleToSettings(v: StyleValue) {
  const language = v.language === "ur" ? "ur" : "en";
  const explainer = language === "ur" || v.style === "explainer";
  return {
    ...v,
    language,
    style: explainer ? ("explainer" as const) : ("presenter" as const),
    presenter: explainer ? "none" : v.presenter,
    mascot: !explainer && v.presenter !== "none",
  };
}

/** Style panel value from the settings stored on an existing video (Edit & try again). */
export function styleFromVideo(s: Partial<VideoSettings> | null | undefined, fallback: StyleValue): StyleValue {
  if (!s) return fallback;
  const language = s.language === "ur" ? "ur" : "en";
  const voiceOk = VOICES.find((v) => v.id === s.voice)?.lang === language;
  return {
    ...fallback,
    language,
    voice: voiceOk && s.voice ? s.voice : DEFAULT_VOICE_FOR[language],
    speed: s.speed ?? fallback.speed,
    music: (s.music ?? fallback.music) as StyleValue["music"],
    sfx: s.sfx ?? fallback.sfx,
    mascot: s.mascot ?? fallback.mascot,
    presenter: s.presenter ?? fallback.presenter,
    style: language === "ur" || s.style === "explainer" ? "explainer" : "presenter",
    captions: s.captions ?? fallback.captions,
    palette: (s.palette ?? fallback.palette) as StyleValue["palette"],
    chip: s.chip ?? fallback.chip,
    greeting: s.greeting ?? fallback.greeting,
    subscribe: s.subscribe ?? fallback.subscribe,
  };
}
