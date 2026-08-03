"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { CREW_COOKIE, crewWorkerId } from "@/lib/auth";
import { pushJob } from "@/lib/gcalSync";
import { fmtDate, fmtTime } from "@/lib/format";
import { reqStr } from "./parse";

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
