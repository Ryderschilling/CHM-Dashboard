"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { CREW_COOKIE, crewWorkerId } from "@/lib/auth";
import { pushJob } from "@/lib/gcalSync";
import { fmtDate, fmtTime } from "@/lib/format";
import { readFindings, savePhotos } from "@/lib/reportSave";
import { numOrNull, reqStr, str } from "./parse";

/**
 * Actions a crew member can fire from their phone. Every one of them
 * re-verifies the session AND that the job belongs to that worker, because
 * server actions are public HTTP endpoints regardless of what page rendered
 * the button. Nothing here touches money fields.
 */

async function requireCrew() {
  const jar = await cookies();
  const id = await crewWorkerId(jar.get(CREW_COOKIE)?.value);
  if (!id) throw new Error("Not signed in");
  const worker = await prisma.worker.findUnique({
    where: { id },
    select: { id: true, name: true, active: true },
  });
  if (!worker?.active) throw new Error("Not signed in");
  return worker;
}

/** The job, but only if it is assigned to this worker. */
async function myJob(jobId: string, workerId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.workerId !== workerId) throw new Error("Not your job");
  return job;
}

export async function crewToggleTask(fd: FormData) {
  const worker = await requireCrew();
  const id = reqStr(fd, "id");
  const t = await prisma.task.findUnique({ where: { id }, select: { done: true, jobId: true } });
  if (!t?.jobId) return;
  await myJob(t.jobId, worker.id);
  await prisma.task.update({ where: { id }, data: { done: !t.done } });
  await pushJob(t.jobId);
  revalidatePath("/crew", "layout");
}

/** Mark a job done (or flip it back). Money fields are left for Ryder. */
export async function crewSetJobDone(fd: FormData) {
  const worker = await requireCrew();
  const id = reqStr(fd, "id");
  await myJob(id, worker.id);
  const done = fd.get("done") === "true";
  await prisma.job.update({ where: { id }, data: { status: done ? "DONE" : "SCHEDULED" } });
  await pushJob(id);
  revalidatePath("/crew", "layout");
}

/**
 * The end-of-visit report, filed from the field.
 * Differences from the admin save on purpose:
 * - client/property/date come from the JOB, never from the form
 * - status is forced to DRAFT — Ryder reviews and finalizes before anything
 *   reaches a client or the annual record
 * - no money fields exist on the crew form and none are written here; the
 *   job's laborCost/chargeAmount are left untouched for Ryder to settle
 * - one report per job; a second submit is rejected
 */
export async function crewSubmitVisitReport(fd: FormData) {
  const worker = await requireCrew();
  const jobId = reqStr(fd, "jobId");
  const job = await myJob(jobId, worker.id);
  if (!job.clientId) throw new Error("This job has no client attached yet. Send Ryder a note instead.");

  const existing = await prisma.visitReport.findUnique({ where: { jobId }, select: { id: true } });
  if (existing) throw new Error("A report is already filed for this visit.");

  const minutesOnSite = numOrNull(fd, "minutesOnSite");
  const internal = str(fd, "internalNotes");

  const report = await prisma.visitReport.create({
    data: {
      clientId: job.clientId,
      propertyId: job.propertyId,
      jobId,
      visitDate: job.date,
      minutesOnSite,
      weather: str(fd, "weather"),
      summary: str(fd, "summary"),
      internalNotes: internal ? `Filed by ${worker.name}.\n${internal}` : `Filed by ${worker.name}.`,
      status: "DRAFT",
      findings: { create: readFindings(fd) },
    },
  });

  await savePhotos(fd, report.id);

  // The visit happened: mark the job done and record the time.
  // Money columns are deliberately not touched.
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "DONE",
      ...(minutesOnSite ? { laborHours: Number((minutesOnSite / 60).toFixed(2)) } : {}),
    },
  });
  await pushJob(jobId);
  revalidatePath("/", "layout");
}

/** Append a stamped note to the job, visible on the admin side too. */
export async function crewAddNote(fd: FormData) {
  const worker = await requireCrew();
  const id = reqStr(fd, "id");
  const job = await myJob(id, worker.id);
  const body = reqStr(fd, "note");
  const now = new Date();
  const line = `[${fmtDate(now)} ${fmtTime(now)} · ${worker.name}] ${body}`;
  await prisma.job.update({
    where: { id },
    data: { notes: job.notes ? `${job.notes}\n${line}` : line },
  });
  await pushJob(id);
  revalidatePath("/crew", "layout");
}
