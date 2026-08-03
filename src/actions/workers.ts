"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { pinHash } from "@/lib/auth";
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

/**
 * PIN handling for the crew login. Blank field = leave the PIN alone,
 * "Remove crew login" checkbox = clear it. PINs are unique across workers
 * because the login form identifies the worker by PIN alone.
 */
async function pinUpdate(fd: FormData, currentId?: string): Promise<{ pinHash?: string | null }> {
  if (bool(fd, "clearPin")) return { pinHash: null };
  const pin = str(fd, "pin");
  if (!pin) return {};
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4 to 8 digits.");
  const hash = await pinHash(pin);
  const clash = await prisma.worker.findFirst({
    where: { pinHash: hash, ...(currentId ? { id: { not: currentId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new Error("That PIN is already taken by another worker. Pick a different one.");
  return { pinHash: hash };
}

export async function createWorker(fd: FormData) {
  await prisma.worker.create({
    data: { ...workerData(fd), active: true, ...(await pinUpdate(fd)) },
  });
  revalidatePath("/", "layout");
}

export async function updateWorker(fd: FormData) {
  const id = reqStr(fd, "id");
  await prisma.worker.update({
    where: { id },
    data: { ...workerData(fd), ...(await pinUpdate(fd, id)) },
  });
  revalidatePath("/", "layout");
}

export async function deleteWorker(fd: FormData) {
  await prisma.worker.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}
