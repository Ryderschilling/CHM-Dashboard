"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { BillingCadence, ClientStatus } from "@prisma/client";
import { bool, dateOrNull, numOrNull, reqStr, str } from "./parse";

function clientData(fd: FormData) {
  return {
    name: reqStr(fd, "name"),
    status: (str(fd, "status") ?? "ACTIVE") as ClientStatus,
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    altContact: str(fd, "altContact"),
    community: str(fd, "community"),
    planName: str(fd, "planName"),
    planAmount: numOrNull(fd, "planAmount"),
    cadence: (str(fd, "cadence") ?? "MONTHLY") as BillingCadence,
    lockedRate: bool(fd, "lockedRate"),
    lockedUntil: dateOrNull(fd, "lockedUntil"),
    startDate: dateOrNull(fd, "startDate"),
    source: str(fd, "source"),
    notes: str(fd, "notes"),
  };
}

export async function createClient(fd: FormData) {
  const client = await prisma.client.create({ data: clientData(fd) });
  const address = str(fd, "address");
  if (address) {
    await prisma.property.create({
      data: { clientId: client.id, address, label: "Main home" },
    });
  }
  revalidatePath("/", "layout");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(fd: FormData) {
  const id = reqStr(fd, "id");
  await prisma.client.update({ where: { id }, data: clientData(fd) });
  revalidatePath("/", "layout");
}

export async function deleteClient(fd: FormData) {
  const id = reqStr(fd, "id");
  await prisma.client.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect("/clients");
}

/* ---------- Properties ---------- */

function propertyData(fd: FormData) {
  return {
    label: str(fd, "label"),
    address: reqStr(fd, "address"),
    gateCode: str(fd, "gateCode"),
    doorCode: str(fd, "doorCode"),
    alarmCode: str(fd, "alarmCode"),
    wifiName: str(fd, "wifiName"),
    wifiPassword: str(fd, "wifiPassword"),
    keyLocation: str(fd, "keyLocation"),
    trashDay: str(fd, "trashDay"),
    hvacNotes: str(fd, "hvacNotes"),
    notes: str(fd, "notes"),
  };
}

export async function createProperty(fd: FormData) {
  await prisma.property.create({
    data: { clientId: reqStr(fd, "clientId"), ...propertyData(fd) },
  });
  revalidatePath("/", "layout");
}

export async function updateProperty(fd: FormData) {
  await prisma.property.update({
    where: { id: reqStr(fd, "id") },
    data: propertyData(fd),
  });
  revalidatePath("/", "layout");
}

export async function deleteProperty(fd: FormData) {
  await prisma.property.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}

/* ---------- Activity notes ---------- */

export async function addNote(fd: FormData) {
  await prisma.note.create({
    data: { clientId: reqStr(fd, "clientId"), body: reqStr(fd, "body") },
  });
  revalidatePath("/", "layout");
}

export async function deleteNote(fd: FormData) {
  await prisma.note.delete({ where: { id: reqStr(fd, "id") } });
  revalidatePath("/", "layout");
}
