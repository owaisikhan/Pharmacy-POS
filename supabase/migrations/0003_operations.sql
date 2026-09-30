-- Pharmacy POS: every write that touches money or stock.
-- Each function is one transaction. It checks the caller's role, locks the
-- rows it changes, computes every figure itself (prices never come from the
-- browser), and refuses with a sentence the person at the counter can act on.

-- Views ----------------------------------------------------------------------

create or replace view public.medicine_stock with (security_invoker = true) as
select
  m.*,
  coalesce(sum(b.qty_on_hand) filter (where b.expiry_date >= public.today_pk()), 0)::int as sellable_units,
  coalesce(sum(b.qty_on_hand) filter (where b.expiry_date < public.today_pk()), 0)::int as expired_units,
  min(b.expiry_date) filter (where b.expiry_date >= public.today_pk() and b.qty_on_hand > 0) as next_expiry,
  coalesce(sum(b.qty_on_hand) filter (where b.expiry_date >= public.today_pk()), 0) <= m.reorder_level as is_low
from public.medicines m
left join public.batches b on b.medicine_id = m.id
group by m.id;

create or replace function public.customer_balance(p_customer_id bigint)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(charge - payment), 0)::numeric(12,2) from customer_ledger where customer_id = p_customer_id;
$$;

create or replace function public.supplier_balance(p_supplier_id bigint)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(bill - payment), 0)::numeric(12,2) from supplier_ledger where supplier_id = p_supplier_id;
$$;

create or replace view public.customer_balances with (security_invoker = true) as
select c.*,
  coalesce((select sum(l.charge - l.payment) from public.customer_ledger l where l.customer_id = c.id), 0)::numeric(12,2) as balance
from public.customers c;

create or replace view public.supplier_balances with (security_invoker = true) as
select s.*,
  coalesce((select sum(l.bill - l.payment) from public.supplier_ledger l where l.supplier_id = s.id), 0)::numeric(12,2) as balance
from public.suppliers s;

create or replace function public.open_shift_id()
returns bigint language sql stable security definer set search_path = public as $$
  select id from shifts where closed_at is null;
$$;

-- Sale -----------------------------------------------------------------------
-- p = { client_ref, customer_id, note, bill_discount, card_amount,
--       credit_amount, tendered,
--       items: [{ medicine_id, unit: 'pack'|'unit', qty, discount_percent }] }

