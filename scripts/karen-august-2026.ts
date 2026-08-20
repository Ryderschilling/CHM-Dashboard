/**
 * Karen Morabito, August 2026 partial month. Agreed by text 8/14/26.
 *
 *   npx tsx scripts/karen-august-2026.ts
 *
 * WHAT SHE AGREED
 *   Two visits only, Tue 8/18 and Tue 8/25, $100 total for the month.
 *   Both days: walk the yard, confirm the zones are running, send photos.
 *   ONE of the two days: go inside and do the full check.
 *   Normal $200/mo on Tuesdays starts September.
 *
 * WHY THE JOBS CARRY AN EXPLICIT $50
 *   lib/jobValue.ts dilutes planAmount across that client's visits in the
 *   month, so 2 visits against a $200 plan would read $100 a visit and August
 *   would book $200. She is paying $100. An explicit chargeAmount always wins
 *   over the plan allocation, so $50 on each of the two jobs makes the month
 *   total exactly match the invoice. Do NOT put a charge on her September
 *   jobs, those go back to plan dilution.
 *
 * Idempotent. Re-running updates the same rows instead of stacking duplicates.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL = "klmorabito@bellsouth.net";

/** Central time, so these land on the right day whatever the server runs in. */
const YARD_DAY = new Date("2026-08-18T09:00:00-05:00");
const INTERIOR_DAY = new Date("2026-08-25T09:00:00-05:00");

const YARD_STEPS = [
  "Walk the yard and confirm every zone is actually running",
  "Photos of the lawn and any dry spots, send to Karen the same day",
  "Anything off: text Karen and Zach Major at Anchor. Look, do not adjust.",
];

const INTERIOR_STEPS = [
  "Flush all 4 toilets",
  "Damp-Rid in her closet and on the front bedroom door handles, throw out ONLY the completely full bags",
  "Clear the debris off the very top of the rain chain on the porch. Ladder is in the office closet, the bedroom with the couch.",
  "Check the mail",
];

/** Her house, trimmed. No pool, and the lines she actually asked for. */
const HER_CHECK_AREAS: { label: string; category: string }[] = [
  { label: "All 4 toilets flushed", category: "Interior" },
  { label: "Damp-Rid bags, closet and front bedroom door handles", category: "Interior" },
  { label: "Kitchen, under sink and dishwasher line", category: "Interior" },
  { label: "Primary bath, under sink and toilet base", category: "Interior" },
  { label: "Guest baths, under sink and toilet base", category: "Interior" },
  { label: "Laundry, washer hoses and pan", category: "Interior" },
  { label: "Ceilings and walls, staining or bubbling", category: "Interior" },
  { label: "Flooring, cupping or soft spots", category: "Interior" },
  { label: "Odor, mustiness or standing humidity", category: "Interior" },
  { label: "Bar area, contractor work in progress", category: "Interior" },

  { label: "Water heater and drain pan", category: "Systems" },
  { label: "HVAC running, air temperature at vent", category: "Systems" },
  { label: "HVAC condensate line and drain pan", category: "Systems" },
  { label: "Thermostat setting and humidity reading", category: "Systems" },
  { label: "Main water shutoff and pressure", category: "Systems" },
  { label: "Electrical panel, no tripped breakers", category: "Systems" },
  { label: "Irrigation zones running, every zone", category: "Systems" },
  { label: "Reclaimed water filter, clean or clogged", category: "Systems" },

  { label: "Rain chain, top clear of debris", category: "Exterior" },
  { label: "Gutters and drainage away from foundation", category: "Exterior" },
  { label: "Exterior doors, locks and weather seals", category: "Exterior" },
  { label: "Screens, lanai and outdoor furniture", category: "Exterior" },
  { label: "Lawn condition, dry or browning areas", category: "Exterior" },

  { label: "No signs of entry or tampering", category: "Security" },
  { label: "No pest or rodent activity", category: "Security" },
  { label: "Mail collected", category: "Security" },
  { label: "Trash bins in correct position", category: "Security" },
];

