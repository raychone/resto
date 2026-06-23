# Supabase setup for production

## Why you need it

Right now the app still persists most data in local JSON files under `data/`.
That works for local development, but it is not a safe production database on Vercel.

On Vercel:
- filesystem writes are not a reliable database
- data can be lost between deploys / cold starts
- concurrent writes are fragile

If you want the app to be production-safe, Supabase is the next step.

## What to create in Supabase

1. Create a new Supabase project.
2. Go to **Settings → API Keys**.
3. Copy the `anon public key`.
4. Copy the `service_role key`.
5. Use the project ref to build the URL:
   `https://<project-ref>.supabase.co`
6. Enable authentication if you want email/password or Google login.
7. Apply the SQL migration in `supabase/migrations/0001_init.sql`.
8. Load the seed snapshot from `supabase/seed.sql`.

## Environment variables

Add these values to `.env.local` locally and to Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Keep the existing variables too:

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Current limitation

This repo is not yet fully migrated to Supabase.

That means:
- the app still reads/writes local JSON files in development
- production on Vercel still needs a real DB layer to be safe

So the correct order is:
1. create the Supabase project
2. add the env vars
3. migrate the stores one by one

## Suggested migration order

Migrate in this order:

1. `restaurants`
2. `users`
3. `customers`
4. `tables`
5. `table_sessions`
6. `orders`
7. `payments`
8. `reservations`
9. `messages`
10. `audit`
11. `billing`

## What I would do next in code

The safest implementation is:

- add a small Supabase client wrapper in `src/lib/supabase.ts`
- replace the JSON-file stores with Supabase-backed repositories
- keep the current seed scripts for local dev
- keep the same business logic and UI
- only swap persistence

### Current quick-start

If you want the current state copied into Supabase as-is:

```bash
npm run supabase:seed
```

Then:

1. Open `supabase/seed.sql`
2. Paste it into Supabase SQL Editor
3. Run it after `supabase/migrations/0001_init.sql`

## What you should do now

1. Create the Supabase project.
2. Put the three Supabase env vars in `.env.local`.
3. Put the same env vars in Vercel.
4. Run the SQL migration.
5. Run the seed snapshot.
6. Tell me if you want the live app stores migrated next.

If you want the app truly production-safe, the database migration is mandatory.
