# CHM Ops

Private command center for Coastal Home Management 30A. Clients, access codes, money in and out, jobs, labor spreads, team, and tasks. One password, one database, everything in one place.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind 4
- Prisma + Neon Postgres (already connected via `.env`)
- No other services. Auth is a single password checked in middleware.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 and enter the password from `.env` (`DASHBOARD_PASSWORD`). The database is already set up and seeded with your real clients, so it works immediately.

## Deploy to Vercel

1. Push this folder to a new GitHub repo (keep `.env` out, it is gitignored).
2. Import the repo in Vercel under ryder-schillings-projects.
3. Add these environment variables in Vercel project settings:
   - `DATABASE_URL` (from `.env`)
   - `DIRECT_URL` (from `.env`)
   - `DASHBOARD_PASSWORD` (pick a strong one for production)
4. Deploy. Done.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Run locally |
| `npm run build` | Production build |
| `npm run db:push` | Push schema changes to the database |
| `npm run db:seed` | Wipe and re-seed (careful: deletes all data) |

## How the pieces fit

- **Dashboard** - MRR, collected, outstanding, profit, charts, what needs attention.
- **Clients** - every client, their plan, what they owe. Click one for the full file: contact, properties with gate/door/alarm/wifi codes (tap to reveal), payments, jobs, tasks, activity log.
- **Money** - payments ledger by month plus every unpaid item, and an expenses tab. "Mark paid" moves money from outstanding to collected.
- **Jobs** - schedule work, assign it to you or a worker, set labor cost and charge. Spread = charge minus labor. Marking a job done can drop the charge onto the client's tab automatically.
- **Team** - per-worker: jobs done, pay, revenue on their jobs, your spread. Plus you-vs-team split and a payout log.
- **Tasks** - the business to-do list, overdue flagged, linkable to clients.

## MRR logic

MRR = sum of plan amounts for ACTIVE clients billed MONTHLY. Chris Lambert and Becky Portera are seeded without amounts (unknown), so open their pages and hit Edit to fill them in.

## Square sync (read-only, built in)

The Money page has a "Sync Square" button. It pulls every invoice and customer from Square and mirrors them here: paid invoices become collected revenue, unpaid and scheduled ones show under Waiting On, new Square customers become clients. The app only ever READS from Square. It never creates, edits, or sends anything.

To turn it on:
1. Go to https://developer.squareup.com/apps and sign in with your Square account.
2. Create an application (call it "CHM Ops"), open it, and copy the Production Access Token.
3. Paste it into `.env` as `SQUARE_ACCESS_TOKEN`. `SQUARE_LOCATION_ID` is already set to your Coastal Home Care location.
4. Restart the app and hit Sync Square on the Money page.

Your full Square history (65 invoices back to Nov 2025) is already loaded in the database, so sync just keeps it current going forward. Run it whenever you want fresh numbers. Note: Square is the source of truth for its own invoices, so mark those paid in Square, not here. Manual entries (cash, Venmo, checks) are yours and sync never touches them.

## Google Calendar (read-only, built in)

The dashboard's Coming Up card merges your calendar with scheduled jobs.

To turn it on:
1. Google Calendar on desktop > Settings > click your calendar on the left > "Integrate calendar".
2. Copy the "Secret address in iCal format".
3. Paste it into `.env` as `GOOGLE_CALENDAR_ICS_URLS`. Multiple calendars: separate with commas.
4. Restart the app. Events show for the next 10 days, refreshed every 10 minutes.

Read-only. The app cannot add, change, or delete calendar events.

## One rule

Never put unlayered CSS in `globals.css`. Everything lives in `@layer base` or `@layer components`, same rule as the public site.
