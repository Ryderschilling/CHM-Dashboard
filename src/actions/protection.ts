"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { bool, dateOrNull, numOrNull, reqStr, str } from "./parse";
import type {
  AlertKind,
  AlertSeverity,
  CoverageStatus,
  ShutoffStatus,
} from "@prisma/client";

/* ---------------- Shutoff devices ---------------- */

function deviceData(fd: FormData) {
  return {
    clientId: reqStr(fd, "clientId"),
    propertyId: str(fd, "propertyId"),
    status: (str(fd, "status") ?? "QUOTED") as ShutoffStatus,
    brand: str(fd, "brand"),
    model: str(fd, "model"),
    serialNumber: str(fd, "serialNumber"),
    installDate: dateOrNull(fd, "installDate"),
    installedBy: str(fd, "installedBy"),
    installPrice: numOrNull(fd, "installPrice"),
    installCost: numOrNull(fd, "installCost"),
    monitored: bool(fd, "monitored"),
    monitoringFee: numOrNull(fd, "monitoringFee"),
    lastCheckedAt: dateOrNull(fd, "lastCheckedAt"),
    warrantyEnd: dateOrNull(fd, "warrantyEnd"),
    notes: str(fd, "notes"),
  };
}

export async function createShutoffDevice(fd: FormData) {
  await prisma.shutoffDevice.create({ data: deviceData(fd) });
  revalidatePath("/", "layout");
}

export async function updateShutoffDevice(fd: FormData) {
  await prisma.shutoffDevice.update({
    where: { id: reqStr(fd, "id") },
    data: deviceData(fd),
  });
  revalidatePath("/", "layout");
}

export async function deleteShutoffDevice(fd: FormData) {
  await prisma.shutoffDevice.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}

/** One tap from the device row: stamp today as the last health check. */
export async function markDeviceChecked(fd: FormData) {
  await prisma.shutoffDevice.update({
    where: { id: reqStr(fd, "id") },
    data: { lastCheckedAt: new Date() },
  });
  revalidatePath("/", "layout");
}

/* ---------------- Alerts ---------------- */

function alertData(fd: FormData) {
  return {
    deviceId: reqStr(fd, "deviceId"),
    occurredAt: dateOrNull(fd, "occurredAt") ?? new Date(),
    kind: (str(fd, "kind") ?? "OTHER") as AlertKind,
    severity: (str(fd, "severity") ?? "WARNING") as AlertSeverity,
    summary: reqStr(fd, "summary"),
    action: str(fd, "action"),
    resolvedAt: dateOrNull(fd, "resolvedAt"),
    notes: str(fd, "notes"),
  };
}

export async function createShutoffAlert(fd: FormData) {
  await prisma.shutoffAlert.create({ data: alertData(fd) });
  revalidatePath("/", "layout");
}

export async function updateShutoffAlert(fd: FormData) {
  await prisma.shutoffAlert.update({
    where: { id: reqStr(fd, "id") },
    data: alertData(fd),
  });
  revalidatePath("/", "layout");
}

export async function deleteShutoffAlert(fd: FormData) {
  await prisma.shutoffAlert.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}

export async function resolveShutoffAlert(fd: FormData) {
  await prisma.shutoffAlert.update({
    where: { id: reqStr(fd, "id") },
    data: { resolvedAt: new Date() },
  });
  revalidatePath("/", "layout");
}

/* ---------------- Coverage records ---------------- */

function coverageData(fd: FormData) {
  const periodStart = dateOrNull(fd, "periodStart");
  const periodEnd = dateOrNull(fd, "periodEnd");
  if (!periodStart || !periodEnd) throw new Error("Coverage period start and end are required");

  // Default the due date to two weeks after the period closes. That is when
  // Ryder actually wants it in the client's hands.
  const dueDate =
    dateOrNull(fd, "dueDate") ?? new Date(periodEnd.getTime() + 14 * 86_400_000);

  return {
    clientId: reqStr(fd, "clientId"),
    periodStart,
    periodEnd,
    dueDate,
    status: (str(fd, "status") ?? "ENROLLED") as CoverageStatus,
    sentDate: dateOrNull(fd, "sentDate"),
    fee: numOrNull(fd, "fee"),
    fileUrl: str(fd, "fileUrl"),
    visitCount: numOrNull(fd, "visitCount"),
    photoCount: numOrNull(fd, "photoCount"),
    notes: str(fd, "notes"),
  };
}

export async function createCoverageRecord(fd: FormData) {
  await prisma.coverageRecord.create({ data: coverageData(fd) });
  revalidatePath("/", "layout");
}

export async function updateCoverageRecord(fd: FormData) {
  await prisma.coverageRecord.update({
    where: { id: reqStr(fd, "id") },
    data: coverageData(fd),
  });
  revalidatePath("/", "layout");
}

export async function deleteCoverageRecord(fd: FormData) {
  await prisma.coverageRecord.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}

/** Mark this year's PDF as delivered. Stamps today and flips the status. */
export async function markCoverageSent(fd: FormData) {
  await prisma.coverageRecord.update({
    where: { id: reqStr(fd, "id") },
    data: { status: "SENT", sentDate: new Date() },
  });
  revalidatePath("/", "layout");
}

/**
 * Roll a client into the next 12-month period. Called from the row action on
 * a record that has already been sent, so enrollment renews without retyping
 * the dates every year.
 */
export async function renewCoverageRecord(fd: FormData) {
  const prev = await prisma.coverageRecord.findUniqueOrThrow({
    where: { id: reqStr(fd, "id") },
  });
  const nextStart = new Date(prev.periodEnd.getTime() + 86_400_000);
  const nextEnd = new Date(nextStart);
  nextEnd.setFullYear(nextEnd.getFullYear() + 1);
  nextEnd.setDate(nextEnd.getDate() - 1);

  await prisma.coverageRecord.create({
    data: {
      clientId: prev.clientId,
      periodStart: nextStart,
      periodEnd: nextEnd,
      dueDate: new Date(nextEnd.getTime() + 14 * 86_400_000),
      status: "ENROLLED",
      fee: prev.fee,
    },
  });
  revalidatePath("/", "layout");
}