/** Open loops that must not quietly disappear. */
const FOLLOW_UPS: { title: string; due: string; priority: "HIGH" | "NORMAL"; notes: string }[] = [
  {
    title: "Send Karen's $100 August invoice in Square",
    due: "2026-08-14T17:00:00-05:00",
    priority: "HIGH",
    notes:
      "Promised to her by text on the afternoon of 8/14. Two visits, 8/18 and 8/25, $100 total. Regular $200 invoicing starts September.",
  },
  {
    title: "Put Karen's recurring Tuesday visit on Google Calendar, starting September",
    due: "2026-08-26T09:00:00-05:00",
    priority: "HIGH",
    notes:
      "August 18 and 25 already exist as jobs in CHM. Do not add those two to the calendar as well or the sync will duplicate them.",
  },
  {
    title: "Change Karen's lockbox code after the bar contractor finishes",
    due: "2026-08-31T09:00:00-05:00",
    priority: "NORMAL",
    notes:
      "She gave the key code to a contractor doing bar work starting Mon 8/17/26. Code is currently 13.",
  },
  {
    title: "Confirm mail pickup is inside Karen's $200 from September",
    due: "2026-08-26T09:00:00-05:00",
    priority: "NORMAL",
    notes:
      "It was in her original 7/31 ask and it is in the 8/25 interior visit, but it was never confirmed as part of the monthly. Settle it before it becomes an assumed freebie.",
  },
  {
    title: "Agree an end date on Karen's locked $200 rate",
    due: "2026-09-01T09:00:00-05:00",
    priority: "NORMAL",
    notes:
      "Buddy's lock is 12 months. Hers has no term, so it is a promise with no expiry and no commitment from her.",
  },
];

