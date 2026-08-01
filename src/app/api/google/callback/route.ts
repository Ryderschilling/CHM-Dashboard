import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Google sends the user back here with ?code=... */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const err = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.cookies.get("gcal_oauth_state")?.value;

  const back = (msg: string) => {
    const to = url.clone();
    to.pathname = "/jobs";
    to.search = `?gcal=${encodeURIComponent(msg)}`;
    const res = NextResponse.redirect(to);
    res.cookies.delete("gcal_oauth_state");
    return res;
  };

  if (err) return back(`Google said: ${err}`);
  if (!code) return back("No code came back from Google.");
  if (!state || state !== expected) return back("Auth state did not match. Start over.");

  try {
    await exchangeCode(code, url.origin);
  } catch (e) {
    return back(e instanceof Error ? e.message : "Token exchange failed.");
  }
  return back("connected");
}
