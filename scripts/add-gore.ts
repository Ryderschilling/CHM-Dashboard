/**
 * Create Nick and Ellisa Gore: Alys Beach, Essential weekly, signing 8/8/26.
 *
 *   npx tsx scripts/add-gore.ts
 *
 * Idempotent. Matches on their email or the Gore surname so a second run
 * updates the same row instead of making a duplicate.
 *
 * NON-DESTRUCTIVE on the two fields Ryder controls by hand:
 *   - `status` is only set at creation (LEAD today, flip to ACTIVE once the
 *     agreement is signed Saturday and the 8/11 invoice goes out).
 *   - `startDate` likewise, seeded to 8/11/26 at creation and never rewritten.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL = "nickandellisa@mac.com";

async function main() {
  const existing = await prisma.client.findFirst({
    where: {
      OR: [
        { email: EMAIL },
        { name: { contains: "Gore", mode: "insensitive" } },
        { name: { contains: "Gole", mode: "insensitive" } },
      ],
    },
    include: { properties: true },
  });

  // Safe to overwrite on every run.
  const shared = {
    name: "Nick and Ellisa Gore",
    email: EMAIL,
    phone: "(347) 233-0795",
    altContact:
      "Ellisa is the decision maker and lives in Sydney, Australia, so her texts land overnight US time. Nick is US time zone. iPhone contact saves as \"Nick And Ellisa Gole\", the surname is Gore.",
    community: "Alys Beach",
    planName: "Essential, weekly",
    planAmount: 150,
    visitsPerMonth: 4,
    cadence: "MONTHLY" as const,
    lockedRate: false,
    source:
      "Inbound email to the CHM inbox 7/12/26, found CHM on their own. Switching from another manager they had used for years.",
    notes: [
      "QUOTED $150/mo on the 7/13/26 phone call, which was the Essential list price at the time. The 7/31/26 raise took Essential to $200. HONOR THE $150. It is not a discount, it is the number he was given.",
      "",
      "PLAN: Essential, one visit a week, 4 visits a month, so $37.50 of the plan per visit before drive time.",
      "12-month lock offered at $140/mo, their pick at signing. Update planAmount, lockedRate and lockedUntil (8/10/27) if they take it.",
      "",
      "PHOTOS AFTER EVERY VISIT are included, but Section 2 of the signed agreement calls them a founding-client courtesy that is NOT part of the Essential Plan and can end at renewal. This protects Home Watch, whose headline feature is photo docs plus written reports. Do not quietly promote this to a plan feature.",
      "",
      "TIMELINE: inbound 7/12, call 7/13, walkthrough at the house 7/16, they gave notice to their old manager 8/4, key handover and signing Saturday 8/8, first invoice Tuesday 8/11 and monthly on the 11th after that.",
      "",
      "ROUTE: Alys Beach is OUTSIDE the Watersound Origins and Naturewalk Tuesday loop. This is a standalone weekly drive, so watch dollars per hour on /time once visits start.",
      "",
      "FIRST UPSELL: Annual Coverage Record, $195/yr. They are absentee owners in a different hemisphere, which is exactly who that record is for.",
      "",
      "They have owned the house since 2015. Switching managers after that long was not a small decision for them, so over-communicate early.",
    ].join("\n"),
  };

  const client = existing
    ? // status and startDate deliberately absent: his call, not the script's.
      await prisma.client.update({ where: { id: existing.id }, data: shared })
    : await prisma.client.create({
        data: {
          ...shared,
          status: "LEAD",
          startDate: new Date("2026-08-11T00:00:00"),
        },
      });

  const address = "54 Seven Wells Ct, Alys Beach, FL 32461";
  const propData = {
    label: "Main home",
    address,
    notes: [
      "Grey shutters.",
      "Access details get filled in at the Saturday 8/8/26 handover: keys, gate or community code, alarm code and alarm company, wifi, water shutoff location, and who else has access.",
    ].join(" "),
  };

  const prop = existing?.properties.find((p) =>
    p.address.toLowerCase().includes("seven wells"),
  );
  if (prop) {
    await prisma.property.update({ where: { id: prop.id }, data: propData });
  } else {
    await prisma.property.create({ data: { ...propData, clientId: client.id } });
  }

  const perVisit = Number(client.planAmount) / (client.visitsPerMonth || 1);
  console.log(`${existing ? "Updated" : "Created"} ${client.name}  [status left as ${client.status}]`);
  console.log(`  $${Number(client.planAmount)}/mo over ${client.visitsPerMonth} visits = $${perVisit.toFixed(2)} a visit`);
  console.log(`  ${address}`);
  console.log(`  Signing Sat 8/8/26, first invoice Tue 8/11/26`);
  console.log(`\n  http://localhost:3005/clients/${client.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
