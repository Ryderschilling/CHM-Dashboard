import { prisma } from "@/lib/db";

/**
 * Serves a visit photo out of Postgres. Behind the auth middleware, so only a
 * logged-in session can read one. Immutable cache because a photo row is never
 * edited in place, only added or deleted.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const photo = await prisma.visitPhoto.findUnique({
    where: { id },
    select: { data: true, mimeType: true },
  });

  if (!photo) return new Response("Not found", { status: 404 });

  const body = new Uint8Array(photo.data);
  return new Response(body, {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
