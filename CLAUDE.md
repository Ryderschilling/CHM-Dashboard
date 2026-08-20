# CHM Ops — rules for AI assistants working on this codebase

Internal business platform for Coastal Home Management 30A (Ryder Schilling).
It runs his real business with live data. Treat every change as production.

## Run / dev

- Start the app by running `./START-CHM-OPS.command` (or double-click it).
  It installs deps, regenerates the Prisma client, starts `next dev -p 3005`,
  and opens the browser when the server answers.
- The app lives at **http://localhost:3005**. Ports 3000/3001 are graveyard
  zombies from old copies; never use them.
- Login password is `DASHBOARD_PASSWORD` in `.env`.
- After ANY change to `prisma/schema.prisma`, restart via the launcher so
  `prisma generate` runs.

## Hard rules

1. **Stay on Prisma 6.** Prisma 7 rejects this schema's datasource block. Do
   not run `npm i prisma@latest`.
2. **Never run `npm run db:seed`.** The seed script wipes the database, and
   the database now holds live mirrored Square history and real client data.
3. **Square and Google Calendar are READ-ONLY.** The app must never create,
   edit, send, or delete anything in Square or on the calendar. Sync only.
4. **Never commit or overwrite `.env`.** It holds live secrets (Neon URLs,
   Square token, calendar secret address). It is gitignored; keep it that way.
5. **All custom CSS goes inside `@layer base` or `@layer components`** in
   `src/app/globals.css`. Unlayered CSS silently beats Tailwind utilities and
   has broken things before.
6. **New files in `public/` must be added to the middleware matcher** in
   `src/middleware.ts`, or the auth gate 307s them to /login.
7. **No em-dashes anywhere**: UI copy, comments, docs. Ryder's rule.
7a. **The insurance language rule. Never cross this line.** CHM sells two
   claim-protection services (Water Shutoff Protection, Annual Coverage
   Record) and neither one lowers anybody's insurance premium. Verified
   August 2026: no US carrier gives a discount for a home watch service.
   In anything that could reach a client, never say or imply that CHM
   lowers, reduces, or discounts a premium; never say "second insurance";
   never say a carrier requires, endorses, or approves CHM; never call a
   visit an "inspection" (home inspection is a licensed profession under
   Fla. Stat. 468.8311 and practicing without the license is a first-degree
   misdemeanor under 468.8319, so use visit, walkthrough, check, condition
   report); never give advice about anyone's coverage. What IS true: the
   shutoff DEVICE carries a published premium credit at some carriers
   (PURE among them), which is the client's carrier's doing and attaches to
   the device, not to us. The full rule with citations lives in the public
   site repo at `src/data/protection.ts`. Read it before writing copy.
8. Convert Prisma `Decimal` with `num()` (src/lib/format.ts) before passing
   values to client components.
9. All displayed dates/times render in America/Chicago via `fmtDate`/`fmtTime`.
   Keep it that way; the server may run in UTC (Vercel).

## Visit reports and the printed record

- **Report a visit** is the main daily action. Buttons on the Dashboard, Jobs,
  and /visits. The form loads that PROPERTY's own checklist
  (`PropertyCheckArea`), every line pre-set to **Dry / good**. Ryder only taps
  what is not. Notes only appear on a line marked Needs attention.
- Each property's checklist is edited from the **Checklist** button on its
  PropertyCard. Seed it from `src/lib/checkAreas.ts`, then trim it to the house
  (no pool line on a house with no pool).
- `VisitFinding.label` is a **snapshot** taken at report time. Renaming an area
  later must never rewrite what a past record says. Do not "fix" this.
- **DRAFT reports are excluded from the annual record on purpose.** A
  half-finished write-up must not reach a document a client could hand an
  adjuster.
- **Money and time flow into the EXISTING model, never a parallel one.** Saving
  a report calls `syncJobFromReport` (writes laborHours, laborCost,
  chargeAmount, status DONE onto the Job, creating one if the visit was not on
  the calendar) and `syncExpenseFromReport` (materials become a SUPPLIES
  Expense, tagged `[visit] <reportId>` in the description so a re-save replaces
  rather than stacks). Do not add a second accounting path.
