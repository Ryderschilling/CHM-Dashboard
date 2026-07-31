"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { syncSquare, type SyncResult } from "@/lib/square";

export type SquareSyncState =
  | { ok: true; result: SyncResult }
  | { ok: false; error: string };

export async function syncSquareAction(): Promise<SquareSyncState> {
  try {
    const result = await syncSquare(prisma);
    revalidatePath("/", "layout");
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sync failed" };
  }
}
