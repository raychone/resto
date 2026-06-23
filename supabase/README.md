# Supabase migration

This folder contains:

- `migrations/0001_init.sql` — initial schema
- `seed.sql` — current local JSON snapshot exported as SQL
- `seed-chunks/` — smaller SQL chunks for editor-limited imports

## Generate the seed

```bash
npm run supabase:seed
```

This regenerates:

- `supabase/seed.sql`
- `supabase/seed-chunks/*.sql`

from the current `data/*.json` files.

## Apply in Supabase

1. Open your Supabase project.
2. Go to **SQL Editor**.
3. Run `supabase/migrations/0001_init.sql`.
4. If the full seed is too large for the editor, use `psql` with a direct database connection string.
5. If you want to use the chunk files, concatenate them first:

```bash
cat supabase/seed-chunks/*.sql > /tmp/supabase-seed.sql
psql "$SUPABASE_DB_URL" -f /tmp/supabase-seed.sql
```

## Notes

- The schema keeps complex app data in `jsonb` where that reduces migration friction.
- This is intentional so you can migrate the current app state quickly without redesigning the business model first.
