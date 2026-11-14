import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSettings, setSetting } from "@/lib/db";
import { handle, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Patch = z
  .object({
    channel: z.string().min(1).max(80),
    tagline: z.string().max(120),
    chip: z.string().max(40),
    voice: z.string(),
    speed: z.number().min(0.8).max(1.15),
    music: z.enum(["none", "cheerful", "calm"]),
    sfx: z.boolean(),
    mascot: z.boolean(),
    presenter: z.string().max(20),
    captions: z.boolean(),
    palette: z.enum(["bright", "pastel", "ocean", "sunset", "forest", "candy"]),
    format: z.enum(["long", "short"]),
    long_minutes: z.number().int().min(1).max(20),
    short_seconds: z.number().int().min(15).max(180),
    age_group: z.string(),
    greeting: z.boolean(),
    subscribe: z.boolean(),
    model: z.string().min(3),
    max_parallel: z.number().int().min(1).max(10),
  })
  .partial();

export const GET = handle(async () => NextResponse.json({ settings: await getAppSettings() }));

export const PUT = handle(async (req: Request) => {
  const p = Patch.safeParse(await req.json().catch(() => null));
  if (!p.success) return jsonError(p.error.issues[0]?.message ?? "Invalid settings");
  const cur = await getAppSettings();
  const next = { ...cur, ...p.data };
  await setSetting("app", next);
  return NextResponse.json({ settings: next });
});
