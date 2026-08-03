"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { bool, numOrNull, reqStr, str } from "./parse";

/**
 * Standard job durations. See the JobStandard comment in schema.prisma for why
 * these exist and how a Job is matched to one.
 */

function standardData(fd: FormData) {
  const minutes = numOrNull(fd, "minutes");
  if (minutes == null || minutes <= 0) throw new Error("Minutes must be a number above zero");

  const label = reqStr(fd, "label");

  return {
    label,
    minutes: Math.round(minutes),
    clientId: str(fd, "clientId"),
    propertyId: str(fd, "propertyId"),
    gcalSeriesId: str(fd, "gcalSeriesId"),
    // Default the title matcher to the label. Ryder names a standard after the
    // calendar event, so the obvious fallback is almost always the right one.
    titleMatch: str(fd, "titleMatch") ?? label,
    active: fd.has("active") ? bool(fd, "active") : true,
    notes: str(fd, "notes"),
  };
}

export async function createJobStandard(fd: FormData) {
  await prisma.jobStandard.create({ data: standardData(fd) });
  revalidatePath("/", "layout");
}

export async function updateJobStandard(fd: FormData) {
  await prisma.jobStandard.update({
    where: { id: reqStr(fd, "id") },
    data: standardData(fd),
  });
  revalidatePath("/", "layout");
}

export async function deleteJobStandard(fd: FormData) {
  await prisma.jobStandard.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}
