/**
 * Read-only Square sync.
 *
 * Pulls invoices and customers from Square and mirrors them into the
 * database. This module NEVER writes to Square: every request is a GET.
 * Square stays the billing system, this platform is the window into it.
 */
import type { PrismaClient } from "@prisma/client";

const BASE = "https://connect.squareup.com/v2";

export function squareConfigured(): boolean {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN);
}

async function sqGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Square ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/* ---------- Square shapes (just the fields we read) ---------- */

export type SquareInvoice = {
  id: string;
  invoice_number?: string;
  title?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  primary_recipient?: {
    customer_id?: string;
    given_name?: string;
    family_name?: string;
  };
  payment_requests?: {
    due_date?: string;
    computed_amount_money?: { amount?: number };
  }[];
};

export type SquareCustomer = {
  id: string;
  given_name?: string;
  family_name?: string;
  email_address?: string;
  phone_number?: string;
  address?: { address_line_1?: string; locality?: string };
};

export async function fetchAllInvoices(locationId: string): Promise<SquareInvoice[]> {
  const out: SquareInvoice[] = [];
  let cursor: string | undefined;
  do {
    const qs = new URLSearchParams({ location_id: locationId, limit: "100" });
    if (cursor) qs.set("cursor", cursor);
    const page = await sqGet(`/invoices?${qs}`);
    out.push(...((page.invoices as SquareInvoice[]) ?? []));
    cursor = page.cursor as string | undefined;
  } while (cursor);
  return out;
}

export async function fetchAllCustomers(): Promise<SquareCustomer[]> {
  const out: SquareCustomer[] = [];
  let cursor: string | undefined;
  do {
    const qs = new URLSearchParams({ limit: "100" });
    if (cursor) qs.set("cursor", cursor);
    const page = await sqGet(`/customers?${qs}`);
    out.push(...((page.customers as SquareCustomer[]) ?? []));
    cursor = page.cursor as string | undefined;
  } while (cursor);
  return out;
}

/* ---------- Mapping helpers ---------- */

export function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function customerName(c: SquareCustomer): string {
  return titleCase(`${c.given_name ?? ""} ${c.family_name ?? ""}`);
}

function inferCategory(title: string): "RETAINER" | "A_LA_CARTE" | "PROJECT" {
  const t = title.toLowerCase();
  if (/install|supply|cover|project/.test(t)) return "PROJECT";
  if (/retainer|plan|monthly|home watch|watering/.test(t)) return "RETAINER";
  return "A_LA_CARTE";
}