async function main() {
  const client = await prisma.client.findFirst({
    where: {
      OR: [
        { email: EMAIL },
        { name: { contains: "Morabito", mode: "insensitive" } },
        { name: { contains: "Moribito", mode: "insensitive" } },
      ],
    },
    include: { properties: { include: { checkAreas: true } } },
  });

  if (!client) {
    throw new Error("Karen not found. Run scripts/add-karen-morabito.ts first.");
  }

  // ---------------------------------------------------------------- client
  await prisma.client.update({
    where: { id: client.id },
    data: {
      status: "ACTIVE",
      startDate: client.startDate ?? YARD_DAY,
      planName: "Irrigation watch + home check",
      notes: [
        "DEAL: $200/mo, rate locked, agreed in person 8/4/26.",
        "AUGUST 2026 IS A $100 PARTIAL MONTH, agreed by text 8/14/26. Two visits only, 8/18 and 8/25.",
        "Full $200/mo on Tuesdays starts September.",
        "",
        "AUGUST SCOPE: both days walk the yard, confirm zones are running, send photos.",
        "One of the two days go inside: flush all 4 toilets, throw out only the completely full Damp-Rid bags",
        "(her closet and the front bedroom door handles), clear the top of the rain chain (ladder in the office",
        "closet, the bedroom with the couch), check the mail. Ryder put the interior day on 8/25.",
        "",
        "IRRIGATION IS ZACH'S NOW. Anchor Lawn and Landscape, Zach Major, took over the lawn and the irrigation.",
        "His position, relayed by Karen 8/14: he is fine with Ryder LOOKING, he does not want anything adjusted",
        "unless he is told first. So Ryder is the eyes, never the fixer. Report to Karen and Zach, touch nothing.",
        "Zach also cleaned the filter on 8/12, so the outdoor visit is now eyes-only.",
        "",
        "WHAT CARRIES THE $200 FROM HERE: the interior check plus reporting she can actually read from Atlanta.",
        "Photos every visit, and say WHAT was checked, not just that he showed up. The trust is the product.",
        "She has fired two companies already and apologized for it herself on 8/14. Reassure, never agree that",
        "her house is complicated.",
        "",
        "ACCESS: lockbox code 13, screened-in back porch. She gave the code to a bar contractor starting 8/17/26,",
        "so change it once that job wraps. Ladder lives in the office closet.",
        "",
        "IRRIGATION FILTER INSTALL: Dan the handyman, paid direct by Karen, pass-through, nothing on CHM books.",
        "",
        "OPEN: mail pickup not confirmed inside the $200 from September. OPEN: locked rate has no end date.",
        "",
        "Part-time resident, home base Atlanta. Husband is part of money decisions. Slow to reply when hosting.",
        "The Pines. Same street as the Birlings at 204 E Firethorn, close to Buddy Norman at 259 W Firethorn.",
      ].join("\n"),
    },
  });

  // -------------------------------------------------------------- property
  const prop =
    client.properties.find((p) => p.address.toLowerCase().includes("firethorn")) ??
    client.properties[0];

  if (prop) {
    await prisma.property.update({
      where: { id: prop.id },
      data: {
        doorCode: "13",
        keyLocation: "Lockbox on the screened-in back porch, code 13",
        notes: [
          "Reclaimed water irrigation, drip lines clog badly. Anchor Lawn and Landscape (Zach Major) owns the",
          "irrigation settings and the filter as of 8/14/26. Look, do not adjust.",
          "Ladder is in the office closet, the bedroom with the couch. Used for the rain chain on the porch.",
          "Damp-Rid hangs in her closet and on the front bedroom door handles.",
          "Bar contractor working inside from Mon 8/17/26, he has the key code.",
        ].join(" "),
      },
    });

    // Her own checklist, only if the property does not have one yet.
    if (prop.checkAreas.length === 0) {
      await prisma.propertyCheckArea.createMany({
        data: HER_CHECK_AREAS.map((a, i) => ({
          propertyId: prop.id,
          label: a.label,
          category: a.category,
          sortOrder: i,
        })),
      });
      console.log("  seeded " + HER_CHECK_AREAS.length + " check areas on " + prop.address);
    } else {
      console.log("  left the existing " + prop.checkAreas.length + " check areas alone");
    }
  }

  // ------------------------------------------------------------------ jobs
  const visits = [
    {
      date: YARD_DAY,
      title: "Irrigation watch + photos",
      steps: YARD_STEPS,
      durationMin: 30,
      notes: "Yard only. Zones running, photos to Karen, report anything off to Zach.",
    },
    {
      date: INTERIOR_DAY,
      title: "Irrigation watch + full interior check",
      steps: [...YARD_STEPS, ...INTERIOR_STEPS],
      durationMin: 75,
      notes: "The interior day for August. Full write-up, this is the visit that carries the month.",
    },
  ];

  for (const v of visits) {
    const dayStart = new Date(v.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const existingJob = await prisma.job.findFirst({
      where: { clientId: client.id, date: { gte: dayStart, lt: dayEnd } },
    });

    const jobData = {
      clientId: client.id,
      propertyId: prop?.id ?? null,
      title: v.title,
      jobType: "Home watch",
      date: v.date,
      durationMin: v.durationMin,
      // See the header comment. 50 x 2 = the 100 she is actually invoiced.
      chargeAmount: 50,
      location: prop?.address ?? "149 E Firethorn Circle, Inlet Beach, FL 32461",
      notes: v.notes,
      status: "SCHEDULED" as const,
    };

    const job = existingJob
      ? await prisma.job.update({ where: { id: existingJob.id }, data: jobData })
      : await prisma.job.create({ data: jobData });

    // Steps, matched by title so a re-run does not stack them.
    for (const [i, title] of v.steps.entries()) {
      const step = await prisma.task.findFirst({ where: { jobId: job.id, title } });
      if (!step) {
        await prisma.task.create({
          data: {
            title,
            jobId: job.id,
            clientId: client.id,
            priority: i < 3 ? "HIGH" : "NORMAL",
          },
        });
      }
    }

    console.log(
      "  " +
        (existingJob ? "updated" : "created") +
        " " +
        v.date.toISOString().slice(0, 10) +
        "  " +
        v.title +
        "  (" +
        v.steps.length +
        " steps)",
    );
  }

  // ------------------------------------------------------------ follow ups
  for (const f of FOLLOW_UPS) {
    const found = await prisma.task.findFirst({
      where: { clientId: client.id, title: f.title },
    });
    if (found) continue;
    await prisma.task.create({
      data: {
        title: f.title,
        clientId: client.id,
        dueDate: new Date(f.due),
        priority: f.priority,
        notes: f.notes,
      },
    });
    console.log("  task: " + f.title);
  }

  // ------------------------------------------------------------------- log
  const LOG =
    "8/14/26 text: August set to 2 visits (8/18, 8/25) for $100, interior check on one of them, normal $200 Tuesdays from September. Zach at Anchor owns the irrigation settings, Ryder looks but does not adjust.";
  const loggedAlready = await prisma.note.findFirst({
    where: { clientId: client.id, body: { contains: "August set to 2 visits" } },
  });
  if (!loggedAlready) {
    await prisma.note.create({ data: { clientId: client.id, body: LOG } });
  }

  console.log("\n  Karen Morabito is ACTIVE. August books $100 across 2 visits.");
  console.log("  NOTE: no Payment row was created. Square sync owns invoices, so a hand-made");
  console.log("  row would double up once you send the real one. The task list has the reminder.");
  console.log("\n  http://localhost:3005/clients/" + client.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
