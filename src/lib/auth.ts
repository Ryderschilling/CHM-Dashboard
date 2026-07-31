export const AUTH_COOKIE = "chm_auth";

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