create or replace function public.create_sale(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := require_active();
  v_ref uuid := nullif(p ->> 'client_ref', '')::uuid;
  v_existing record;
  v_shift bigint;
  v_customer customers%rowtype;
  v_sale_id bigint;
  v_invoice text;
  v_item jsonb;
  v_n int := 0;
  v_med medicines%rowtype;
  v_unit text;
  v_qty int;
  v_qty_units int;
  v_price numeric(12,2);
  v_gross numeric(12,2);
  v_disc_pct numeric(5,2);
  v_disc numeric(12,2);
  v_tax numeric(12,2);
  v_line_total numeric(12,2);
  v_line_id bigint;
  v_remaining int;
  v_take int;
  v_batch record;
  v_cost numeric(14,4);
  v_subtotal numeric(12,2) := 0;
  v_bill_disc numeric(12,2);
  v_total numeric(12,2);
  v_card numeric(12,2);
  v_credit numeric(12,2);
  v_cash numeric(12,2);
  v_tendered numeric(12,2);
  v_balance numeric(12,2);
  v_today date := today_pk();
begin
  -- A double click or a retried request must not sell twice.
  if v_ref is not null then
    select id, invoice_no into v_existing from sales where client_ref = v_ref;
    if found then
      return jsonb_build_object('sale_id', v_existing.id, 'invoice_no', v_existing.invoice_no, 'duplicate', true);
    end if;
  end if;

  v_shift := open_shift_id();
  if v_shift is null then
    raise exception 'No shift is open. Open a shift from the Shifts page (count the cash in the drawer) before selling.';
  end if;

  if jsonb_typeof(p -> 'items') is distinct from 'array' or jsonb_array_length(p -> 'items') = 0 then
    raise exception 'The bill is empty. Add at least one medicine.';
  end if;

  if nullif(p ->> 'customer_id', '') is not null then
    select * into v_customer from customers where id = (p ->> 'customer_id')::bigint;
    if not found or not v_customer.active then
      raise exception 'That customer was not found or has been retired. Choose another customer.';
    end if;
  end if;

  -- The real invoice number is taken only once every check has passed, so a
  -- refused bill never leaves a gap in the numbering.
  insert into sales (invoice_no, client_ref, cashier_id, shift_id, customer_id, note)
  values ('PENDING-' || gen_random_uuid(), v_ref, v_user, v_shift, v_customer.id,
          coalesce(trim(p ->> 'note'), ''))
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p -> 'items') loop
    v_n := v_n + 1;

    select * into v_med from medicines where id = nullif(v_item ->> 'medicine_id', '')::bigint;
    if not found or not v_med.active then
      raise exception 'Line %: this medicine was not found or has been retired.', v_n;
    end if;

    v_unit := coalesce(nullif(v_item ->> 'unit', ''), 'pack');
    if v_unit not in ('pack', 'unit') then
      raise exception 'Line % (%): choose Pack or Loose.', v_n, v_med.name;
    end if;
    if v_med.units_per_pack = 1 then
      v_unit := 'pack';
    end if;

    v_qty := nullif(v_item ->> 'qty', '')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception '%: enter a quantity of 1 or more.', v_med.name;
    end if;

    if v_unit = 'unit' and not v_med.allow_loose then
      raise exception '% is sold by the full pack only.', v_med.name;
    end if;

    if v_unit = 'pack' then
      v_qty_units := v_qty * v_med.units_per_pack;
      v_price := v_med.sale_price_per_pack;
    else
      v_qty_units := v_qty;
      v_price := round(v_med.sale_price_per_pack / v_med.units_per_pack, 2);
    end if;

    if v_price <= 0 then
      raise exception '% has no sale price yet. The owner needs to set one on the Medicines page.', v_med.name;
    end if;

    v_gross := v_price * v_qty;
    v_disc_pct := coalesce(nullif(v_item ->> 'discount_percent', '')::numeric, 0);
    if v_disc_pct < 0 or v_disc_pct > 100 then
      raise exception '%: the discount must be between 0%% and 100%%.', v_med.name;
    end if;
    v_disc := round(v_gross * v_disc_pct / 100, 2);
    v_tax := round((v_gross - v_disc) * v_med.tax_percent / 100, 2);
    v_line_total := v_gross - v_disc + v_tax;

    insert into sale_lines (sale_id, line_no, medicine_id, sale_unit, qty, qty_units, unit_price,
                            discount_percent, discount_amount, tax_amount, line_total)
    values (v_sale_id, v_n, v_med.id, v_unit, v_qty, v_qty_units, v_price,
            v_disc_pct, v_disc, v_tax, v_line_total)
    returning id into v_line_id;

    -- Earliest expiry first; expired batches are never sold.
    v_remaining := v_qty_units;
    v_cost := 0;
    for v_batch in
      select id, qty_on_hand, cost_per_unit from batches
      where medicine_id = v_med.id and expiry_date >= v_today and qty_on_hand > 0
      order by expiry_date, id
      for update
    loop
      exit when v_remaining = 0;
      v_take := least(v_remaining, v_batch.qty_on_hand);
      update batches set qty_on_hand = qty_on_hand - v_take where id = v_batch.id;
      insert into sale_line_batches (sale_line_id, batch_id, qty_units, cost_per_unit)
      values (v_line_id, v_batch.id, v_take, v_batch.cost_per_unit);
      insert into stock_movements (batch_id, medicine_id, change_units, reason, ref_table, ref_id, created_by)
      values (v_batch.id, v_med.id, -v_take, 'sale', 'sales', v_sale_id, v_user);
      v_cost := v_cost + v_take * v_batch.cost_per_unit;
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception '% %: only % in stock that has not expired, but this bill asks for %.',
        v_med.name, v_med.strength,
        fmt_units(v_qty_units - v_remaining, v_med.units_per_pack),
        fmt_units(v_qty_units, v_med.units_per_pack);
    end if;

    update sale_lines set cost_total = v_cost where id = v_line_id;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  v_bill_disc := coalesce(nullif(p ->> 'bill_discount', '')::numeric, 0);
  if v_bill_disc < 0 then
    raise exception 'The bill discount cannot be negative.';
  end if;
  if v_bill_disc > v_subtotal then
    raise exception 'The bill discount (%) is more than the bill (%).', fmt_rs(v_bill_disc), fmt_rs(v_subtotal);
  end if;
  v_total := v_subtotal - v_bill_disc;

  v_card := coalesce(nullif(p ->> 'card_amount', '')::numeric, 0);
  v_credit := coalesce(nullif(p ->> 'credit_amount', '')::numeric, 0);
  if v_card < 0 or v_credit < 0 then
    raise exception 'Payment amounts cannot be negative.';
  end if;
  if v_card + v_credit > v_total then
    raise exception 'Card and account together (%) are more than the bill total (%).',
      fmt_rs(v_card + v_credit), fmt_rs(v_total);
  end if;
  v_cash := v_total - v_card - v_credit;

  v_tendered := coalesce(nullif(p ->> 'tendered', '')::numeric, v_cash);
  if v_tendered < v_cash then
    raise exception 'The customer gave % in cash but % is due in cash. Collect % more.',
      fmt_rs(v_tendered), fmt_rs(v_cash), fmt_rs(v_cash - v_tendered);
  end if;

  if v_credit > 0 then
    if v_customer.id is null then
      raise exception 'Choose a customer to put % on their account.', fmt_rs(v_credit);
    end if;
    perform 1 from customers where id = v_customer.id for update;
    v_balance := customer_balance(v_customer.id);
    if v_customer.credit_limit > 0 and v_balance + v_credit > v_customer.credit_limit then
      raise exception '% already owes %. Adding % would pass their credit limit of %.',
        v_customer.name, fmt_rs(v_balance), fmt_rs(v_credit), fmt_rs(v_customer.credit_limit);
    end if;
  end if;

  v_invoice := 'INV-' || lpad(nextval('sale_no_seq')::text, 6, '0');
  if v_credit > 0 then
    insert into customer_ledger (customer_id, kind, charge, sale_id, note, created_by)
    values (v_customer.id, 'sale', v_credit, v_sale_id, 'Bill ' || v_invoice, v_user);
  end if;

  update sales set
    invoice_no = v_invoice,
    subtotal = v_subtotal, bill_discount = v_bill_disc, total = v_total,
    cash_amount = v_cash, card_amount = v_card, credit_amount = v_credit,
    tendered = v_tendered, change_due = v_tendered - v_cash
  where id = v_sale_id;

  perform write_audit('sale.create', 'sales', v_sale_id::text,
    jsonb_build_object('invoice_no', v_invoice, 'total', v_total, 'lines', v_n));

  return jsonb_build_object('sale_id', v_sale_id, 'invoice_no', v_invoice, 'total', v_total,
                            'change_due', v_tendered - v_cash);
