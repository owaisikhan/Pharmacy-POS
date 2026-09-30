-- Pharmacy POS: who may do what.
-- RLS is the access control. Hiding a button is tidiness; these policies are
-- what actually refuse. Every money and stock table is read-only to clients:
-- writes go through the security-definer functions in 0003, which check the
-- role themselves and keep ledgers append-only.

-- Helpers --------------------------------------------------------------------

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'admin');
$$;

create or replace function public.require_active()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if not is_active_user() then
    raise exception 'Your account is not active yet. Ask the owner to activate it in Settings.';
  end if;
  return auth.uid();
end $$;

create or replace function public.require_admin()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Only the owner (admin) can do this.';
  end if;
  return auth.uid();
end $$;

-- The business day is Pakistan time, whatever the server's clock says.
create or replace function public.today_pk()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Karachi')::date;
$$;

create or replace function public.fmt_rs(n numeric)
returns text language sql immutable set search_path = public as $$
  select 'Rs ' || to_char(coalesce(n, 0), 'FM999,999,999,990.00');
$$;

create or replace function public.fmt_date(d date)
returns text language sql immutable set search_path = public as $$
  select to_char(d, 'DD Mon YYYY');
$$;

-- "3 packs + 4" for a strip of 10, "7" for a bottle.
create or replace function public.fmt_units(n int, per_pack int)
returns text language sql immutable set search_path = public as $$
  select case
    when n = 0 then 'none'
    when per_pack <= 1 then n::text
    when n % per_pack = 0 then (n / per_pack)::text || case when n / per_pack = 1 then ' pack' else ' packs' end
    when n < per_pack then n::text || ' loose'
    else (n / per_pack)::text || case when n / per_pack = 1 then ' pack + ' else ' packs + ' end
         || (n % per_pack)::text || ' loose'
  end;
$$;

create or replace function public.write_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_log (actor, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- New accounts ---------------------------------------------------------------
-- The first account becomes the active admin (the owner). Everyone after that
-- signs up as inactive staff and waits for the owner to switch them on.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_first boolean;
begin
  lock table public.profiles in share row exclusive mode;
  v_first := not exists (select 1 from public.profiles);
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    case when v_first then 'admin'::public.app_role else 'staff'::public.app_role end,
    v_first
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row level security ---------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.medicines enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.batches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.shifts enable row level security;
alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;
alter table public.sale_line_batches enable row level security;
alter table public.returns enable row level security;
alter table public.return_lines enable row level security;
alter table public.customer_ledger enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_lines enable row level security;
alter table public.supplier_ledger enable row level security;
alter table public.audit_log enable row level security;

-- Profiles: you always see yourself; working staff see colleagues' names on
-- bills and shifts. Changes go through set_staff().
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_user());

create policy settings_read on public.settings for select to authenticated
  using (public.is_active_user());
create policy settings_update on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Catalogue: everyone working reads it; only the admin changes prices and details.
create policy medicines_read on public.medicines for select to authenticated
  using (public.is_active_user());
create policy medicines_insert on public.medicines for insert to authenticated
  with check (public.is_admin());
create policy medicines_update on public.medicines for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy suppliers_read on public.suppliers for select to authenticated
  using (public.is_active_user());
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (public.is_admin());
create policy suppliers_update on public.suppliers for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Customers: the counter adds and edits them while selling.
create policy customers_read on public.customers for select to authenticated
  using (public.is_active_user());
create policy customers_insert on public.customers for insert to authenticated
  with check (public.is_active_user());
create policy customers_update on public.customers for update to authenticated
  using (public.is_active_user()) with check (public.is_active_user());

-- Money and stock: read-only here. Writes only through the functions in 0003.
create policy batches_read on public.batches for select to authenticated using (public.is_active_user());
create policy stock_movements_read on public.stock_movements for select to authenticated using (public.is_active_user());
create policy shifts_read on public.shifts for select to authenticated using (public.is_active_user());
create policy sales_read on public.sales for select to authenticated using (public.is_active_user());
create policy sale_lines_read on public.sale_lines for select to authenticated using (public.is_active_user());
create policy sale_line_batches_read on public.sale_line_batches for select to authenticated using (public.is_active_user());
create policy returns_read on public.returns for select to authenticated using (public.is_active_user());
create policy return_lines_read on public.return_lines for select to authenticated using (public.is_active_user());
create policy customer_ledger_read on public.customer_ledger for select to authenticated using (public.is_active_user());

-- Buying side and the audit trail: owner only.
create policy purchases_read on public.purchases for select to authenticated using (public.is_admin());
create policy purchase_lines_read on public.purchase_lines for select to authenticated using (public.is_admin());
create policy supplier_ledger_read on public.supplier_ledger for select to authenticated using (public.is_admin());
create policy audit_log_read on public.audit_log for select to authenticated using (public.is_admin());

-- Signed-in accounts reach tables through the Data API; the policies above
-- decide which rows and which writes. The anon key can read nothing.
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
