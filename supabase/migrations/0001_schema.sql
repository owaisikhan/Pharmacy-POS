-- Pharmacy POS: tables.
-- Quantities are stored in base units (one tablet, one bottle). A pack holds
-- medicines.units_per_pack base units. Money is numeric(12,2), never float.
-- Ledgers are append-only: nothing in them is edited or deleted, a mistake is
-- corrected by a new row.

create extension if not exists pg_trgm;

create type public.app_role as enum ('admin', 'staff');

-- People ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role public.app_role not null default 'staff',
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- One row: the pharmacy's identity, printed on every receipt.
create table public.settings (
  id int primary key default 1 check (id = 1),
  pharmacy_name text not null default 'My Pharmacy',
  address text not null default '',
  phone text not null default '',
  licence_no text not null default '',
  receipt_footer text not null default 'Thank you. Please check your medicines before leaving the counter.',
  updated_at timestamptz not null default now()
);
insert into public.settings default values;

-- Catalogue ------------------------------------------------------------------

create table public.medicines (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) > 0),
  generic_name text not null default '',
  company text not null default '',
  category text not null default '',
  form text not null default 'Tablet',
  strength text not null default '',
  units_per_pack int not null default 1 check (units_per_pack between 1 and 1000),
  allow_loose boolean not null default true,
  sale_price_per_pack numeric(12,2) not null default 0 check (sale_price_per_pack >= 0),
  barcode text unique check (barcode is null or length(trim(barcode)) > 0),
  rack text not null default '',
  reorder_level int not null default 0 check (reorder_level >= 0),
  rx_required boolean not null default false,
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index medicines_identity
  on public.medicines (lower(name), lower(strength), lower(form));
create index medicines_name_trgm on public.medicines using gin (name gin_trgm_ops);
create index medicines_generic_trgm on public.medicines using gin (generic_name gin_trgm_ops);

create table public.suppliers (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) > 0),
  phone text not null default '',
  address text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index suppliers_name on public.suppliers (lower(name));

create table public.customers (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) > 0),
  phone text not null default '',
  address text not null default '',
  credit_limit numeric(12,2) not null default 0 check (credit_limit >= 0),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index customers_name_trgm on public.customers using gin (name gin_trgm_ops);

-- Stock ----------------------------------------------------------------------

create table public.batches (
  id bigint generated always as identity primary key,
  medicine_id bigint not null references public.medicines (id),
  batch_no text not null check (length(trim(batch_no)) > 0),
  expiry_date date not null,
  cost_per_unit numeric(14,4) not null default 0 check (cost_per_unit >= 0),
  qty_on_hand int not null default 0 check (qty_on_hand >= 0),
  supplier_id bigint references public.suppliers (id),
  created_at timestamptz not null default now(),
  unique (medicine_id, batch_no)
);
create index batches_fefo on public.batches (medicine_id, expiry_date, id);

-- Every change to batches.qty_on_hand writes one row here, so stock can be
-- rebuilt from history and every figure has a reason.
create table public.stock_movements (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.batches (id),
  medicine_id bigint not null references public.medicines (id),
  change_units int not null check (change_units <> 0),
  reason text not null check (reason in
    ('purchase', 'sale', 'return', 'damaged', 'expired', 'count', 'other')),
  ref_table text,
  ref_id bigint,
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now()
);
create index stock_movements_batch on public.stock_movements (batch_id, created_at);
create index stock_movements_medicine on public.stock_movements (medicine_id, created_at);

-- Cash shifts ----------------------------------------------------------------

create table public.shifts (
  id bigint generated always as identity primary key,
  opened_by uuid not null,
  opened_at timestamptz not null default now(),
  opening_float numeric(12,2) not null check (opening_float >= 0),
  closed_by uuid,
  closed_at timestamptz,
  expected_cash numeric(12,2),
  counted_cash numeric(12,2) check (counted_cash >= 0),
  note text not null default '',
  check ((closed_at is null) = (counted_cash is null)),
  check ((closed_at is null) = (expected_cash is null))
);
-- Only one drawer, so only one open shift.
create unique index shifts_one_open on public.shifts ((true)) where closed_at is null;

-- Sales ----------------------------------------------------------------------

create sequence public.sale_no_seq;
create sequence public.return_no_seq;

