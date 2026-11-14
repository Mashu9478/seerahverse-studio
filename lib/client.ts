"use client";

import confetti from "canvas-confetti";
import type { VideoPlan, YoutubeMeta, VideoSettings } from "./plan";

export class ApiError extends Error {
  issues?: string[];
  status: number;
  constructor(msg: string, status: number, issues?: string[]) {
    super(msg);
    this.status = status;
    this.issues = issues;
  }
}

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; issues?: string[] };
  if (res.status === 401 && typeof window !== "undefined" && !url.includes("/api/auth/")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) throw new ApiError(data.error || `Something went wrong (${res.status})`, res.status, data.issues);
  return data as T;
}

export interface VideoListItem {
  id: string;
  batch_id: string | null;
  status: string;
  stage: string | null;
  progress: number;
  message: string | null;
  topic: string;
  subject: string;
  age_group: string;
  format: "long" | "short";
  target_seconds: number;
  youtube: YoutubeMeta | null;
  video_url: string | null;
  thumb_url: string | null;
  srt_url: string | null;
  duration_sec: number | null;
  error: string | null;
  auto_render: boolean;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  title: string | null;
  warning_count: number;
}

export interface VideoFull extends Omit<VideoListItem, "title" | "warning_count"> {
  details: string;
  image_urls: string[];
  settings: VideoSettings;
  plan: VideoPlan | null;
  warnings: string[];
  sandbox_id: string | null;
}

export function celebrate() {
  const colors = ["#7B5CD6", "#FF8A1F", "#2DBE60", "#2F7DF6", "#E64BA6", "#FFC21A"];
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.65 }, colors });
  setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0 }, colors }), 200);
  setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1 }, colors }), 350);
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function elapsed(from: string | null | undefined, to?: string | null) {
  if (!from) return "";
  const s = Math.max(0, ((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadUrl(url: string, filename: string) {
  // Blob URLs support ?download=1 to force a download with a friendly name.
  const u = new URL(url);
  u.searchParams.set("download", "1");
  const a = document.createElement("a");
  a.href = u.toString();
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function slug(s: string) {
  return (s || "video").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "video";
}
