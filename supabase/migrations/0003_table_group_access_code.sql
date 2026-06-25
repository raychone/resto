alter table if exists public.table_groups
  add column if not exists access_code text;

update public.table_groups
set access_code = coalesce(nullif(access_code, ''), upper(substr(md5(id), 1, 6)))
where access_code is null or access_code = '';

alter table if exists public.table_groups
  alter column access_code set not null;

create unique index if not exists table_groups_restaurant_access_code_idx
  on public.table_groups (restaurant_id, access_code)
  where deleted_at is null;
