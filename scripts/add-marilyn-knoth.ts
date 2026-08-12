/**
 * Create Marilyn Knoth: Villas at Longleaf, bi-weekly Home Watch, starts Nov 2026.
 *
 *   npx tsx scripts/add-marilyn-knoth.ts
 *
 * Idempotent. Matches on her email or the Knoth surname so a second run
 * updates the same row instead of making a duplicate.
 *
 * NON-DESTRUCTIVE on the two fields Ryder controls by hand:
 *   - `status` is only set at creation (LEAD today, flip to ACTIVE once the
 *     window is agreed in October and the first invoice goes out).
 *   - `startDate` likewise, seeded to 11/1/26 at creation and never rewritten.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL = "marilynknoth@gmail.com";

async function main() {
  const existing = await prisma.client.findFirst({
    where: {
      OR: [
        { email: EMAIL },
        { name: { contains: "Knoth", mode: "insensitive" } },
      ],
    },
    include: { properties: true },
  });

  // Safe to overwrite on every run.
  const shared = {
    name: "Marilyn Knoth",
    email: EMAIL,
    phone: "(270) 227-3897",
    altContact:
      "Emails from an iPhone and replies fast, usually within a few hours. Cell takes texts. She is the only decision maker on record.",
    community: "Villas at Longleaf, Inlet Beach",
    planName: "Home Watch, bi-weekly",
    planAmount: 135,
    visitsPerMonth: 2,
    cadence: "MONTHLY" as const,
    lockedRate: false,
    source:
      "Inbound cold email to the CHM inbox 8/4/26, found CHM on her own. Source unknown, most likely the website or Google.",
    notes: [
      "AGREED IN EMAIL 8/6/26, NOT SIGNED AND NOT BILLING YET. Bi-weekly Home Watch at $135/mo. List is $150; the $15 came off for the 12-month agreement.",
      "",
      "THE STRUCTURE, which is the whole deal: the twelve billed months PAUSE during the roughly five months she is in residence, then resume. Ryder's words to her were \"you could schedule 7 and then pause it for five, then start again for the last 5\". She replied \"That is exactly how I hoped the 12 months would work\".",
      "",
      "WHAT THAT ACTUALLY MEANS: 12 billed months spread across about 17 calendar months. $1,620 total arriving over 17 months, so an effective $95/mo, and no continuous-year lock. It is a seasonal deal at the price quoted for a continuous year. Ryder was shown this math and accepted it. Do not re-open it with her. The lesson for the next seasonal owner is that pause-and-resume terms should hold list price, because the discount is what pays for continuity.",
      "",
      "OPS PROBLEM TO SOLVE BEFORE BILLING STARTS: Square subscriptions cannot pause and resume on a schedule. Plan is a roughly 7-month series, cancel at the end, then create a new roughly 5-month series when she comes back. SET A CALENDAR REMINDER FOR THE RESTART or it silently never resumes and the revenue quietly stops.",
      "",
      "TIMELINE: inbound 8/4, quote same day, soft follow-up 8/6 morning, she replied interested 8/6 afternoon, terms agreed 8/6. She is in and out Aug through Oct getting the place ready. She sets her dates in OCTOBER and will make contact then, and wants to meet at that point. Monitoring starts NOVEMBER 2026.",
      "",
      "THE EXACT PAUSE MONTHS ARE NOT DEFINED YET. Pin them down in writing at the October meeting or the pause goes ad hoc and this degrades into month-to-month.",
      "",
      "PLAN MATH: $135 over 2 visits a month is $67.50 a visit before drive time.",
      "",
      "ROUTE: Villas at Longleaf is Inlet Beach, NOT Watersound Origins or Naturewalk. It is off the Tuesday Firethorn and Windrow loop. Small home so a quick stop, but the drive is the real cost at $135. Watch dollars per hour on /time once visits start.",
      "",
      "NEW BUILD, roughly 1,400 sq ft, so year one is the builder warranty window. Anything caught early (settling, a slow supply line, a condensate drain backing up) may be the builder's cost rather than hers. This was part of the original pitch and is a real reason bi-weekly is worth it to her.",
      "",
      "FIRST UPSELL: Annual Coverage Record, $195/yr. She is an out-of-state absentee owner of a brand new home, which is exactly who that record is for.",
    ].join("\n"),
  };

  const client = existing
    ? // status and startDate deliberately absent: his call, not the script's.
      await prisma.client.update({ where: { id: existing.id }, data: shared })
    : await prisma.client.create({
        data: {
          ...shared,
          status: "LEAD",
          startDate: new Date("2026-11-01T00:00:00"),
        },
      });

  const address = "Villas at Longleaf, Inlet Beach, FL";
  const propData = {
    label: "Main home",
    address,
    notes: [
      "New build, roughly 1,400 sq ft. She occupies it about five months of the year, winter plus random trips.",
      "EXACT STREET ADDRESS NOT KNOWN YET. She has only ever said \"the villas at Longleaf inlet beach\". Get the street address, and all access details (keys, gate or community code, alarm code and alarm company, wifi, water shutoff location, who else has access), at the October meeting.",
    ].join(" "),
  };

  const prop = existing?.properties.find((p) =>
    p.address.toLowerCase().includes("longleaf"),
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
  console.log(`  She sends dates in Oct 26, monitoring starts Nov 26, 12 billed months with a ~5 month pause`);
  console.log(`\n  http://localhost:3005/clients/${client.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
