"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { TaskPriority } from "@prisma/client";
import { dateOrNull, reqStr, str } from "./parse";

export async function createTask(fd: FormData) {
  await prisma.task.create({
    data: {
      title: reqStr(fd, "title"),
      dueDate: dateOrNull(fd, "dueDate"),
      priority: (str(fd, "priority") ?? "NORMAL") as TaskPriority,
      clientId: str(fd, "clientId"),
      notes: str(fd, "notes"),
    },
  });
  revalidatePath("/", "layout");
}

export async function updateTask(fd: FormData) {
  await prisma.task.update({
    where: { id: reqStr(fd, "id") },
    data: {
      title: reqStr(fd, "title"),
      dueDate: dateOrNull(fd, "dueDate"),
      priority: (str(fd, "priority") ?? "NORMAL") as TaskPriority,
      clientId: str(fd, "clientId"),
      notes: str(fd, "notes"),
    },
  });
  revalidatePath("/", "layout");
}

export async function toggleTask(fd: FormData) {
  const id = reqStr(fd, "id");
  const task = await prisma.task.findUniqueOrThrow({ where: { id } });
  await prisma.task.update({ where: { id }, data: { done: !task.done } });
  revalidatePath("/", "layout");
}

export async function deleteTask(fd: FormData) {
  await prisma.task.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}
