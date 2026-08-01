"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { JobStatus } from "@prisma/client";
import { bool, dateOrNull, numOr0, numOrNull, reqStr, str } from "./parse";
import { pushJob, deleteJobEvent, syncCalendar, type SyncResult } from "@/lib/gcalSync";
import { setState, clearState, KEY_CALENDAR, KEY_REFRESH } from "@/lib/google";

/** yyyy-mm-dd plus optional HH:mm. Falls back to local noon so the day never shifts. */
function whenFrom(fd: FormData, dateKey: string, timeKey: string): Date | null {
  const d = dateOrNull(fd, dateKey);
  if (!d) return null;
  const t = str(fd, timeKey);
  const m = t?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return d;
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function jobData(fd: FormData) {
  const allDay = bool(fd, "allDay");
  const date = whenFrom(fd, "date", "startTime") ?? new Date();
  const endDate = whenFrom(fd, "endDate", "endTime") ?? (allDay ? null : whenFrom(fd, "date", "endTime"));

  return {
    clientId: str(fd, "clientId"),
    propertyId: str(fd, "propertyId"),
    title: reqStr(fd, "title"),
    jobType: str(fd, "jobType"),
    date,
    endDate: endDate && endDate > date ? endDate : null,
    allDay,
    location: str(fd, "location"),
    status: (str(fd, "status") ?? "SCHEDULED") as JobStatus,
    workerId: str(fd, "workerId"),
    laborCost: numOr0(fd, "laborCost"),
    laborHours: numOrNull(fd, "laborHours"),
    chargeAmount: numOrNull(fd, "chargeAmount"),
    durationMin: numOrNull(fd, "durationMin"),
    notes: str(fd, "notes"),
  };
}

export async function createJob(fd: FormData) {
  const job = await prisma.job.create({ data: jobData(fd) });
  await pushJob(job.id);
  revalidatePath("/", "layout");
}

export async function updateJob(fd: FormData) {
  const job = await prisma.job.update({ where: { id: reqStr(fd, "id") }, data: jobData(fd) });
  await pushJob(job.id);
  revalidatePath("/", "layout");
}

export async function deleteJob(fd: FormData) {
  const id = reqStr(fd, "id");
  const job = await prisma.job.findUnique({ where: { id }, select: { gcalEventId: true } });
  await deleteJobEvent(job?.gcalEventId ?? null);
  await prisma.job.delete({ where: { id } });
  revalidatePath("/", "layout");
}

/**
 * Mark a job done, record what it cost and what it earns.
 * Optionally drops a DUE charge onto the client's tab in one move.
 */
export async function completeJob(fd: FormData) {
  const id = reqStr(fd, "id");
  const laborCost = numOr0(fd, "laborCost");
  const laborHours = numOrNull(fd, "laborHours");
  const chargeAmount = numOrNull(fd, "chargeAmount");

  const job = await prisma.job.update({
    where: { id },
    data: { status: "DONE", laborCost, laborHours, chargeAmount },
  });

  if (bool(fd, "billClient") && chargeAmount && job.clientId) {
    const due = new Date();
    due.setDate(due.getDate() + 7);
    await prisma.payment.create({
      data: {
        clientId: job.clientId,
        amount: chargeAmount,
        status: "DUE",
        dueDate: due,
        category: "A_LA_CARTE",
        description: job.title,
      },
    });
  }

  // Push so the calendar entry reflects done status and the real numbers.
  await pushJob(id);
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------ job checklist

export async function addJobTask(fd: FormData) {
  const jobId = reqStr(fd, "jobId");
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { clientId: true } });
  await prisma.task.create({
    data: { title: reqStr(fd, "title"), jobId, clientId: job?.clientId ?? null },
  });
  await pushJob(jobId);
  revalidatePath("/", "layout");
}

export async function toggleJobTask(fd: FormData) {
  const id = reqStr(fd, "id");
  const t = await prisma.task.findUnique({ where: { id }, select: { done: true, jobId: true } });
  if (!t) return;
  await prisma.task.update({ where: { id }, data: { done: !t.done } });
  if (t.jobId) await pushJob(t.jobId);
  revalidatePath("/", "layout");
}

export async function deleteJobTask(fd: FormData) {
  const id = reqStr(fd, "id");
  const t = await prisma.task.findUnique({ where: { id }, select: { jobId: true } });
  await prisma.task.delete({ where: { id } });
  if (t?.jobId) await pushJob(t.jobId);
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------ calendar admin

export async function runCalendarSync(): Promise<SyncResult> {
  const res = await syncCalendar();
  revalidatePath("/", "layout");
  return res;
}

export async function setCalendar(fd: FormData) {
  await setState(KEY_CALENDAR, reqStr(fd, "calendarId"));
  revalidatePath("/", "layout");
}

export async function disconnectCalendar() {
  await clearState(KEY_REFRESH);
  revalidatePath("/", "layout");
}
