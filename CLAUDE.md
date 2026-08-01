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
8. Convert Prisma `Decimal` with `num()` (src/lib/format.ts) before passing
   values to client components.
9. All displayed dates/times render in America/Chicago via `fmtDate`/`fmtTime`.
   Keep it that way; the server may run in UTC (Vercel).

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
