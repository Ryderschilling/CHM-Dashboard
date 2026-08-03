"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AUTH_COOKIE, CREW_COOKIE, expectedToken, crewToken, pinHash } from "@/lib/auth";

export type LoginState = { error?: string };

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
};

/**
 * One door for everyone. The dashboard password opens the admin app;
 * a worker's PIN opens their crew view. Wrong on both counts = same
 * generic error, so the form never reveals which kind of secret exists.
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const input = String(formData.get("password") ?? "").trim();
  if (!input) return { error: "Wrong password. Try again." };

  const jar = await cookies();

  if (input === (process.env.DASHBOARD_PASSWORD ?? "")) {
    jar.delete(CREW_COOKIE);
    jar.set(AUTH_COOKIE, await expectedToken(), COOKIE_OPTS);
    redirect("/");
  }

  // PINs are digits only, so skip the DB lookup for anything else.
  if (/^\d{4,8}$/.test(input)) {
    const worker = await prisma.worker.findFirst({
      where: { pinHash: await pinHash(input), active: true },
      select: { id: true },
    });
    if (worker) {
      jar.delete(AUTH_COOKIE);
      jar.set(CREW_COOKIE, await crewToken(worker.id), COOKIE_OPTS);
      redirect("/crew");
    }
  }

  return { error: "Wrong password. Try again." };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  jar.delete(CREW_COOKIE);
  redirect("/login");
}
