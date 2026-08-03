export const AUTH_COOKIE = "chm_auth";
export const CREW_COOKIE = "chm_crew";

/** SHA-256 hex using Web Crypto, works in both Node and Edge runtimes. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The cookie value that proves the holder knows the dashboard password. */
export async function expectedToken(): Promise<string> {
  const password = process.env.DASHBOARD_PASSWORD ?? "";
  return sha256Hex(`${password}::chm-ops-v1`);
}

/** How a crew PIN is stored on Worker.pinHash. */
export async function pinHash(pin: string): Promise<string> {
  return sha256Hex(`${pin.trim()}::chm-crew-pin-v1`);
}

/**
 * Crew session cookie: "workerId.signature". The signature mixes in the
 * dashboard password as the server secret, so the cookie cannot be forged
 * and rotating the password logs every worker out.
 */
export async function crewToken(workerId: string): Promise<string> {
  const secret = process.env.DASHBOARD_PASSWORD ?? "";
  const sig = await sha256Hex(`${workerId}::${secret}::chm-crew-v1`);
  return `${workerId}.${sig}`;
}

/** The workerId inside a valid crew cookie, else null. Edge-safe (no DB). */
export async function crewWorkerId(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const workerId = token.slice(0, i);
  return (await crewToken(workerId)) === token ? workerId : null;
}