create table public.sales (
  id bigint generated always as identity primary key,
  invoice_no text not null unique,
  client_ref uuid unique,
  created_at timestamptz not null default now(),
  cashier_id uuid not null,
  shift_id bigint not null references public.shifts (id),
  customer_id bigint references public.customers (id),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  bill_discount numeric(12,2) not null default 0 check (bill_discount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  cash_amount numeric(12,2) not null default 0 check (cash_amount >= 0),
  card_amount numeric(12,2) not null default 0 check (card_amount >= 0),
  credit_amount numeric(12,2) not null default 0 check (credit_amount >= 0),
  tendered numeric(12,2) not null default 0 check (tendered >= 0),
  change_due numeric(12,2) not null default 0 check (change_due >= 0),
  note text not null default '',
  check (bill_discount <= subtotal),
  check (total = subtotal - bill_discount),
  check (cash_amount + card_amount + credit_amount = total),
  check (tendered >= cash_amount),
  check (change_due = tendered - cash_amount),
  check (credit_amount = 0 or customer_id is not null)
);
create index sales_created on public.sales (created_at desc);
create index sales_customer on public.sales (customer_id, created_at desc);
create index sales_shift on public.sales (shift_id);

create table public.sale_lines (
  id bigint generated always as identity primary key,
  sale_id bigint not null references public.sales (id),
  line_no int not null,
  medicine_id bigint not null references public.medicines (id),
  sale_unit text not null check (sale_unit in ('pack', 'unit')),
  qty int not null check (qty > 0),
  qty_units int not null check (qty_units > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  cost_total numeric(14,4) not null default 0 check (cost_total >= 0),
  unique (sale_id, line_no)
);
create index sale_lines_medicine on public.sale_lines (medicine_id);

-- Which batches a sale line was taken from (earliest expiry first).
create table public.sale_line_batches (
  id bigint generated always as identity primary key,
  sale_line_id bigint not null references public.sale_lines (id),
  batch_id bigint not null references public.batches (id),
  qty_units int not null check (qty_units > 0),
  cost_per_unit numeric(14,4) not null check (cost_per_unit >= 0),
  qty_returned int not null default 0,
  check (qty_returned between 0 and qty_units)
);
create index sale_line_batches_line on public.sale_line_batches (sale_line_id);

create table public.returns (
  id bigint generated always as identity primary key,
  return_no text not null unique,
  client_ref uuid unique,
  sale_id bigint not null references public.sales (id),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  shift_id bigint references public.shifts (id),
  refund_method text not null check (refund_method in ('cash', 'account')),
  refund_amount numeric(12,2) not null default 0 check (refund_amount >= 0),
  note text not null default '',
  check (refund_method <> 'cash' or shift_id is not null)
);
create index returns_sale on public.returns (sale_id);
create index returns_created on public.returns (created_at desc);

create table public.return_lines (
  id bigint generated always as identity primary key,
  return_id bigint not null references public.returns (id),
  sale_line_id bigint not null references public.sale_lines (id),
  qty_units int not null check (qty_units > 0),
  amount numeric(12,2) not null check (amount >= 0),
  cost_total numeric(14,4) not null default 0 check (cost_total >= 0)
);
create index return_lines_return on public.return_lines (return_id);

-- Customer credit (khata). charge = they owe more, payment = they owe less.
create table public.customer_ledger (
  id bigint generated always as identity primary key,
  customer_id bigint not null references public.customers (id),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('sale', 'payment', 'return', 'opening', 'adjustment')),
  charge numeric(12,2) not null default 0 check (charge >= 0),
  payment numeric(12,2) not null default 0 check (payment >= 0),
  method text check (method in ('cash', 'card')),
  shift_id bigint references public.shifts (id),
  sale_id bigint references public.sales (id),
  return_id bigint references public.returns (id),
  note text not null default '',
  created_by uuid,
  check ((charge > 0) <> (payment > 0)),
  check (method <> 'cash' or shift_id is not null)
);
create index customer_ledger_customer on public.customer_ledger (customer_id, created_at);

-- Purchases ------------------------------------------------------------------

create table public.purchases (
  id bigint generated always as identity primary key,
  supplier_id bigint not null references public.suppliers (id),
  supplier_invoice_no text not null default '',
  purchase_date date not null,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  note text not null default '',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  check (discount <= subtotal),
  check (total = subtotal - discount),
  check (paid_amount <= total)
);
create index purchases_date on public.purchases (purchase_date desc, id desc);

create table public.purchase_lines (
  id bigint generated always as identity primary key,
  purchase_id bigint not null references public.purchases (id),
  medicine_id bigint not null references public.medicines (id),
  batch_id bigint references public.batches (id),
  batch_no text not null,
  expiry_date date not null,
  packs int not null check (packs > 0),
  bonus_packs int not null default 0 check (bonus_packs >= 0),
  cost_per_pack numeric(12,2) not null check (cost_per_pack >= 0),
  sale_price_per_pack numeric(12,2) not null default 0 check (sale_price_per_pack >= 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);
create index purchase_lines_purchase on public.purchase_lines (purchase_id);

-- What the pharmacy owes each supplier. bill = owe more, payment = owe less.
create table public.supplier_ledger (
  id bigint generated always as identity primary key,
  supplier_id bigint not null references public.suppliers (id),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('purchase', 'payment', 'opening', 'adjustment')),
  bill numeric(12,2) not null default 0 check (bill >= 0),
  payment numeric(12,2) not null default 0 check (payment >= 0),
  method text check (method in ('cash', 'bank', 'cheque')),
  purchase_id bigint references public.purchases (id),
  note text not null default '',
  created_by uuid,
  check ((bill > 0) <> (payment > 0))
);
create index supplier_ledger_supplier on public.supplier_ledger (supplier_id, created_at);

-- Audit ----------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created on public.audit_log (created_at desc);