end $$;

-- Return ---------------------------------------------------------------------
-- p = { client_ref, sale_id, refund_method: 'cash'|'account', note,
--       lines: [{ sale_line_id, qty_units }] }
-- The refund is the line's share of what the customer actually paid, so a
-- bill discount is returned in proportion and never refunded twice.

create or replace function public.create_return(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := require_active();
  v_ref uuid := nullif(p ->> 'client_ref', '')::uuid;
  v_existing record;
  v_sale sales%rowtype;
  v_method text := coalesce(nullif(p ->> 'refund_method', ''), 'cash');
  v_shift bigint;
  v_return_id bigint;
  v_return_no text;
  v_lines_total numeric(12,2);
  v_already numeric(12,2);
  v_item jsonb;
  v_line sale_lines%rowtype;
  v_med medicines%rowtype;
  v_qty int;
  v_returnable int;
  v_amount numeric(12,2);
  v_total numeric(12,2) := 0;
  v_remaining int;
  v_take int;
  v_slb record;
  v_cost numeric(14,4);
  v_n int := 0;
begin
  if v_ref is not null then
    select id, return_no into v_existing from returns where client_ref = v_ref;
    if found then
      return jsonb_build_object('return_id', v_existing.id, 'return_no', v_existing.return_no, 'duplicate', true);
    end if;
  end if;

  select * into v_sale from sales where id = nullif(p ->> 'sale_id', '')::bigint for update;
  if not found then
    raise exception 'That bill was not found.';
  end if;

  if v_method not in ('cash', 'account') then
    raise exception 'Choose how to refund: cash or the customer''s account.';
  end if;
  if v_method = 'account' and v_sale.customer_id is null then
    raise exception 'Bill % has no customer, so the refund can only be given in cash.', v_sale.invoice_no;
  end if;

  v_shift := open_shift_id();
  if v_method = 'cash' and v_shift is null then
    raise exception 'No shift is open. Open a shift before giving a cash refund.';
  end if;

  if jsonb_typeof(p -> 'lines') is distinct from 'array' or jsonb_array_length(p -> 'lines') = 0 then
    raise exception 'Choose at least one medicine to return.';
  end if;

  select coalesce(sum(line_total), 0) into v_lines_total from sale_lines where sale_id = v_sale.id;
  select coalesce(sum(refund_amount), 0) into v_already from returns where sale_id = v_sale.id;

  insert into returns (return_no, client_ref, sale_id, created_by, shift_id, refund_method, note)
  values ('PENDING-' || gen_random_uuid(), v_ref, v_sale.id, v_user, v_shift, v_method,
          coalesce(trim(p ->> 'note'), ''))
  returning id into v_return_id;

  for v_item in select value from jsonb_array_elements(p -> 'lines') loop
    select * into v_line from sale_lines
      where id = nullif(v_item ->> 'sale_line_id', '')::bigint and sale_id = v_sale.id;
    if not found then
      raise exception 'A returned line does not belong to bill %.', v_sale.invoice_no;
    end if;
    select * into v_med from medicines where id = v_line.medicine_id;

    v_qty := nullif(v_item ->> 'qty_units', '')::int;
    if v_qty is null or v_qty = 0 then
      continue;
    end if;
    if v_qty < 0 then
      raise exception '%: the quantity to return cannot be negative.', v_med.name;
    end if;

    select coalesce(sum(qty_units - qty_returned), 0) into v_returnable
      from sale_line_batches where sale_line_id = v_line.id;
    if v_returnable = 0 then
      raise exception '% on bill % has already been returned in full.', v_med.name, v_sale.invoice_no;
    end if;
    if v_qty > v_returnable then
      raise exception '%: only % can still be returned from bill % (% sold).',
        v_med.name, fmt_units(v_returnable, v_med.units_per_pack), v_sale.invoice_no,
        fmt_units(v_line.qty_units, v_med.units_per_pack);
    end if;

    v_amount := case when v_lines_total > 0
      then round(v_line.line_total * v_qty / v_line.qty_units * v_sale.total / v_lines_total, 2)
      else 0 end;

    -- Put the units back into the batches they came from.
    v_remaining := v_qty;
    v_cost := 0;
    for v_slb in
      select id, batch_id, qty_units - qty_returned as left_units, cost_per_unit
      from sale_line_batches where sale_line_id = v_line.id and qty_units > qty_returned
      order by id desc
      for update
    loop
      exit when v_remaining = 0;
      v_take := least(v_remaining, v_slb.left_units);
      update sale_line_batches set qty_returned = qty_returned + v_take where id = v_slb.id;
      update batches set qty_on_hand = qty_on_hand + v_take where id = v_slb.batch_id;
      insert into stock_movements (batch_id, medicine_id, change_units, reason, ref_table, ref_id, created_by)
      values (v_slb.batch_id, v_line.medicine_id, v_take, 'return', 'returns', v_return_id, v_user);
      v_cost := v_cost + v_take * v_slb.cost_per_unit;
      v_remaining := v_remaining - v_take;
    end loop;

    insert into return_lines (return_id, sale_line_id, qty_units, amount, cost_total)
    values (v_return_id, v_line.id, v_qty, v_amount, v_cost);
    v_total := v_total + v_amount;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    raise exception 'Enter a quantity for at least one medicine to return.';
  end if;

  -- Rounding across several partial returns must never refund more than was paid.
  v_total := least(v_total, v_sale.total - v_already);
  v_return_no := 'RET-' || lpad(nextval('return_no_seq')::text, 6, '0');

  if v_method = 'account' and v_total > 0 then
    insert into customer_ledger (customer_id, kind, payment, sale_id, return_id, note, created_by)
    values (v_sale.customer_id, 'return', v_total, v_sale.id, v_return_id,
            'Return ' || v_return_no || ' on bill ' || v_sale.invoice_no, v_user);
  end if;

  update returns set return_no = v_return_no, refund_amount = v_total where id = v_return_id;

  perform write_audit('return.create', 'returns', v_return_id::text,
    jsonb_build_object('return_no', v_return_no, 'sale', v_sale.invoice_no, 'refund', v_total, 'method', v_method));

  return jsonb_build_object('return_id', v_return_id, 'return_no', v_return_no, 'refund_amount', v_total);
end $$;

-- Purchase (stock in) --------------------------------------------------------
-- p = { supplier_id, supplier_invoice_no, purchase_date, discount,
--       paid_amount, paid_method, note,
--       lines: [{ medicine_id, batch_no, expiry_date, packs, bonus_packs,
--                 cost_per_pack, sale_price_per_pack }] }
-- Bonus packs cost nothing, so they lower the unit cost of the batch. The
-- invoice discount is spread over the lines the same way.

create or replace function public.create_purchase(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := require_admin();
  v_supplier suppliers%rowtype;
  v_purchase_id bigint;
  v_date date := coalesce(nullif(p ->> 'purchase_date', '')::date, today_pk());
  v_item jsonb;
  v_n int := 0;
  v_med medicines%rowtype;
  v_batch_no text;
  v_expiry date;
  v_packs int;
  v_bonus int;
  v_cost_pack numeric(12,2);
  v_sale_pack numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2);
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_method text := coalesce(nullif(p ->> 'paid_method', ''), 'cash');
  v_factor numeric;
  v_line record;
  v_units int;
  v_unit_cost numeric(14,4);
  v_batch batches%rowtype;
  v_batch_id bigint;
begin
  select * into v_supplier from suppliers where id = nullif(p ->> 'supplier_id', '')::bigint;
  if not found or not v_supplier.active then
    raise exception 'Choose a supplier for this purchase.';
  end if;
  if v_date > today_pk() then
    raise exception 'The purchase date % is in the future.', fmt_date(v_date);
  end if;
  if jsonb_typeof(p -> 'lines') is distinct from 'array' or jsonb_array_length(p -> 'lines') = 0 then
    raise exception 'Add at least one medicine to the purchase.';
  end if;

  insert into purchases (supplier_id, supplier_invoice_no, purchase_date, note, created_by)
  values (v_supplier.id, coalesce(trim(p ->> 'supplier_invoice_no'), ''), v_date,
          coalesce(trim(p ->> 'note'), ''), v_user)
  returning id into v_purchase_id;

  for v_item in select value from jsonb_array_elements(p -> 'lines') loop
    v_n := v_n + 1;
    select * into v_med from medicines where id = nullif(v_item ->> 'medicine_id', '')::bigint;
    if not found or not v_med.active then
      raise exception 'Line %: choose a medicine.', v_n;
    end if;

    v_batch_no := upper(trim(coalesce(v_item ->> 'batch_no', '')));
    if v_batch_no = '' then
      raise exception '%: enter the batch number printed on the pack.', v_med.name;
    end if;
    v_expiry := nullif(v_item ->> 'expiry_date', '')::date;
    if v_expiry is null then
      raise exception '%: enter the expiry date of batch %.', v_med.name, v_batch_no;
    end if;
    if v_expiry < today_pk() then
      raise exception '% batch % expired on %. Expired stock cannot be received.',
        v_med.name, v_batch_no, fmt_date(v_expiry);
    end if;

    v_packs := nullif(v_item ->> 'packs', '')::int;
    v_bonus := coalesce(nullif(v_item ->> 'bonus_packs', '')::int, 0);
    v_cost_pack := nullif(v_item ->> 'cost_per_pack', '')::numeric;
    v_sale_pack := coalesce(nullif(v_item ->> 'sale_price_per_pack', '')::numeric, 0);
    if v_packs is null or v_packs <= 0 then
      raise exception '%: enter how many packs were bought (1 or more).', v_med.name;
    end if;
    if v_bonus < 0 then
      raise exception '%: bonus packs cannot be negative.', v_med.name;
    end if;
    if v_cost_pack is null or v_cost_pack < 0 then
      raise exception '%: enter the cost per pack.', v_med.name;
    end if;
    if v_sale_pack < 0 then
      raise exception '%: the sale price cannot be negative.', v_med.name;
    end if;
    if v_sale_pack > 0 and v_sale_pack < v_cost_pack then
      raise exception '%: the sale price (%) is below the cost (%) per pack. Check both figures.',
        v_med.name, fmt_rs(v_sale_pack), fmt_rs(v_cost_pack);
    end if;

    insert into purchase_lines (purchase_id, medicine_id, batch_no, expiry_date, packs, bonus_packs,
                                cost_per_pack, sale_price_per_pack, line_total)
    values (v_purchase_id, v_med.id, v_batch_no, v_expiry, v_packs, v_bonus,
            v_cost_pack, v_sale_pack, v_packs * v_cost_pack);
    v_subtotal := v_subtotal + v_packs * v_cost_pack;
  end loop;

  v_discount := coalesce(nullif(p ->> 'discount', '')::numeric, 0);
  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'The invoice discount (%) must be between Rs 0 and the invoice amount (%).',
      fmt_rs(v_discount), fmt_rs(v_subtotal);
  end if;
  v_total := v_subtotal - v_discount;
  v_factor := case when v_subtotal > 0 then v_total / v_subtotal else 1 end;

  v_paid := coalesce(nullif(p ->> 'paid_amount', '')::numeric, 0);
  if v_paid < 0 or v_paid > v_total then
    raise exception 'The amount paid now (%) must be between Rs 0 and the invoice total (%).',
      fmt_rs(v_paid), fmt_rs(v_total);
  end if;
  if v_paid > 0 and v_method not in ('cash', 'bank', 'cheque') then
    raise exception 'Choose how the supplier was paid: cash, bank or cheque.';
  end if;

  for v_line in
    select pl.*, m.units_per_pack, m.name as med_name
    from purchase_lines pl join medicines m on m.id = pl.medicine_id
    where pl.purchase_id = v_purchase_id order by pl.id
  loop
    v_units := (v_line.packs + v_line.bonus_packs) * v_line.units_per_pack;
    v_unit_cost := round(v_line.line_total * v_factor / v_units, 4);

    select * into v_batch from batches
      where medicine_id = v_line.medicine_id and batch_no = v_line.batch_no for update;
    if found then
      if v_batch.expiry_date <> v_line.expiry_date then
        raise exception '% batch % is already in stock with expiry %, but this invoice says %. Check the batch number and expiry.',
          v_line.med_name, v_line.batch_no, fmt_date(v_batch.expiry_date), fmt_date(v_line.expiry_date);
      end if;
      -- Topping up a batch: the unit cost becomes the weighted average.
      update batches set
        cost_per_unit = round((qty_on_hand * cost_per_unit + v_units * v_unit_cost) / (qty_on_hand + v_units), 4),
        qty_on_hand = qty_on_hand + v_units,
        supplier_id = v_supplier.id
      where id = v_batch.id;
      v_batch_id := v_batch.id;
    else
      insert into batches (medicine_id, batch_no, expiry_date, cost_per_unit, qty_on_hand, supplier_id)
      values (v_line.medicine_id, v_line.batch_no, v_line.expiry_date, v_unit_cost, v_units, v_supplier.id)
      returning id into v_batch_id;
    end if;

    update purchase_lines set batch_id = v_batch_id where id = v_line.id;
    insert into stock_movements (batch_id, medicine_id, change_units, reason, ref_table, ref_id, created_by)
    values (v_batch_id, v_line.medicine_id, v_units, 'purchase', 'purchases', v_purchase_id, v_user);

    if v_line.sale_price_per_pack > 0 then
      update medicines set sale_price_per_pack = v_line.sale_price_per_pack, updated_at = now()
      where id = v_line.medicine_id;
    end if;
  end loop;

  update purchases set subtotal = v_subtotal, discount = v_discount, total = v_total, paid_amount = v_paid
  where id = v_purchase_id;

  if v_total > 0 then
    insert into supplier_ledger (supplier_id, kind, bill, purchase_id, note, created_by)
    values (v_supplier.id, 'purchase', v_total, v_purchase_id,
            'Invoice ' || coalesce(nullif(trim(p ->> 'supplier_invoice_no'), ''), '#' || v_purchase_id), v_user);
  end if;
  if v_paid > 0 then
    insert into supplier_ledger (supplier_id, kind, payment, method, purchase_id, note, created_by)
    values (v_supplier.id, 'payment', v_paid, v_method, v_purchase_id, 'Paid with purchase #' || v_purchase_id, v_user);
  end if;

  perform write_audit('purchase.create', 'purchases', v_purchase_id::text,
    jsonb_build_object('supplier', v_supplier.name, 'total', v_total, 'lines', v_n));

  return jsonb_build_object('purchase_id', v_purchase_id, 'total', v_total);
end $$;

-- Stock adjustment -----------------------------------------------------------
-- Damaged, expired write-off, count correction. Never edits history: it adds
-- a movement and changes the batch by the same amount.

create or replace function public.adjust_stock(p_batch_id bigint, p_change int, p_reason text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := require_admin();
  v_batch batches%rowtype;
  v_med medicines%rowtype;
begin
  if p_reason not in ('damaged', 'expired', 'count', 'other') then
    raise exception 'Choose a reason: damaged, expired, stock count or other.';
  end if;
  if p_change is null or p_change = 0 then
    raise exception 'Enter how many units to add or remove.';
  end if;
  if p_reason in ('damaged', 'expired') and p_change > 0 then
    raise exception 'Damaged and expired stock can only be removed. Use "Stock count" to add units.';
  end if;
  if p_reason = 'other' and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Write a short note saying why this stock is changing.';
  end if;

  select * into v_batch from batches where id = p_batch_id for update;
  if not found then
    raise exception 'That batch was not found.';
  end if;
  select * into v_med from medicines where id = v_batch.medicine_id;

  if v_batch.qty_on_hand + p_change < 0 then
    raise exception '% batch % has % in stock; you are removing %.',
      v_med.name, v_batch.batch_no, fmt_units(v_batch.qty_on_hand, v_med.units_per_pack),
      fmt_units(-p_change, v_med.units_per_pack);
  end if;

  update batches set qty_on_hand = qty_on_hand + p_change where id = v_batch.id;
  insert into stock_movements (batch_id, medicine_id, change_units, reason, note, created_by)
  values (v_batch.id, v_med.id, p_change, p_reason, coalesce(trim(p_note), ''), v_user);

  perform write_audit('stock.adjust', 'batches', v_batch.id::text,
    jsonb_build_object('medicine', v_med.name, 'batch', v_batch.batch_no, 'change', p_change, 'reason', p_reason));

  return jsonb_build_object('batch_id', v_batch.id, 'qty_on_hand', v_batch.qty_on_hand + p_change);
end $$;

-- Shifts ---------------------------------------------------------------------

create or replace function public.shift_summary(p_shift_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_shift shifts%rowtype;
  v_cash_sales numeric(12,2);
  v_card_sales numeric(12,2);
  v_credit_sales numeric(12,2);
  v_bills int;
  v_cash_refunds numeric(12,2);
  v_cash_in numeric(12,2);
  v_expected numeric(12,2);
begin
  perform require_active();
  select * into v_shift from shifts where id = p_shift_id;
  if not found then
    raise exception 'That shift was not found.';
  end if;

  select coalesce(sum(cash_amount), 0), coalesce(sum(card_amount), 0), coalesce(sum(credit_amount), 0), count(*)
    into v_cash_sales, v_card_sales, v_credit_sales, v_bills
    from sales where shift_id = p_shift_id;
  select coalesce(sum(refund_amount), 0) into v_cash_refunds
    from returns where shift_id = p_shift_id and refund_method = 'cash';
  select coalesce(sum(payment), 0) into v_cash_in
    from customer_ledger where shift_id = p_shift_id and method = 'cash' and kind = 'payment';

  v_expected := v_shift.opening_float + v_cash_sales + v_cash_in - v_cash_refunds;

  return jsonb_build_object(
    'shift_id', v_shift.id,
    'opened_at', v_shift.opened_at,
    'closed_at', v_shift.closed_at,
    'opening_float', v_shift.opening_float,
    'bills', v_bills,
    'cash_sales', v_cash_sales,
    'card_sales', v_card_sales,
    'credit_sales', v_credit_sales,
    'cash_refunds', v_cash_refunds,
    'customer_cash_in', v_cash_in,
    'expected_cash', coalesce(v_shift.expected_cash, v_expected),
    'counted_cash', v_shift.counted_cash,
    'difference', case when v_shift.counted_cash is null then null
                       else v_shift.counted_cash - v_shift.expected_cash end
  );
end $$;

create or replace function public.open_shift(p_opening_float numeric, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := require_active();
  v_open shifts%rowtype;
  v_id bigint;
begin
  if p_opening_float is null or p_opening_float < 0 then
    raise exception 'Enter the cash in the drawer (Rs 0 or more).';
  end if;
  select * into v_open from shifts where closed_at is null;
  if found then
    raise exception 'A shift is already open since %. Close it before opening a new one.',
      to_char(v_open.opened_at at time zone 'Asia/Karachi', 'DD Mon YYYY HH12:MI AM');
  end if;
  insert into shifts (opened_by, opening_float, note)
  values (v_user, p_opening_float, coalesce(trim(p_note), ''))
  returning id into v_id;
  perform write_audit('shift.open', 'shifts', v_id::text, jsonb_build_object('float', p_opening_float));
  return jsonb_build_object('shift_id', v_id);
end $$;

create or replace function public.close_shift(p_counted_cash numeric, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := require_active();
  v_id bigint;
  v_summary jsonb;
  v_expected numeric(12,2);
begin
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'Enter the cash you counted in the drawer (Rs 0 or more).';
  end if;
  select id into v_id from shifts where closed_at is null for update;
  if v_id is null then
    raise exception 'No shift is open.';
  end if;
  v_summary := shift_summary(v_id);
  v_expected := (v_summary ->> 'expected_cash')::numeric;
  update shifts set
    closed_at = now(), closed_by = v_user,
    expected_cash = v_expected, counted_cash = p_counted_cash,
    note = trim(both ' ' from note || ' ' || coalesce(trim(p_note), ''))
  where id = v_id;
  perform write_audit('shift.close', 'shifts', v_id::text,
    jsonb_build_object('expected', v_expected, 'counted', p_counted_cash));
  return shift_summary(v_id);
end $$;

-- Customer account -----------------------------------------------------------

create or replace function public.receive_customer_payment(p_customer_id bigint, p_amount numeric, p_method text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := require_active();
  v_customer customers%rowtype;
  v_shift bigint;
  v_id bigint;
begin
  select * into v_customer from customers where id = p_customer_id for update;
  if not found then
    raise exception 'That customer was not found.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter the amount received (more than Rs 0).';
  end if;
  if p_method not in ('cash', 'card') then
    raise exception 'Choose cash or card.';
  end if;
  if p_method = 'cash' then
    v_shift := open_shift_id();
    if v_shift is null then
      raise exception 'No shift is open. Open a shift before taking cash.';
    end if;
  end if;
  insert into customer_ledger (customer_id, kind, payment, method, shift_id, note, created_by)
  values (v_customer.id, 'payment', p_amount, p_method, v_shift, coalesce(trim(p_note), ''), v_user)
  returning id into v_id;
  perform write_audit('customer.payment', 'customers', v_customer.id::text,
    jsonb_build_object('amount', p_amount, 'method', p_method));
  return jsonb_build_object('entry_id', v_id, 'balance', customer_balance(v_customer.id));
end $$;

-- Opening balance or a correction, owner only. p_direction: 'charge' makes
-- them owe more, 'payment' makes them owe less.
create or replace function public.adjust_customer_balance(p_customer_id bigint, p_kind text, p_direction text, p_amount numeric, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := require_admin();
  v_id bigint;
begin
  if not exists (select 1 from customers where id = p_customer_id) then
    raise exception 'That customer was not found.';
  end if;
  if p_kind not in ('opening', 'adjustment') or p_direction not in ('charge', 'payment') then
    raise exception 'Choose what kind of entry this is.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount more than Rs 0.';
  end if;
  if length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Write a short note saying why the balance is changing.';
  end if;
  insert into customer_ledger (customer_id, kind, charge, payment, note, created_by)
  values (p_customer_id, p_kind,
          case when p_direction = 'charge' then p_amount else 0 end,
          case when p_direction = 'payment' then p_amount else 0 end,
          trim(p_note), v_user)
  returning id into v_id;
  perform write_audit('customer.adjust', 'customers', p_customer_id::text,
    jsonb_build_object('kind', p_kind, 'direction', p_direction, 'amount', p_amount));
  return jsonb_build_object('entry_id', v_id, 'balance', customer_balance(p_customer_id));
end $$;

-- Supplier account -----------------------------------------------------------

create or replace function public.pay_supplier(p_supplier_id bigint, p_amount numeric, p_method text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := require_admin();
  v_id bigint;
begin
  if not exists (select 1 from suppliers where id = p_supplier_id) then
    raise exception 'That supplier was not found.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter the amount paid (more than Rs 0).';
  end if;
  if p_method not in ('cash', 'bank', 'cheque') then
    raise exception 'Choose cash, bank or cheque.';
  end if;
  insert into supplier_ledger (supplier_id, kind, payment, method, note, created_by)
  values (p_supplier_id, 'payment', p_amount, p_method, coalesce(trim(p_note), ''), v_user)
  returning id into v_id;
  perform write_audit('supplier.payment', 'suppliers', p_supplier_id::text,
    jsonb_build_object('amount', p_amount, 'method', p_method));
  return jsonb_build_object('entry_id', v_id, 'balance', supplier_balance(p_supplier_id));
end $$;

create or replace function public.adjust_supplier_balance(p_supplier_id bigint, p_kind text, p_direction text, p_amount numeric, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := require_admin();
  v_id bigint;
begin
  if not exists (select 1 from suppliers where id = p_supplier_id) then
    raise exception 'That supplier was not found.';
  end if;
  if p_kind not in ('opening', 'adjustment') or p_direction not in ('bill', 'payment') then
    raise exception 'Choose what kind of entry this is.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount more than Rs 0.';
  end if;
  if length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Write a short note saying why the balance is changing.';
  end if;
  insert into supplier_ledger (supplier_id, kind, bill, payment, note, created_by)
  values (p_supplier_id, p_kind,
          case when p_direction = 'bill' then p_amount else 0 end,
          case when p_direction = 'payment' then p_amount else 0 end,
          trim(p_note), v_user)
  returning id into v_id;
  perform write_audit('supplier.adjust', 'suppliers', p_supplier_id::text,
    jsonb_build_object('kind', p_kind, 'direction', p_direction, 'amount', p_amount));
  return jsonb_build_object('entry_id', v_id, 'balance', supplier_balance(p_supplier_id));
end $$;

-- Staff ----------------------------------------------------------------------

create or replace function public.set_staff(p_user_id uuid, p_role public.app_role, p_active boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := require_admin();
begin
  if not exists (select 1 from profiles where id = p_user_id) then
    raise exception 'That account was not found.';
  end if;
  if p_user_id = v_user and (p_role <> 'admin' or not p_active) then
    raise exception 'You cannot remove your own admin access. Make another account admin first, then ask them to change yours.';
  end if;
  lock table profiles in share row exclusive mode;
  update profiles set role = p_role, active = p_active where id = p_user_id;
  if not exists (select 1 from profiles where role = 'admin' and active) then
    raise exception 'At least one active admin must remain.';
  end if;
  perform write_audit('staff.update', 'profiles', p_user_id::text,
    jsonb_build_object('role', p_role, 'active', p_active));
  return jsonb_build_object('ok', true);
end $$;

-- Only signed-in accounts may call anything, and each function checks the role itself.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant select on public.medicine_stock, public.customer_balances, public.supplier_balances to authenticated;
revoke all on public.medicine_stock, public.customer_balances, public.supplier_balances from anon;
