begin;

create table if not exists public.table_groups (
  id text primary key,
  restaurant_id text not null references public.restaurants (id) on delete cascade,
  name text not null default 'Groupe de tables',
  status text not null default 'open',
  host_customer_id text references public.customers (id) on delete set null,
  primary_table_id text references public.restaurant_tables (id) on delete set null,
  table_ids jsonb not null default '[]'::jsonb,
  table_session_ids jsonb not null default '[]'::jsonb,
  note text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  closed_at timestamptz,
  deleted_at timestamptz
);

create index if not exists table_groups_restaurant_id_idx on public.table_groups (restaurant_id, status, deleted_at);
create index if not exists table_groups_primary_table_id_idx on public.table_groups (primary_table_id);

commit;
