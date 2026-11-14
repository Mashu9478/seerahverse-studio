import { NextResponse } from "next/server";
import { COOKIE, SESSION_MAX_AGE, checkPassword, createSessionToken } from "@/lib/auth";
import { handle, jsonError } from "@/lib/http";

export const POST = handle(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password) return jsonError("Please enter the password.");
  await new Promise((r) => setTimeout(r, 300)); // slow down guessing
  if (!(await checkPassword(body.password))) return jsonError("That password isn't right. Try again!", 401);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
});
