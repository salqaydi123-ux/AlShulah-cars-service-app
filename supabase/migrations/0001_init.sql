-- الشعلة لخدمة السيارات — المخطط الأساسي لقاعدة البيانات
-- كل جداول الإعدادات (config) نسخّية (versioned): أي تعديل لاحق لا يغيّر السجلات القديمة،
-- لأن كل عملية تحتفظ بلقطة (snapshot) من السعر/الاسم/النسبة وقت تنفيذها.

create extension if not exists "pgcrypto";

-- ===========================================================
-- العملاء والسيارات
-- ===========================================================

create table customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  account_type text not null default 'regular' check (account_type in ('regular','permanent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  plate_emirate text not null,
  plate_code text not null default '',
  plate_number text not null default '',
  plate_country text,
  is_no_plate boolean not null default false,
  model text,
  body_type text not null default 'sedan' check (body_type in ('sedan','fourwd')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- تفرّد اللوحة الحقيقي = (الإمارة + الرمز + الرقم) مجتمعين، ولا ينطبق على سيارات بدون لوحة.
-- لوحات "دولة أخرى" تُميَّز أيضاً باسم الدولة لتفادي تصادم لوحات دول مختلفة بنفس الرمز/الرقم.
create unique index vehicles_plate_unique_idx
  on vehicles (plate_emirate, plate_code, plate_number, coalesce(plate_country, ''))
  where is_no_plate = false;

create index vehicles_customer_idx on vehicles(customer_id);

-- ===========================================================
-- الإعدادات القابلة للتعديل الذاتي (Config-Driven, Versioned)
-- ===========================================================

create table wash_options (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  sedan_price numeric(10,2) not null,
  fourwd_price numeric(10,2) not null,
  sort_order int not null default 0,
  is_current boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now()
);
create index wash_options_current_idx on wash_options(code) where is_current;

create table addon_services (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  price numeric(10,2) not null,
  sort_order int not null default 0,
  is_current boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now()
);
create index addon_services_current_idx on addon_services(code) where is_current;

create table manual_services (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  hint text,
  sort_order int not null default 0,
  is_current boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now()
);
create index manual_services_current_idx on manual_services(code) where is_current;

create table card_commission_rates (
  id uuid primary key default gen_random_uuid(),
  card_type text not null check (card_type in ('debit','credit','amex')),
  label text not null,
  rate_percent numeric(5,2) not null,
  is_current boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now()
);
create index card_commission_current_idx on card_commission_rates(card_type) where is_current;

create table employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- إعدادات عامة متنوعة (مثال: رسوم الصيانة الشهرية للحساب البنكي) — key/value نسخّي
create table app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null,
  is_current boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now()
);
create index app_settings_current_idx on app_settings(key) where is_current;

-- ===========================================================
-- العمليات (Transactions)
-- ===========================================================

create table transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  vehicle_id uuid references vehicles(id),
  vehicle_plate_snapshot text not null,
  tx_date date not null,
  tx_time time not null,
  employee_id uuid references employees(id),
  employee_name_snapshot text not null,
  pay_status text not null check (pay_status in ('paid','pending')),
  pay_method text not null check (pay_method in ('نقدي','بطاقة','آجل','محصّل لاحقاً')),
  card_type text check (card_type in ('debit','credit','amex')),
  commission_rate_snapshot numeric(5,2) not null default 0,
  commission_amount numeric(10,2) not null default 0,
  net_amount numeric(10,2) not null,
  total numeric(10,2) not null,
  notes text,
  created_at timestamptz not null default now()
);
create index transactions_date_idx on transactions(tx_date);
create index transactions_customer_idx on transactions(customer_id);
create index transactions_vehicle_idx on transactions(vehicle_id);
create index transactions_pay_status_idx on transactions(pay_status);

create table transaction_services (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  service_group text not null check (service_group in ('wash','addon','manual')),
  service_code text not null,
  service_name text not null,
  price numeric(10,2) not null
);
create index transaction_services_tx_idx on transaction_services(transaction_id);

create table bank_reconciliation (
  id uuid primary key default gen_random_uuid(),
  tx_date date not null unique,
  card_gross numeric(10,2) not null,
  bank_net numeric(10,2) not null,
  actual_commission numeric(10,2) not null,
  actual_rate numeric(6,3) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================
-- أمان: كل الجداول محمية بـ RLS بدون أي policy — الوصول فقط عبر
-- مفتاح service_role من كود الخادم (Server Actions)، أبداً من المتصفح.
-- ===========================================================

alter table customers enable row level security;
alter table vehicles enable row level security;
alter table wash_options enable row level security;
alter table addon_services enable row level security;
alter table manual_services enable row level security;
alter table card_commission_rates enable row level security;
alter table employees enable row level security;
alter table app_settings enable row level security;
alter table transactions enable row level security;
alter table transaction_services enable row level security;
alter table bank_reconciliation enable row level security;
