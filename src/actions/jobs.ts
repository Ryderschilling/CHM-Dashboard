"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { JobStatus } from "@prisma/client";
import { bool, dateOrNull, numOr0, numOrNull, reqStr, str } from "./parse";

function jobData(fd: FormData) {
  return {
    clientId: str(fd, "clientId"),
    propertyId: str(fd, "propertyId"),
    title: reqStr(fd, "title"),
    jobType: str(fd, "jobType"),
    date: dateOrNull(fd, "date") ?? new Date(),
    status: (str(fd, "status") ?? "SCHEDULED") as JobStatus,
    workerId: str(fd, "workerId"),
    laborCost: numOr0(fd, "laborCost"),
    chargeAmount: numOrNull(fd, "chargeAmount"),
    durationMin: numOrNull(fd, "durationMin"),
    notes: str(fd, "notes"),
  };
}

export async function createJob(fd: FormData) {
  await prisma.job.create({ data: jobData(fd) });
  revalidatePath("/", "layout");
}

export async function updateJob(fd: FormData) {
  await prisma.job.update({ where: { id: reqStr(fd, "id") }, data: jobData(fd) });
  revalidatePath("/", "layout");
}

export async function deleteJob(fd: FormData) {
  await prisma.job.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}

/**
 * Mark a job done, record what it cost and what it earns.
 * Optionally drops a DUE charge onto the client's tab in one move.
 */
export async function completeJob(fd: FormData) {
  const id = reqStr(fd, "id");
  const laborCost = numOr0(fd, "laborCost");
  const chargeAmount = numOrNull(fd, "chargeAmount");

  const job = await prisma.job.update({
    where: { id },
    data: { status: "DONE", laborCost, chargeAmount },
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
  revalidatePath("/", "layout");
}
