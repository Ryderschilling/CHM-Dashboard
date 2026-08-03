import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, CREW_COOKIE, expectedToken, crewWorkerId } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const isCrewPath = pathname === "/crew" || pathname.startsWith("/crew/");

  const adminToken = req.cookies.get(AUTH_COOKIE)?.value;
  const isAdmin = Boolean(adminToken) && adminToken === (await expectedToken());

  // Admin sees the admin app. /crew needs a worker identity, so send him home.
  if (isAdmin) {
    if (isCrewPath) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Crew cookie only ever unlocks /crew. Anything else bounces there.
  const crewId = await crewWorkerId(req.cookies.get(CREW_COOKIE)?.value);
  if (crewId) {
    if (isCrewPath) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/crew";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|chm-logo.png|api/health).*)"],
};
