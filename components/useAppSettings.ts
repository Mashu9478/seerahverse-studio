"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "@/lib/constants";
import type { StyleValue } from "./StylePanel";

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
  return {
    voice: s.voice,
    speed: s.speed,
    music: s.music as StyleValue["music"],
    sfx: s.sfx,
    mascot: s.mascot,
    presenter: s.presenter ?? (s.mascot ? "ollie" : "none"),
    style: s.style === "explainer" ? "explainer" : "presenter",
    captions: s.captions,
    palette: s.palette as StyleValue["palette"],
    chip: s.chip,
    greeting: s.greeting,
    subscribe: s.subscribe,
  };
}

/** Settings payload for a new video from the chosen style. */
export function styleToSettings(v: StyleValue) {
  const explainer = v.style === "explainer";
  return { ...v, presenter: explainer ? "none" : v.presenter, mascot: !explainer && v.presenter !== "none" };
}
