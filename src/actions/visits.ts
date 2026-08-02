"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { dateOrNull, numOrNull, reqStr, str } from "./parse";
import { DEFAULT_CHECK_AREAS, categoryRank } from "@/lib/checkAreas";
import type { FindingState, Prisma } from "@prisma/client";

/* ---------------- Per-property check areas ---------------- */

/** Copy the default template onto a property. Skips labels it already has. */
export async function seedCheckAreas(fd: FormData) {
  const propertyId = reqStr(fd, "propertyId");
  const existing = await prisma.propertyCheckArea.findMany({
    where: { propertyId },
    select: { label: true },
  });
  const have = new Set(existing.map((a) => a.label.toLowerCase()));
  const rows = DEFAULT_CHECK_AREAS.filter((a) => !have.has(a.label.toLowerCase())).map(
    (a, i) => ({
      propertyId,
      label: a.label,
      category: a.category,
      sortOrder: categoryRank(a.category) * 100 + i,
    }),
  );
  if (rows.length) await prisma.propertyCheckArea.createMany({ data: rows });
  revalidatePath("/", "layout");
}

export async function createCheckArea(fd: FormData) {
  const propertyId = reqStr(fd, "propertyId");
  const category = str(fd, "category") ?? "Interior";
  const max = await prisma.propertyCheckArea.aggregate({
    where: { propertyId },
    _max: { sortOrder: true },
  });
  await prisma.propertyCheckArea.create({
    data: {
      propertyId,
      label: reqStr(fd, "label"),
      category,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/", "layout");
}

export async function updateCheckArea(fd: FormData) {
  await prisma.propertyCheckArea.update({
    where: { id: reqStr(fd, "id") },
    data: {
      label: reqStr(fd, "label"),
      category: str(fd, "category") ?? "Interior",
      active: fd.get("active") !== "false",
    },
  });
  revalidatePath("/", "layout");
}

/**
 * Retiring an area does NOT delete it, it deactivates it. Past VisitFindings
 * snapshot their own label, so history is safe either way, but keeping the row
 * means the area can be turned back on without losing its place.
 */
export async function toggleCheckArea(fd: FormData) {
  const id = reqStr(fd, "id");
  const area = await prisma.propertyCheckArea.findUniqueOrThrow({ where: { id } });
  await prisma.propertyCheckArea.update({
    where: { id },
    data: { active: !area.active },
  });
  revalidatePath("/", "layout");
}

export async function deleteCheckArea(fd: FormData) {
  await prisma.propertyCheckArea.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}

/* ---------------- Visit reports ---------------- */

/**
 * Push the money and time from a report onto its Job, so the existing P&L
 * (lib/jobValue.ts, lib/metrics.ts) sees it without a second accounting path.
 * Also creates a Job when the visit was not on the calendar, so an unplanned
 * stop still shows up in the month's numbers.
 */
async function syncJobFromReport(reportId: string) {
  const r = await prisma.visitReport.findUniqueOrThrow({
    where: { id: reportId },
    include: { client: { select: { name: true } }, property: { select: { address: true } } },
  });

  const hours = r.minutesOnSite ? Number((r.minutesOnSite / 60).toFixed(2)) : null;
  const shared = {
    laborHours: hours as Prisma.Decimal | number | null,
    laborCost: r.laborCost ?? 0,
    chargeAmount: r.chargeAmount,
    status: "DONE" as const,
  };

  if (r.jobId) {
    await prisma.job.update({ where: { id: r.jobId }, data: shared });
    return r.jobId;
  }

  const job = await prisma.job.create({
    data: {
      clientId: r.clientId,
      propertyId: r.propertyId,
      title: "Home watch visit",
      jobType: "Home watch visit",
      date: r.visitDate,
      location: r.property?.address ?? null,
      ...shared,
    },
  });
  await prisma.visitReport.update({ where: { id: r.id }, data: { jobId: job.id } });
  return job.id;
}

/**
 * Materials bought on a visit become a real Expense so they hit the P&L.
 * Re-running is safe: the previous auto-created expense for this report is
 * replaced, never stacked. The marker in `description` is how they are found.
 */
const EXPENSE_MARKER = "[visit]";

async function syncExpenseFromReport(reportId: string) {
  const r = await prisma.visitReport.findUniqueOrThrow({ where: { id: reportId } });

  await prisma.expense.deleteMany({
    where: { clientId: r.clientId, description: { contains: `${EXPENSE_MARKER} ${reportId}` } },
  });

  const amount = r.materialCost ? Number(r.materialCost) : 0;
  if (amount <= 0) return;

  await prisma.expense.create({
    data: {
      date: r.visitDate,
      amount,
      category: "SUPPLIES",
      clientId: r.clientId,
      description: `${r.materialNote ?? "Materials on visit"} ${EXPENSE_MARKER} ${reportId}`,
    },
  });
}

function reportCore(fd: FormData) {
  return {
    clientId: reqStr(fd, "clientId"),
    propertyId: str(fd, "propertyId"),
    jobId: str(fd, "jobId"),
    visitDate: dateOrNull(fd, "visitDate") ?? new Date(),
    minutesOnSite: numOrNull(fd, "minutesOnSite"),
    weather: str(fd, "weather"),
    summary: str(fd, "summary"),
    internalNotes: str(fd, "internalNotes"),
    chargeAmount: numOrNull(fd, "chargeAmount"),
    laborCost: numOrNull(fd, "laborCost"),
    materialCost: numOrNull(fd, "materialCost"),
    materialNote: str(fd, "materialNote"),
    status: (str(fd, "status") ?? "FINAL") as "DRAFT" | "FINAL",
  };
}

/**
 * Findings arrive as three parallel arrays from the form:
 *   finding_areaId[] / finding_state[] / finding_note[]
 * plus finding_label[] and finding_category[] so the label is snapshotted at
 * report time rather than looked up later.
 */
function readFindings(fd: FormData) {
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

export async function createVisitReport(fd: FormData) {
  const core = reportCore(fd);
  const findings = readFindings(fd);

  const report = await prisma.visitReport.create({
    data: { ...core, findings: { create: findings } },
  });

  await savePhotos(fd, report.id);
  await syncJobFromReport(report.id);
  await syncExpenseFromReport(report.id);
  revalidatePath("/", "layout");
}

export async function updateVisitReport(fd: FormData) {
  const id = reqStr(fd, "id");
  const core = reportCore(fd);
  const findings = readFindings(fd);

  // Findings are fully rewritten on save. They are a snapshot of one visit,
  // not a living list, so replacing them is correct and keeps sortOrder sane.
  await prisma.$transaction([
    prisma.visitFinding.deleteMany({ where: { reportId: id } }),
    prisma.visitReport.update({
      where: { id },
      data: { ...core, findings: { create: findings } },
    }),
  ]);

  await savePhotos(fd, id);
  await syncJobFromReport(id);
  await syncExpenseFromReport(id);
  revalidatePath("/", "layout");
}

/**
 * Photos come in already resized by the browser (1400px, JPEG 0.7), so the
 * server just stores the bytes. Anything over 3MB is rejected rather than
 * silently bloating the database.
 */
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

async function savePhotos(fd: FormData, reportId: string) {
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

export async function deleteVisitPhoto(fd: FormData) {
  await prisma.visitPhoto.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}

export async function updatePhotoCaption(fd: FormData) {
  await prisma.visitPhoto.update({
    where: { id: reqStr(fd, "id") },
    data: { caption: str(fd, "caption") },
  });
  revalidatePath("/", "layout");
}

export async function deleteVisitReport(fd: FormData) {
  const id = reqStr(fd, "id");
  const r = await prisma.visitReport.findUniqueOrThrow({ where: { id } });
  await prisma.expense.deleteMany({
    where: { clientId: r.clientId, description: { contains: `${EXPENSE_MARKER} ${id}` } },
  });
  await prisma.visitReport.delete({ where: { id } });
  revalidatePath("/", "layout");
}

export async function finalizeVisitReport(fd: FormData) {
  await prisma.visitReport.update({
    where: { id: reqStr(fd, "id") },
    data: { status: "FINAL" },
  });
  revalidatePath("/", "layout");
}
