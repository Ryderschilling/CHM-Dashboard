/**
 * Copy the old decimal Job.laborHours into the new whole-minute
 * Job.laborMinutes. Idempotent: a row that already has minutes is left alone.
 *
 *   npx tsx scripts/backfill-labor-minutes.ts
 *
 * Run it once, right after `npx prisma db push` adds the column.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.job.findMany({
    where: { laborMinutes: null, NOT: { laborHours: null } },
    select: { id: true, title: true, date: true, laborHours: true },
    orderBy: { date: "asc" },
  });

  if (!rows.length) {
    console.log("Nothing to backfill. Every job with time on it already has minutes.");
    return;
  }

  let done = 0;
  for (const r of rows) {
    const hours = Number(r.laborHours);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    const minutes = Math.round(hours * 60);
    await prisma.job.update({ where: { id: r.id }, data: { laborMinutes: minutes } });
    done++;
    console.log(`${r.date.toISOString().slice(0, 10)}  ${r.title}  ${hours}h -> ${minutes}m`);
  }

  console.log(`\nBackfilled ${done} job${done === 1 ? "" : "s"}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
