/**
 * One-time backfill: runs the real read-only sync code against saved Square
 * API responses (no network), then applies one-time enrichment learned from
 * Square customer records. Run: npx tsx scripts/backfill-from-dump.ts
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { readFileSync } from "fs";
import { syncSquare } from "../src/lib/square";

const invoicesDump = JSON.parse(readFileSync(process.argv[2] ?? "/tmp/sq_invoices.json", "utf8"));
const customersDump = JSON.parse(readFileSync(process.argv[3] ?? "/tmp/sq_customers.json", "utf8"));

const realFetch = global.fetch;
global.fetch = (async (url: RequestInfo | URL) => {
  const u = String(url);
  if (u.includes("/v2/invoices")) return new Response(JSON.stringify(invoicesDump), { status: 200 });
  if (u.includes("/v2/customers")) return new Response(JSON.stringify(customersDump), { status: 200 });
  return realFetch(url as never);
}) as typeof fetch;

process.env.SQUARE_ACCESS_TOKEN = "offline-backfill";
process.env.SQUARE_LOCATION_ID = "LA4134BAKSB68";

const prisma = new PrismaClient();

function d(y: number, m: number, day: number) {
  return new Date(y, m - 1, day, 12);
}

async function main() {
  // 1. Link known Square customer IDs to the seeded clients by name
  const nameToSquare: [string, string][] = [
    ["Barbara Reed", "W2AW1YXPS06F31KDAPFXDM51Q4"],
    ["Beth Tedesco", "KMYYK5MB34EMVSCQF3P6C0G9QR"],
    ["Becky Cowart Portera", "5EYSPYY66T28KRC732QV2PY2K0"],
    ["Chris Lambert", "FTCT0WZB15HRM4NBK6QKTHX8KC"],
    ["Denise and Layne Birling", "C55TSBFX315ZP22HCYV0Y9C0T4"],
    ["Denise and Layne Birling", "S4RHASKAVRJZRTWCWYRM8Z4GQ0"],
    ["Buddy Norman", "EAP9ATA3VG1952TBGDFJVPRM2C"],
    ["Scott Clark", "00R4Z53JTE8CSA8E0RVEWZ072R"],
    ["Jennifer Gaines", "NQ5PQTHTAW3RKGS1J5DHN4SP38"],
  ];
  for (const [name, sqId] of nameToSquare) {
    const c = await prisma.client.findFirst({ where: { name } });
    if (c) {
      await prisma.squareLink.upsert({
        where: { squareCustomerId: sqId },
        update: { clientId: c.id },
        create: { squareCustomerId: sqId, clientId: c.id },
      });
    }
  }

  // 2. Run the real sync code against the saved Square data
  const res = await syncSquare(prisma);
  console.log("sync:", JSON.stringify(res));

  // 3. Sue Hale has two Square directory records; point both at one client
  const sue = await prisma.squareLink.findUnique({ where: { squareCustomerId: "3JZ0DHMQ770KJJXN4VHQ125GYC" } });
  if (sue) {
    await prisma.squareLink.upsert({
      where: { squareCustomerId: "7JN260S0WW82AXPTF6G3GJHN9G" },
      update: { clientId: sue.clientId },
      create: { squareCustomerId: "7JN260S0WW82AXPTF6G3GJHN9G", clientId: sue.clientId },
    });
  }

  // 4. Remove the stale seeded Eric draft #000053: Square shows it was
  // replaced by the paid 000054-R recurring series
  const gone = await prisma.payment.deleteMany({ where: { invoiceNumber: "000053", squareInvoiceId: null } });
  console.log("removed stale drafts:", gone.count);

  // 5. One-time enrichment from Square customer records and series history
  async function upd(name: string, data: Prisma.ClientUpdateInput & { squareCustomerId?: string }, property?: string) {
    const c = await prisma.client.findFirst({ where: { name }, include: { properties: true } });
    if (!c) {
      console.log("missing client:", name);
      return;
    }
    await prisma.client.update({ where: { id: c.id }, data });
    if (property && c.properties.length === 0) {
      await prisma.property.create({ data: { clientId: c.id, address: property, label: "Main home" } });
    }
  }

  await upd("Barbara Reed", { email: "reed8208@gmail.com", phone: "(270) 784-8588", community: "Naturewalk", planName: "Standard Plan", planAmount: 100, cadence: "MONTHLY", startDate: d(2025, 11, 13), squareCustomerId: "W2AW1YXPS06F31KDAPFXDM51Q4" }, "256 Naturewalk Blvd, Inlet Beach");
  await upd("Beth Tedesco", { phone: "(678) 313-6379", startDate: d(2025, 11, 30), squareCustomerId: "KMYYK5MB34EMVSCQF3P6C0G9QR" }, "36 Pollard Cove West, Inlet Beach");
  await upd("Becky Cowart Portera", { phone: "(214) 663-3572", planName: "Basic home watch", planAmount: 75, cadence: "MONTHLY", startDate: d(2026, 4, 25), squareCustomerId: "5EYSPYY66T28KRC732QV2PY2K0" }, "34 Windrow Way, Inlet Beach");
  await upd("Chris Lambert", { email: "christopheredwardlambert@gmail.com", phone: "(314) 620-9566", planName: "Basic home watch", planAmount: 125, cadence: "MONTHLY", startDate: d(2026, 4, 25), squareCustomerId: "FTCT0WZB15HRM4NBK6QKTHX8KC" });
  await upd("Denise and Layne Birling", { email: "dmbirling@gmail.com", phone: "(480) 721-0451", altContact: "Layne Birling, (602) 399-2440", planName: "Home Watch", planAmount: 300, cadence: "MONTHLY", startDate: d(2026, 5, 7), squareCustomerId: "C55TSBFX315ZP22HCYV0Y9C0T4" }, "204 E Firethorn Circle, Inlet Beach");
  await upd("Buddy Norman", { email: "buddynorman@bellsouth.net", phone: "(931) 626-6722", squareCustomerId: "EAP9ATA3VG1952TBGDFJVPRM2C" }, "259 W Firethorn Circle");
  await upd("Scott Clark", { email: "r.scott.clark24@gmail.com", phone: "(309) 253-9234", startDate: d(2025, 11, 6), squareCustomerId: "00R4Z53JTE8CSA8E0RVEWZ072R" }, "280 Log Landing St, Inlet Beach");
  await upd("Jennifer Gaines", { email: "jennlgaines@yahoo.com", phone: "(334) 805-7777", community: "Naturewalk", planName: "Plant watering monthly", planAmount: 105, cadence: "MONTHLY", startDate: d(2026, 6, 10), squareCustomerId: "NQ5PQTHTAW3RKGS1J5DHN4SP38" }, "12 Ravine Rd, Inlet Beach");
  await upd("Eric Bohnert", { email: "ebohnert@hotmail.com", phone: "(502) 767-1240" });

  // Rocky's access codes came from his Square customer note
  const rocky = await prisma.client.findFirst({ where: { name: "Rocky Tse" }, include: { properties: true } });
  if (rocky?.properties[0]) {
    await prisma.property.update({
      where: { id: rocky.properties[0].id },
      data: { gateCode: "0062", doorCode: "0062", notes: "Shoes off inside. Owner based in Atlanta, on site 4 to 5 times a year." },
    });
  }
  console.log("enrichment done");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
