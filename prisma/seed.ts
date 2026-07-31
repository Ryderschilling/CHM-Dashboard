/**
 * Seeds the database with CHM's real current clients, open invoices,
 * worker, and live to-dos as of 2026-07-30. Run: npm run db:seed
 * Safe to re-run: it wipes and rebuilds everything.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function d(y: number, m: number, day: number) {
  return new Date(y, m - 1, day, 12);
}

async function main() {
  // Wipe in dependency order
  await prisma.note.deleteMany();
  await prisma.task.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.job.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.property.deleteMany();
  await prisma.client.deleteMany();
  await prisma.worker.deleteMany();

  const creighton = await prisma.worker.create({
    data: { name: "Creighton", payNote: "Paid per job", active: true },
  });

  const mk = (data: Parameters<typeof prisma.client.create>[0]["data"]) =>
    prisma.client.create({ data });

  const eric = await mk({
    name: "Eric Bohnert",
    status: "ACTIVE",
    community: "Watersound Origins",
    planName: "Essential",
    planAmount: 135,
    cadence: "MONTHLY",
    lockedRate: true,
    lockedUntil: d(2027, 8, 1),
    startDate: d(2026, 8, 1),
    squareCustomerId: "CAM3B15SKFV76P4WVN3V3GGWDG",
    notes: "12-month locked rate at $135/mo (standard $150). Billed via manual monthly Square invoices, due the 1st.",
    properties: { create: { address: "94 Roundwood Dr", label: "Main home" } },
  });

  const rocky = await mk({
    name: "Rocky Tse",
    status: "ACTIVE",
    email: "Rtse12@gmail.com",
    phone: "(770) 490-4107",
    community: "Watersound Origins",
    planName: "Basic (1 visit/mo)",
    planAmount: 100,
    cadence: "MONTHLY",
    startDate: d(2026, 7, 30),
    squareCustomerId: "27XV4EESGTTYGW45CSP1Y5QG64",
    notes: "Off-menu $100/mo tier, one visit per month. No off-scope hourly rate agreed yet. Manual monthly invoices.",
    properties: { create: { address: "90 Anastasia Circle", label: "Main home" } },
  });

  const mel = await mk({
    name: "Mel Martin",
    status: "ACTIVE",
    email: "mmartin@fnbok.bank",
    planName: "A la carte",
    cadence: "PER_VISIT",
    squareCustomerId: "HPC0CQE1BVD86J78A02SYEKN3C",
    notes: "Package bring-in at $30/visit plus contractor meetups. Invoiced after the fact.",
    properties: { create: { address: "72 Rosecourt", label: "Main home" } },
  });

  const chris = await mk({
    name: "Chris Lambert",
    status: "ACTIVE",
    community: "Watersound Origins",
    cadence: "MONTHLY",
    notes: "Recurring via Square invoice series (000024-R pattern). Fill in plan amount for accurate MRR.",
    properties: { create: { address: "12 Windrow", label: "Main home" } },
  });

  const becky = await mk({
    name: "Becky Cowart Portera",
    status: "ACTIVE",
    cadence: "MONTHLY",
    altContact: "Realtor, She Sells Seashells",
    source: "Realtor partner",
    notes: "Recurring via Square invoice series. Also a referral source. Fill in plan amount for accurate MRR.",
  });

  await mk({ name: "Beth Tedesco", status: "ACTIVE", cadence: "AD_HOC", notes: "Google review on file: excellent service, very helpful." });
  await mk({ name: "Barbara Reed", status: "ACTIVE", cadence: "AD_HOC", notes: "Google review on file: gives us peace of mind, highly reliable." });
  await mk({ name: "Scott Clark", status: "ACTIVE", cadence: "AD_HOC", notes: "Testimonial on file: reliable, professional, great to work with." });
  await mk({ name: "Denise and Layne Birling", status: "ACTIVE", cadence: "AD_HOC" });
  await mk({ name: "Buddy Norman", status: "ACTIVE", cadence: "AD_HOC", notes: "Google review on file: expert and professional job, exceptional communication." });
  await mk({ name: "Jennifer Gaines", status: "ACTIVE", cadence: "PER_VISIT", notes: "Plant watering." });

  // Open invoices as of 2026-07-30 (from Square)
  await prisma.payment.createMany({
    data: [
      {
        clientId: mel.id,
        amount: 120,
        status: "DUE",
        dueDate: d(2026, 8, 6),
        method: "SQUARE",
        category: "A_LA_CARTE",
        description: "Package bring-in, 4 visits x $30",
        invoiceNumber: "000055",
      },
      {
        clientId: rocky.id,
        amount: 100,
        status: "DUE",
        dueDate: d(2026, 8, 1),
        method: "SQUARE",
        category: "RETAINER",
        description: "Monthly home watch, Jul 30 to Aug 29",
        invoiceNumber: "000058",
      },
      {
        clientId: eric.id,
        amount: 135,
        status: "DUE",
        dueDate: d(2026, 8, 1),
        method: "SQUARE",
        category: "RETAINER",
        description: "August retainer, 12-month locked rate",
        invoiceNumber: "000053",
      },
    ],
  });

  // Live to-dos
  await prisma.task.createMany({
    data: [
      {
        title: "Send Rocky Tse month-2 invoice in Square",
        priority: "HIGH",
        dueDate: d(2026, 8, 25),
        clientId: rocky.id,
        notes: "No recurring engine attached. Month 2 is due around Sep 1 and must be created by hand.",
      },
      {
        title: "Set a standard per-trip rate for off-scope requests",
        priority: "HIGH",
        clientId: rocky.id,
        notes: "Rocky asked for internet troubleshooting within 24 hours of signing. The $100 tier has no off-scope rate, so extras get absorbed.",
      },
      {
        title: "Decide: publish the $100 one-visit tier or stop quoting it",
        priority: "NORMAL",
        notes: "It sits below the $150 Essential and is not on the website.",
      },
      {
        title: "Fill in plan amounts for Chris Lambert and Becky Portera",
        priority: "NORMAL",
        notes: "Open their client pages and hit Edit. Needed for accurate MRR on the dashboard.",
      },
      {
        title: "Get attorney review of service agreement clawback clause",
        priority: "LOW",
      },
    ],
  });

  await prisma.note.create({
    data: {
      clientId: rocky.id,
      body: "Signed 2026-07-30 over text. $100/mo, one visit per month at 90 Anastasia Circle. Invoice 000058 drafted in Square, sends Aug 1.",
    },
  });

  await prisma.note.create({
    data: {
      clientId: chris.id,
      body: "Recurring billing runs through a Square dashboard invoice series, not the API. Reliable, leave it there.",
    },
  });

  console.log("Seeded: 11 clients, 1 worker, 3 open invoices, 5 tasks.");
  void becky;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
