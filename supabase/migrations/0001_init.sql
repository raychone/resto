begin;

create table if not exists public.restaurants (
  id text primary key,
  slug text not null unique,
  name text not null,
  status text not null default 'lead',
  plan text not null default 'starter',
  tagline text not null default '',
  description text not null default '',
  accent text not null default '',
  logo_url text not null default '',
  hero_image text not null default '',
  address text not null default '',
  phone text not null default '',
  whatsapp_number text not null default '',
  uber_eats_url text not null default '',
  trip_advisor_url text not null default '',
  google_rating numeric(3,1) not null default 0,
  google_reviews_count integer not null default 0,
  google_reviews_url text not null default '',
  opening_hours text not null default '',
  table_count integer not null default 0,
  seats_per_table integer not null default 0,
  weekly_hours jsonb not null default '[]'::jsonb,
  happy_hour_schedule jsonb,
  features jsonb not null default '{}'::jsonb,
  currency text not null default 'EUR',
  categories jsonb not null default '[]'::jsonb,
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists restaurants_slug_idx on public.restaurants (slug);
create index if not exists restaurants_status_idx on public.restaurants (status, deleted_at);

create table if not exists public.users (
  id text primary key,
  restaurant_id text references public.restaurants (id) on delete set null,
  role text not null,
  name text not null,
  username text not null unique,
  password_hash text not null,
  temporary_password text,
  must_change_password boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  pin_enabled boolean not null default false
);

create index if not exists users_restaurant_id_idx on public.users (restaurant_id, role, deleted_at);
create index if not exists users_username_idx on public.users (username);

create table if not exists public.customers (
  id text primary key,
  restaurant_id text not null references public.restaurants (id) on delete cascade,
  user_id text references public.users (id) on delete set null,
  is_guest boolean not null default false,
  first_name text not null default '',
  last_name text not null default '',
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  current_points integer not null default 0,
  lifetime_points integer not null default 0,
  tier text not null default 'bronze',
  status text not null default 'active',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists customers_restaurant_id_idx on public.customers (restaurant_id, deleted_at);
create index if not exists customers_user_id_idx on public.customers (user_id);

create table if not exists public.restaurant_tables (
  id text primary key,
  restaurant_id text not null references public.restaurants (id) on delete cascade,
  name text not null,
  zone text not null default 'salle',
  seats integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists restaurant_tables_restaurant_id_idx on public.restaurant_tables (restaurant_id, deleted_at);

create table if not exists public.table_sessions (
  id text primary key,
  restaurant_id text not null references public.restaurants (id) on delete cascade,
  table_id text,
  order_id text,
  status text not null default 'open',
  guest_count integer not null default 0,
  estimated_total numeric not null default 0,
  paid_total numeric not null default 0,
  note text not null default '',
  participants jsonb not null default '[]'::jsonb,
  last_payment_method text,
  last_payment_amount numeric not null default 0,
  last_payment_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  closed_at timestamptz,
  deleted_at timestamptz
);

create index if not exists table_sessions_restaurant_id_idx on public.table_sessions (restaurant_id, table_id, status, deleted_at);
create index if not exists table_sessions_order_id_idx on public.table_sessions (order_id);

create table if not exists public.orders (
  id text primary key,
  restaurant_id text not null references public.restaurants (id) on delete cascade,
  table_id text,
  table_session_id text,
  staff_user_id text references public.users (id) on delete set null,
  source text not null default 'qr',
  status text not null default 'open',
  opened_at timestamptz not null,
  closed_at timestamptz,
  archived_at timestamptz,
  note text not null default '',
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists orders_restaurant_id_idx on public.orders (restaurant_id, table_id, status, deleted_at);
create index if not exists orders_table_session_id_idx on public.orders (table_session_id);

create table if not exists public.payments (
  id text primary key,
  order_id text not null references public.orders (id) on delete cascade,
  restaurant_id text not null references public.restaurants (id) on delete cascade,
  amount numeric not null default 0,
  method text not null default 'cash',
  status text not null default 'pending',
  note text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists payments_order_id_idx on public.payments (order_id, deleted_at);
create index if not exists payments_restaurant_id_idx on public.payments (restaurant_id, deleted_at);

create table if not exists public.reservations (
  id text primary key,
  restaurant_slug text not null,
  restaurant_id text references public.restaurants (id) on delete set null,
  locale text not null default 'fr',
  first_name text not null default '',
  last_name text not null default '',
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  note text not null default '',
  date text not null,
  time text not null,
  guest_count integer not null default 1,
  tables_needed integer not null default 1,
  status text not null default 'pending',
  created_at timestamptz not null,
  confirmed_at timestamptz,
  confirmed_message text,
  deleted_at timestamptz
);

create index if not exists reservations_restaurant_slug_idx on public.reservations (restaurant_slug, status, date, deleted_at);

create table if not exists public.messages (
  id text primary key,
  restaurant_slug text not null,
  restaurant_id text references public.restaurants (id) on delete set null,
  table_id text,
  table_label text,
  locale text not null default 'fr',
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  message text not null default '',
  status text not null default 'new',
  created_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists messages_restaurant_slug_idx on public.messages (restaurant_slug, status, table_id, deleted_at);

create table if not exists public.audit (
  id text primary key,
  restaurant_slug text not null,
  restaurant_id text references public.restaurants (id) on delete set null,
  actor_role text not null,
  actor_name text not null,
  action text not null,
  target_type text,
  target_id text,
  details text not null default '',
  created_at timestamptz not null
);

create index if not exists audit_restaurant_slug_idx on public.audit (restaurant_slug, created_at desc);

create table if not exists public.invoices (
  id text primary key,
  restaurant_slug text not null,
  restaurant_name text not null,
  kind text not null default 'setup',
  period_label text not null default '',
  amount numeric not null default 0,
  currency text not null default 'EUR',
  include_domain boolean not null default false,
  include_database boolean not null default false,
  include_qr_menu boolean not null default false,
  include_booking boolean not null default false,
  include_sms boolean not null default false,
  notes text not null default '',
  status text not null default 'draft',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists invoices_restaurant_slug_idx on public.invoices (restaurant_slug, kind, status);

commit;