- **Photos are `Bytes` in Postgres**, served by `/api/photo/[id]`. One source
  of truth across localhost and Vercel, no storage account to set up. The form
  downscales to 1400px / JPEG 0.7 **in the browser** (`src/lib/photo.ts`), so a
  photo is roughly 120-180KB. /visits shows total storage used. If that
  approaches the Neon plan limit, move `data` to Vercel Blob and keep the row.
- **PDFs are print views, not a PDF library.** `/print/visit/[id]` and
  `/print/coverage/[id]` render branded HTML with `src/app/print/print.css`,
  and Ryder hits Cmd+P then Save as PDF. This is deliberate: it honors the
  no-extra-libraries rule and gives better typography and exact brand fidelity
  than any JS PDF generator. Palette and type match the public site exactly
  (paper #ffffff, ink #0a0a0a, muted #56565c, teal #0d7f79, Archivo +
  Instrument Sans). The letterhead is typographic on purpose: `chm-logo.png`
  is a white mark and vanishes on white paper.
- The Annual Coverage Record assembles itself from every FINAL report in the
  period plus that client's shutoff alerts. Nothing in it is typed by hand.
  `LEGAL_DISCLAIMER` from `src/lib/brand.ts` is on every printed page and stays
  there.

## Domain semantics (do not change without asking Ryder)

- Payment.status: `UPCOMING` = scheduled/draft in Square, not sent yet.
  `DUE` = sent, unpaid. `PAID` = paid. **Overdue is computed** (DUE + past
  dueDate), never stored. "Outstanding"/"owed" math counts DUE only.
- Job: `workerId null` means Ryder did it. spread = chargeAmount − laborCost.
- Expense: may link to a payment (per-invoice profit) and/or a client
  (per-client costs). Attaching to a payment auto-inherits the client.
- Monthly profit = collected − labor on DONE jobs − expenses. Same expense
  rows power per-invoice nets; nothing is double-counted.
- Money mental model: pay PEOPLE on the Job, pay for STUFF on the invoice.

## Design system

Dark UI only. bg #0a0a0b, surfaces #131316/#18181d/#1f1f26, teal accent
#2fd4c4 (UI chrome only, use sparingly). Chart series colors are
CVD-validated for the dark surface: #12a396 and #b08226; don't invent new
series colors casually. Fonts: Archivo (display, uses width axis) +
Instrument Sans (body) via next/font. Logo: `public/chm-logo.png` (white
mark, transparent). Animations are CSS-only; no motion or chart libraries.

## Integrations

- Square sync: `src/lib/square.ts`, triggered by the Sync button on /money.
  Upserts by `squareInvoiceId`; user-set `category` is preserved on update.
- Calendar: `src/lib/gcal.ts` reads the secret ICS URLs, merges events into
  the dashboard's Coming Up list. 10-minute fetch cache.

## Deploy target (when Ryder says go)

Vercel, team ryder-schillings-projects. Env vars needed: DATABASE_URL,
DIRECT_URL, DASHBOARD_PASSWORD (change it), SQUARE_ACCESS_TOKEN,
SQUARE_LOCATION_ID, GOOGLE_CALENDAR_ICS_URLS. See README.md.

---

## Saving to context (hard rule)

1. Immediately before ANY project_memory_write, re-read the file.
   Never write from a copy loaded earlier in the session.
2. Never rewrite an existing topic file to add something new.
   Create a new topic file instead: topic_YYYY-MM-DD.md
3. MEMORY.md: re-read it, then append exactly one index line.
   Never reorder, reformat, or prune other lines in the same write.
4. If the re-read shows content you did not expect, STOP.
   Report the difference to Ryder before writing anything.

Reason: every chat in a project writes to the same memory files, and a
write overwrites the whole file. Two chats saving at once can silently
erase each other. Only run "save to context" in one chat at a time.
