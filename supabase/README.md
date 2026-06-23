# Supabase migration

This folder contains:

- `migrations/0001_init.sql` — initial schema
- `seed.sql` — current local JSON snapshot exported as SQL

## Generate the seed

```bash
npm run supabase:seed
```

This regenerates `supabase/seed.sql` from the current `data/*.json` files.

## Apply in Supabase

1. Open your Supabase project.
2. Go to **SQL Editor**.
3. Run `supabase/migrations/0001_init.sql`.
4. Run `supabase/seed.sql`.

## Notes

- The schema keeps complex app data in `jsonb` where that reduces migration friction.
- This is intentional so you can migrate the current app state quickly without redesigning the business model first.