/** Parse yyyy-mm-dd at local noon so timezones never shift the day. */
function parseDay(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

const SKIP_STATUSES = new Set(["CANCELED", "FAILED", "PAYMENT_FAILED", "DELETED"]);
const PAID_STATUSES = new Set(["PAID", "REFUNDED", "PARTIALLY_REFUNDED"]);
// Scheduled or draft in Square = built but not sent to the client yet
const UPCOMING_STATUSES = new Set(["DRAFT", "SCHEDULED"]);

export type SyncResult = {
  created: number;
  updated: number;
  removed: number;
  clientsCreated: number;
  total: number;
};

/**
 * Mirror Square into the database. Idempotent, safe to run any time.
 * Reads invoices + customers, upserts payments and clients, deletes
 * payments whose Square invoice no longer exists.
 */
export async function syncSquare(prisma: PrismaClient): Promise<SyncResult> {
  if (!squareConfigured()) {
    throw new Error("SQUARE_ACCESS_TOKEN is not set in .env");
  }
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) throw new Error("SQUARE_LOCATION_ID is not set in .env");

  const [invoices, customers] = await Promise.all([
    fetchAllInvoices(locationId),
    fetchAllCustomers(),
  ]);
  const customerById = new Map(customers.map((c) => [c.id, c]));

  // Build customer -> client map from SquareLink, seeding links from any
  // clients that carry a bare squareCustomerId.
  const links = new Map<string, string>();
  for (const l of await prisma.squareLink.findMany()) {
    links.set(l.squareCustomerId, l.clientId);
  }
  const withIds = await prisma.client.findMany({
    where: { squareCustomerId: { not: null } },
    select: { id: true, squareCustomerId: true },
  });
  for (const c of withIds) {
    const sqId = c.squareCustomerId as string;
    if (!links.has(sqId)) {
      await prisma.squareLink.create({ data: { squareCustomerId: sqId, clientId: c.id } });
      links.set(sqId, c.id);
    }
  }

  // Latest invoice date per customer, used to pick ACTIVE vs FORMER for
  // clients we have to create.
  const latestByCustomer = new Map<string, number>();
  for (const inv of invoices) {
    const cid = inv.primary_recipient?.customer_id;
    if (!cid) continue;
    const t = new Date(inv.payment_requests?.[0]?.due_date ?? inv.created_at ?? 0).getTime();
    latestByCustomer.set(cid, Math.max(latestByCustomer.get(cid) ?? 0, t));
  }

  const result: SyncResult = { created: 0, updated: 0, removed: 0, clientsCreated: 0, total: invoices.length };
  const seenSquareIds = new Set<string>();

  for (const inv of invoices) {
    if (SKIP_STATUSES.has(inv.status ?? "")) continue;
    seenSquareIds.add(inv.id);

    const req = inv.payment_requests?.[0];
    const amount = (req?.computed_amount_money?.amount ?? 0) / 100;
    const isPaid = PAID_STATUSES.has(inv.status ?? "");
    const dueDate = parseDay(req?.due_date);
    // Square does not expose the exact payment moment on the invoice
    // object, so paid date approximates to the due date. If the due date
    // is still in the future (paid early), fall back to updated_at.
    const now = new Date();
    const paidDate = isPaid
      ? (dueDate && dueDate <= now ? dueDate : (parseDay(inv.updated_at) ?? dueDate ?? now))
      : null;
    const description = inv.title?.trim() || null;

    // Resolve or create the client
    let clientId: string | null = null;
    const custId = inv.primary_recipient?.customer_id;
    if (custId) {
      clientId = links.get(custId) ?? null;
      if (!clientId) {
        const cust = customerById.get(custId);
        const name = cust
          ? customerName(cust)
          : titleCase(`${inv.primary_recipient?.given_name ?? ""} ${inv.primary_recipient?.family_name ?? ""}`) || "Square customer";
        const recentDays = (Date.now() - (latestByCustomer.get(custId) ?? 0)) / 86_400_000;
        const created = await prisma.client.create({
          data: {
            name,
            status: recentDays <= 60 ? "ACTIVE" : "FORMER",
            cadence: "AD_HOC",
            email: cust?.email_address ?? null,
            phone: cust?.phone_number ?? null,
            squareCustomerId: custId,
            source: "Square import",
            ...(cust?.address?.address_line_1
              ? {
                  properties: {
                    create: {
                      address: [cust.address.address_line_1, cust.address.locality ? titleCase(cust.address.locality) : null]
                        .filter(Boolean)
                        .join(", "),
                      label: "Main home",
                    },
                  },
                }
              : {}),
          },
        });
        await prisma.squareLink.create({ data: { squareCustomerId: custId, clientId: created.id } });
        links.set(custId, created.id);
        clientId = created.id;
        result.clientsCreated++;
      } else {
        // Light enrichment: fill missing contact info, never overwrite.
        const cust = customerById.get(custId);
        if (cust && (cust.email_address || cust.phone_number)) {
          const existing = await prisma.client.findUnique({
            where: { id: clientId },
            select: { email: true, phone: true },
          });
          if (existing && (!existing.email || !existing.phone)) {
            await prisma.client.update({
              where: { id: clientId },
              data: {
                ...(existing.email ? {} : { email: cust.email_address ?? undefined }),
                ...(existing.phone ? {} : { phone: cust.phone_number ?? undefined }),
              },
            });
          }
        }
      }
    }

    const common = {
      clientId,
      amount,
      status: (isPaid
        ? "PAID"
        : UPCOMING_STATUSES.has(inv.status ?? "")
          ? "UPCOMING"
          : "DUE") as "PAID" | "DUE" | "UPCOMING",
      dueDate,
      paidDate,
      method: "SQUARE" as const,
      description,
      invoiceNumber: inv.invoice_number ?? null,
    };

    const existing =
      (await prisma.payment.findFirst({ where: { squareInvoiceId: inv.id } })) ??
      (inv.invoice_number
        ? await prisma.payment.findFirst({
            where: { squareInvoiceId: null, invoiceNumber: inv.invoice_number },
          })
        : null);

    if (existing) {
      // Category stays as the user set it; everything else mirrors Square.
      await prisma.payment.update({
        where: { id: existing.id },
        data: { ...common, squareInvoiceId: inv.id },
      });
      result.updated++;
    } else {
      await prisma.payment.create({
        data: {
          ...common,
          squareInvoiceId: inv.id,
          category: inferCategory(description ?? ""),
        },
      });
      result.created++;
    }
  }

  // Remove mirrored payments whose invoice vanished from Square
  // (deleted or canceled there). Manual entries are never touched.
  const stale = await prisma.payment.findMany({
    where: { squareInvoiceId: { not: null } },
    select: { id: true, squareInvoiceId: true },
  });
  for (const p of stale) {
    if (!seenSquareIds.has(p.squareInvoiceId as string)) {
      await prisma.payment.delete({ where: { id: p.id } });
      result.removed++;
    }
  }

  await prisma.appState.upsert({
    where: { key: "lastSquareSync" },
    update: { value: new Date().toISOString() },
    create: { key: "lastSquareSync", value: new Date().toISOString() },
  });

  return result;
}
