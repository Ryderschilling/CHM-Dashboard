import { prisma } from "@/lib/db";
import type { FindingState } from "@prisma/client";

/**
 * Shared save helpers for visit reports, used by BOTH the admin actions
 * (src/actions/visits.ts) and the crew action (src/actions/crew.ts).
 * They live here as a plain module on purpose: exporting them from a
 * "use server" file would turn them into public HTTP endpoints.
 */

/**
 * Findings arrive as parallel arrays from the form:
 *   finding_areaId[] / finding_label[] / finding_category[] /
 *   finding_state[] / finding_note[]
 * The label is snapshotted at report time rather than looked up later.
 */
export function readFindings(fd: FormData) {
  const areaIds = fd.getAll("finding_areaId").map(String);
  const labels = fd.getAll("finding_label").map(String);
  const categories = fd.getAll("finding_category").map(String);
  const states = fd.getAll("finding_state").map(String);
  const notes = fd.getAll("finding_note").map(String);

  return labels.map((label, i) => ({
    areaId: areaIds[i] && areaIds[i] !== "" ? areaIds[i] : null,
    label,
    category: categories[i] || "Interior",
    state: (states[i] || "OK") as FindingState,
    note: notes[i]?.trim() ? notes[i].trim() : null,
    sortOrder: i,
  }));
}

/**
 * Photos come in already resized by the browser (1400px, JPEG 0.7), so the
 * server just stores the bytes. Anything over 3MB is rejected rather than
 * silently bloating the database.
 */
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export async function savePhotos(fd: FormData, reportId: string) {
  const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return;

  const captions = fd.getAll("photo_caption").map(String);
  const max = await prisma.visitPhoto.aggregate({
    where: { reportId },
    _max: { sortOrder: true },
  });
  let order = (max._max.sortOrder ?? -1) + 1;

  for (const [i, file] of files.entries()) {
    if (file.size > MAX_PHOTO_BYTES) continue;
    const buf = Buffer.from(await file.arrayBuffer());
    await prisma.visitPhoto.create({
      data: {
        reportId,
        data: buf,
        mimeType: file.type || "image/jpeg",
        bytes: buf.byteLength,
        caption: captions[i]?.trim() || null,
        sortOrder: order++,
      },
    });
  }
}
