import { NextResponse, type NextRequest } from "next/server";
import { authUrl, googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Kicks off the Google consent screen. Behind the password gate like everything else. */
export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first." },
      { status: 400 }
    );
  }
  const origin = req.nextUrl.origin;
  // state is only a CSRF nonce here; the callback checks the cookie matches.
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authUrl(origin, state));
  res.cookies.set("gcal_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https"),
    path: "/",
    maxAge: 600,
  });
  return res;
}
