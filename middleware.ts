import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, isInternalCall, verifySessionToken } from "@/lib/auth";

/** Anyone may see these: the public showcase, the admin login page and engine callbacks. */
const PUBLIC = [
  /^\/$/,
  /^\/watch\/[^/]+$/,
  /^\/admin$/,
  /^\/api\/public\//,
  /^\/api\/auth\//,
  /^\/api\/jobs\/[^/]+\/(progress|done)$/,
  /^\/voices\//,
  /^\/characters\//,
  /^\/favicon/,
  /^\/icon/,
  /^\/robots\.txt$/,
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = await verifySessionToken(req.cookies.get(COOKIE)?.value);

  // already signed in → skip the login page
  if (pathname === "/admin" && authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/studio";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  if (pathname.startsWith("/api/") && (await isInternalCall(req.headers.get("x-internal-key")))) {
    return NextResponse.next();
  }
  // Vercel Blob calls this webhook after client uploads complete; the handler verifies the signature itself.
  if (pathname === "/api/upload" && req.method === "POST" && req.headers.get("x-vercel-signature")) {
    return NextResponse.next();
  }
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
