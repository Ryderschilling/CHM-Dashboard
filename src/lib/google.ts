/**
 * Google Calendar API v3 access, read AND write.
 *
 * The old ICS feed (lib/gcal.ts) stays for the dashboard's Coming Up strip.
 * This module is the real connection: OAuth with a refresh token so CHM can
 * create, move, and delete events on Ryder's calendar, and read his edits back.
 *
 * The refresh token lives in AppState (the database), not an env var, so
 * connecting is a button click and does not need a redeploy.
 *
 * No SDK on purpose. googleapis is a 40MB dependency for what is four fetches.
 */
import { prisma } from "@/lib/db";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar";

export const KEY_REFRESH = "googleRefreshToken";
export const KEY_CALENDAR = "googleCalendarId";
export const KEY_LAST_SYNC = "lastCalendarSync";
export const KEY_SYNC_NOTE = "lastCalendarSyncNote";

/** Client id/secret still come from env. They are app config, not user data. */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function getState(key: string): Promise<string | null> {
  const row = await prisma.appState.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setState(key: string, value: string): Promise<void> {
  await prisma.appState.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function clearState(key: string): Promise<void> {
  await prisma.appState.deleteMany({ where: { key } });
}

/** Connected = we have client credentials AND a refresh token on file. */
export async function googleConnected(): Promise<boolean> {
  if (!googleConfigured()) return false;
  return Boolean(await getState(KEY_REFRESH));
}

export async function calendarId(): Promise<string> {
  return (await getState(KEY_CALENDAR)) ?? "primary";
}

/** Where Google sends the user back. Must match a URI registered in the console. */
export function redirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/google/callback`;
}

export function authUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // force consent so Google actually hands back a refresh token on re-auth
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${p}`;
}

/** Trade the one-time code for tokens and persist the refresh token. */
export async function exchangeCode(code: string, origin: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as { refresh_token?: string; error_description?: string; error?: string };
  if (!res.ok || !json.refresh_token) {
    throw new Error(
      json.error_description ?? json.error ?? "Google did not return a refresh token. Revoke access and try again."
    );
  }
  await setState(KEY_REFRESH, json.refresh_token);
}

// Access tokens last an hour. Cache in module scope; serverless recycles it for free.
let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const refresh = await getState(KEY_REFRESH);
  if (!refresh) throw new Error("Google Calendar is not connected yet.");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    // A revoked or expired grant is unrecoverable. Drop it so the UI shows Connect again.
    if (json.error === "invalid_grant") await clearState(KEY_REFRESH);
    throw new Error(`Google auth failed: ${json.error ?? res.status}`);
  }
  cached = { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export class GoogleError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Thin Calendar API caller. Path is relative to /calendar/v3. */
export async function gcal<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {}
): Promise<T> {
  const token = await accessToken();
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(init.query ?? {})) if (v != null) q.set(k, v);
  const url = `${API}${path}${q.toString() ? `?${q}` : ""}`;

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try {
      msg = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? msg;
    } catch {
      /* keep the raw body */
    }
    throw new GoogleError(res.status, msg);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---------- shapes we actually use ----------

export type GEventDateTime = { date?: string; dateTime?: string; timeZone?: string };

export type GEvent = {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  start?: GEventDateTime;
  end?: GEventDateTime;
  updated?: string;
  recurringEventId?: string;
  recurrence?: string[];
  attendees?: { email?: string; displayName?: string; responseStatus?: string }[];
  extendedProperties?: { private?: Record<string, string> };
};

export type GCalendarListEntry = { id: string; summary?: string; primary?: boolean; accessRole?: string };

export async function listCalendars(): Promise<GCalendarListEntry[]> {
  const res = await gcal<{ items?: GCalendarListEntry[] }>("/users/me/calendarList", {
    query: { minAccessRole: "writer", maxResults: "50" },
  });
  return res.items ?? [];
}
