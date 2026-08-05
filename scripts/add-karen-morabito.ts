/**
 * Fill in Karen Morabito's record: plan terms, access codes, property, notes.
 *
 *   npx tsx scripts/add-karen-morabito.ts
 *
 * Idempotent and deliberately NON-DESTRUCTIVE on the two fields Ryder controls
 * by hand:
 *   - `status` is only set when creating the row. If she already exists, her
 *     status is left exactly as he set it (Lead today, Active once the first
 *     invoice goes out).
 *   - `startDate` likewise. The script never wipes a start date he entered.
 *
 * Matches on her email or either spelling of her last name, so it updates the
 * row he already made instead of creating a second one.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL = "klmorabito@bellsouth.net";

async function main() {
  const existing = await prisma.client.findFirst({
    where: {
      OR: [
        { email: EMAIL },
        { name: { contains: "Morabito", mode: "insensitive" } },
        { name: { contains: "Moribito", mode: "insensitive" } },
      ],
    },
    include: { properties: true },
  });

  // Everything here is safe to overwrite on every run.
  const shared = {
    name: "Karen Morabito",
    email: EMAIL,
    phone: "(770) 633-1561",
    altContact: "Husband is part of money decisions. iPhone contact is saved as Karen Moribito.",
    community: "Watersound Origins",
    planName: "Irrigation weekly + home watch",
    planAmount: 200,
    visitsPerMonth: 4,
    cadence: "MONTHLY" as const,
    lockedRate: true,
    source: "Neighbor, Watersound Origins. Met in person 7/8/26, closed in person 8/4/26.",
    notes: [
      "DEAL, agreed in person 8/4/26: $200/mo, rate locked. Billing starts the month the irrigation is installed.",
      "Weekly: irrigation check and reclaimed-water filter clean.",
      "Every other week: full house check, skipped when she is in town.",
      "4 trips a month, so each visit carries $50 of the plan.",
      "",
      "IRRIGATION INSTALL: Ryder coordinates and oversees it, she pays Dan (the handyman) direct.",
      "Pass-through, no markup, nothing on CHM books. Dan walked the property with Ryder 8/4/26.",
      "Her husband is 100% in on the filter. She was quoted ~$350 at closing and skipped it.",
      "",
      "WHY SHE HIRED: reclaimed water clogs her drip lines badly. Her words on 7/31: \"Can you tell I really want nothing to do with this?\" Sell total handling, never line items.",
      "",
      "OPEN: mail pickup left in the kitchen was in her original ask. Not confirmed as part of the $200.",
      "OPEN: rate is locked but no end date was agreed.",
      "OPEN: visits go on the calendar once the irrigation is in.",
      "",
      "Part-time resident, home base Atlanta. Slow to reply when hosting guests.",
      "Fired Costa Verde for lawn care 7/31/26. Lawn referred out to Bryan Samson, Green Gate Property Services.",
      "The Pines. Same street as the Birlings at 204 E Firethorn, close to Buddy Norman at 259 W Firethorn. Tight Tuesday loop.",
    ].join("\n"),
  };

  const client = existing
    ? // status and startDate deliberately absent: his call, not the script's.
      await prisma.client.update({ where: { id: existing.id }, data: shared })
    : await prisma.client.create({
        data: { ...shared, status: "LEAD", startDate: null },
      });

  const address = "149 E Firethorn Circle, Inlet Beach, FL 32461";
  const propData = {
    label: "Main home",
    address,
    doorCode: "13",
    keyLocation: "Lockbox on the screened-in back porch, code 13",
    notes: "Reclaimed water irrigation. Drip lines clog badly, filter needs cleaning weekly once installed.",
  };

  const prop = existing?.properties.find((p) => p.address.includes("Firethorn"));
  if (prop) {
    await prisma.property.update({ where: { id: prop.id }, data: propData });
  } else {
    await prisma.property.create({ data: { ...propData, clientId: client.id } });
  }

  const perVisit = Number(client.planAmount) / (client.visitsPerMonth || 1);
  console.log(`${existing ? "Updated" : "Created"} ${client.name}  [status left as ${client.status}]`);
  console.log(`  $${Number(client.planAmount)}/mo over ${client.visitsPerMonth} visits = $${perVisit.toFixed(2)} a visit`);
  console.log(`  ${address} · lockbox 13, screened-in back porch`);
  console.log(`\n  http://localhost:3005/clients/${client.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
