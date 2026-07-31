"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { ExpenseCategory, PaymentCategory, PaymentMethod, PaymentStatus } from "@prisma/client";
import { dateOrNull, numOr0, reqStr, str } from "./parse";

function paymentData(fd: FormData) {
  const status = (str(fd, "status") ?? "PAID") as PaymentStatus;
  return {
    clientId: str(fd, "clientId"),
    amount: numOr0(fd, "amount"),
    status,
    dueDate: dateOrNull(fd, "dueDate"),
    paidDate: status === "PAID" ? (dateOrNull(fd, "paidDate") ?? new Date()) : null,
    method: (str(fd, "method") as PaymentMethod | null) ?? null,
    category: (str(fd, "category") ?? "RETAINER") as PaymentCategory,
    description: str(fd, "description"),
    invoiceNumber: str(fd, "invoiceNumber"),
  };
}

export async function createPayment(fd: FormData) {
  await prisma.payment.create({ data: paymentData(fd) });
  revalidatePath("/", "layout");
}

export async function updatePayment(fd: FormData) {
  await prisma.payment.update({ where: { id: reqStr(fd, "id") }, data: paymentData(fd) });
  revalidatePath("/", "layout");
}

export async function deletePayment(fd: FormData) {
  await prisma.payment.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}

export async function markPaymentPaid(fd: FormData) {
  await prisma.payment.update({
    where: { id: reqStr(fd, "id") },
    data: { status: "PAID", paidDate: new Date() },
  });
  revalidatePath("/", "layout");
}

/* ---------- Expenses ---------- */

async function expenseData(fd: FormData) {
  const data = {
    date: dateOrNull(fd, "date") ?? new Date(),
    amount: numOr0(fd, "amount"),
    category: (str(fd, "category") ?? "OTHER") as ExpenseCategory,
    vendor: str(fd, "vendor"),
    description: str(fd, "description"),
    workerId: str(fd, "workerId"),
    paymentId: str(fd, "paymentId"),
    clientId: str(fd, "clientId"),
  };
  // Attached to an invoice but no client picked: inherit the invoice's client
  // so per-client cost tracking works automatically.
  if (data.paymentId && !data.clientId) {
    const p = await prisma.payment.findUnique({
      where: { id: data.paymentId },
      select: { clientId: true },
    });
    if (p?.clientId) data.clientId = p.clientId;
  }
  return data;
}

export async function createExpense(fd: FormData) {
  await prisma.expense.create({ data: await expenseData(fd) });
  revalidatePath("/", "layout");
}

export async function updateExpense(fd: FormData) {
  await prisma.expense.update({ where: { id: reqStr(fd, "id") }, data: await expenseData(fd) });
  revalidatePath("/", "layout");
}

export async function deleteExpense(fd: FormData) {
  await prisma.expense.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}
