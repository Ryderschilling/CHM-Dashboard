"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { bool, numOrNull, reqStr, str } from "./parse";

function workerData(fd: FormData) {
  return {
    name: reqStr(fd, "name"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    defaultPay: numOrNull(fd, "defaultPay"),
    payNote: str(fd, "payNote"),
    active: bool(fd, "active"),
  };
}

export async function createWorker(fd: FormData) {
  await prisma.worker.create({ data: { ...workerData(fd), active: true } });
  revalidatePath("/", "layout");
}

export async function updateWorker(fd: FormData) {
  await prisma.worker.update({ where: { id: reqStr(fd, "id") }, data: workerData(fd) });
  revalidatePath("/", "layout");
}

export async function deleteWorker(fd: FormData) {
  await prisma.worker.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}
