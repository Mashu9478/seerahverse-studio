import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, isInternalCall, verifySessionToken } from "@/lib/auth";

const PUBLIC = [/^\/login$/, /^\/api\/auth\//, /^\/api\/jobs\/[^/]+\/(progress|done)$/, /^\/voices\//, /^\/favicon/, /^\/icon/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  if (pathname.startsWith("/api/") && (await isInternalCall(req.headers.get("x-internal-key")))) {
    return NextResponse.next();
  }
  // Vercel Blob calls this webhook after client uploads complete; the handler verifies the signature itself.
  if (pathname === "/api/upload" && req.method === "POST" && req.headers.get("x-vercel-signature")) {
    return NextResponse.next();
  }

  const ok = await verifySessionToken(req.cookies.get(COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
