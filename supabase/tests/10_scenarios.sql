-- Scenario tests for the money and stock rules. Run with run.sh against a
-- throwaway local database. Every check raises on failure, so the script
-- stops at the first broken rule.

\set ON_ERROR_STOP on

create or replace function pg_temp.act_as(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
    v_msg := null;
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null then
    raise exception 'EXPECTED ERROR like "%" but the statement succeeded: %', p_like, p_sql;
  end if;
  if v_msg not ilike p_like then
    raise exception 'EXPECTED ERROR like "%" but got "%"', p_like, v_msg;
  end if;
  raise notice 'refused as expected: %', v_msg;
end $$;

create or replace function pg_temp.check(p_ok boolean, p_what text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'CHECK FAILED: %', p_what; end if;
  raise notice 'ok: %', p_what;
end $$;

grant execute on all functions in schema pg_temp to authenticated;

-- Accounts: first becomes admin, second waits ------------------------------
insert into auth.users (email, raw_user_meta_data) values ('owner@test.pk', '{"full_name":"Owner"}');
insert into auth.users (email, raw_user_meta_data) values ('staff@test.pk', '{"full_name":"Counter Staff"}');

select pg_temp.check((select role = 'admin' and active from profiles where email = 'owner@test.pk'), 'first account is an active admin');
select pg_temp.check((select role = 'staff' and not active from profiles where email = 'staff@test.pk'), 'second account is inactive staff');

select pg_temp.act_as('staff@test.pk');
select pg_temp.expect_error($$select open_shift(1000)$$, '%not active%');
select pg_temp.check((select count(*) from settings) = 0, 'inactive staff cannot read settings');
reset role;

select pg_temp.act_as('owner@test.pk');
select pg_temp.expect_error($$select set_staff(auth.uid(), 'staff', true)$$, '%cannot remove your own admin%');
select set_staff((select id from profiles where email = 'staff@test.pk'), 'staff', true);

-- Catalogue and purchase ---------------------------------------------------
insert into medicines (name, generic_name, form, strength, units_per_pack, barcode, reorder_level)
values ('Panadol', 'Paracetamol', 'Tablet', '500mg', 10, '8964000000011', 50);
insert into medicines (name, form, strength, units_per_pack, allow_loose, tax_percent)
values ('Brufen Syrup', 'Syrup', '100mg/5ml', 1, false, 0);
insert into suppliers (name) values ('Muller and Phipps');
insert into customers (name, phone, credit_limit) values ('Ahmed Raza', '03001234567', 500);

select pg_temp.expect_error($$select create_purchase(jsonb_build_object(
  'supplier_id', (select id from suppliers limit 1),
  'lines', jsonb_build_array(jsonb_build_object('medicine_id', (select id from medicines where name='Panadol'),
    'batch_no','OLD1','expiry_date', (today_pk() - 1)::text,'packs',1,'cost_per_pack',100))))$$, '%expired on%');

select create_purchase(jsonb_build_object(
  'supplier_id', (select id from suppliers limit 1),
  'supplier_invoice_no', 'MP-1001',
  'paid_amount', 500, 'paid_method', 'cash',
  'lines', jsonb_build_array(
    jsonb_build_object('medicine_id', (select id from medicines where name='Panadol'), 'batch_no','a1',
      'expiry_date', (today_pk() + 60)::text, 'packs', 5, 'bonus_packs', 1, 'cost_per_pack', 100, 'sale_price_per_pack', 150),
    jsonb_build_object('medicine_id', (select id from medicines where name='Panadol'), 'batch_no','B2',
      'expiry_date', (today_pk() + 10)::text, 'packs', 2, 'cost_per_pack', 90, 'sale_price_per_pack', 150),
    jsonb_build_object('medicine_id', (select id from medicines where name='Brufen Syrup'), 'batch_no','C3',
      'expiry_date', (today_pk() + 200)::text, 'packs', 10, 'cost_per_pack', 200, 'sale_price_per_pack', 260))));

select pg_temp.check((select qty_on_hand = 60 and cost_per_unit = 8.3333 from batches where batch_no = 'A1'), 'bonus packs lower the unit cost (500 / 60), batch number upper-cased');
select pg_temp.check((select qty_on_hand = 20 and cost_per_unit = 9 from batches where batch_no = 'B2'), 'second batch in units');
select pg_temp.check((select sale_price_per_pack = 150 from medicines where name = 'Panadol'), 'purchase sets the sale price');
select pg_temp.check(supplier_balance((select id from suppliers limit 1)) = 2180, 'supplier balance is invoice 2680 less 500 paid');

select pg_temp.expect_error($$select create_purchase(jsonb_build_object(
  'supplier_id', (select id from suppliers limit 1),
  'lines', jsonb_build_array(jsonb_build_object('medicine_id', (select id from medicines where name='Panadol'),
    'batch_no','A1','expiry_date', (today_pk() + 90)::text,'packs',1,'cost_per_pack',100))))$$, '%already in stock with expiry%');
reset role;

-- Staff at the counter -----------------------------------------------------
select pg_temp.act_as('staff@test.pk');
select pg_temp.expect_error($$insert into medicines (name) values ('Sneaky')$$, '%row-level security%');
select pg_temp.expect_error($$insert into sales (invoice_no, cashier_id, shift_id) values ('X', auth.uid(), 1)$$, '%row-level security%');
update batches set qty_on_hand = 9999;
select pg_temp.check((select sum(qty_on_hand) from batches) = 90, 'staff cannot edit stock directly (update touches nothing)');
select pg_temp.check((select count(*) from purchases) = 0, 'staff cannot read purchases');
select pg_temp.expect_error($$select adjust_stock(1, -1, 'damaged')$$, '%Only the owner%');

select pg_temp.expect_error($$select create_sale('{"items":[{"medicine_id":1,"qty":1}]}')$$, '%No shift is open%');
select open_shift(1000);
select pg_temp.expect_error($$select open_shift(500)$$, '%already open%');

-- 3 packs (450) + 5 loose (75) of Panadol, Brufen at 10% off (234),
-- bill discount 10: 759 - 10 = 749. Customer hands over 1000.
select create_sale(jsonb_build_object(
  'client_ref', '11111111-1111-1111-1111-111111111111',
  'bill_discount', 10, 'tendered', 1000,
  'items', jsonb_build_array(
    jsonb_build_object('medicine_id', (select id from medicines where name='Panadol'), 'unit','pack', 'qty', 3),
    jsonb_build_object('medicine_id', (select id from medicines where name='Panadol'), 'unit','unit', 'qty', 5),
    jsonb_build_object('medicine_id', (select id from medicines where name='Brufen Syrup'), 'qty', 1, 'discount_percent', 10))));

select pg_temp.check((select subtotal = 759 and total = 749 and cash_amount = 749 and change_due = 251 from sales where invoice_no = 'INV-000001'), 'sale totals and change computed in the database');
select pg_temp.check((select qty_on_hand from batches where batch_no = 'B2') = 0, 'earliest expiry batch sold first');
select pg_temp.check((select qty_on_hand from batches where batch_no = 'A1') = 45, 'remainder taken from the next batch');
select pg_temp.check((select round(cost_total, 2) from sale_lines where line_no = 1 and sale_id = (select id from sales where invoice_no = 'INV-000001')) = round(20 * 9 + 10 * 8.3333, 2), 'cost follows the batches actually used');
select pg_temp.check((select count(*) from stock_movements where reason = 'sale') = 4, 'every batch touched writes a stock movement');

select pg_temp.check((select create_sale(jsonb_build_object('client_ref', '11111111-1111-1111-1111-111111111111',
  'items', jsonb_build_array(jsonb_build_object('medicine_id', 1, 'qty', 1)))) ->> 'duplicate') = 'true', 'same client_ref does not sell twice');

select pg_temp.expect_error($$select create_sale(jsonb_build_object('items', jsonb_build_array(
  jsonb_build_object('medicine_id', (select id from medicines where name='Panadol'), 'qty', 100))))$$, '%only 4 packs + 5 loose in stock%');
select pg_temp.expect_error($$select create_sale(jsonb_build_object('items', jsonb_build_array(
  jsonb_build_object('medicine_id', (select id from medicines where name='Panadol'), 'qty', 1)), 'tendered', 100))$$, '%Collect Rs 50.00 more%');
select pg_temp.expect_error($$select create_sale(jsonb_build_object('items', jsonb_build_array(
  jsonb_build_object('medicine_id', (select id from medicines where name='Panadol'), 'qty', 1)), 'credit_amount', 150))$$, '%Choose a customer%');
select pg_temp.check((select qty_on_hand from batches where batch_no = 'A1') = 45, 'a refused sale leaves stock untouched');
select pg_temp.check((select count(*) from sales where invoice_no like 'PENDING%') = 0, 'no half-written bills remain');

-- Credit (khata) ----------------------------------------------------------
select create_sale(jsonb_build_object('customer_id', (select id from customers limit 1), 'credit_amount', 300,
  'items', jsonb_build_array(jsonb_build_object('medicine_id', (select id from medicines where name='Panadol'), 'qty', 2))));
select pg_temp.check(customer_balance((select id from customers limit 1)) = 300, 'credit sale charges the account');
select pg_temp.check((select string_agg(invoice_no, ',' order by id) from sales) = 'INV-000001,INV-000002', 'refused bills leave no gap in invoice numbers');
select pg_temp.expect_error($$select create_sale(jsonb_build_object('customer_id', (select id from customers limit 1), 'credit_amount', 260,
  'items', jsonb_build_array(jsonb_build_object('medicine_id', (select id from medicines where name='Brufen Syrup'), 'qty', 1))))$$, '%pass their credit limit of Rs 500.00%');
select receive_customer_payment((select id from customers limit 1), 100, 'cash', 'Part payment');
select pg_temp.check(customer_balance((select id from customers limit 1)) = 200, 'payment reduces the balance');
select pg_temp.expect_error($$insert into customer_ledger (customer_id, kind, payment) values (1, 'payment', 1000)$$, '%row-level security%');

-- Returns -----------------------------------------------------------------
-- 5 loose Panadol from INV-000001: 75 of the 759 lines, on a bill that
-- charged 749, so the refund is 75 * 749 / 759 = 74.01.
select create_return(jsonb_build_object('sale_id', (select id from sales where invoice_no = 'INV-000001'), 'refund_method', 'cash',
  'lines', jsonb_build_array(jsonb_build_object('sale_line_id', (select id from sale_lines where sale_id = (select id from sales where invoice_no = 'INV-000001') and line_no = 2), 'qty_units', 5))));
select pg_temp.check((select refund_amount from returns where return_no = 'RET-000001') = 74.01, 'refund shares the bill discount');
select pg_temp.check((select qty_on_hand from batches where batch_no = 'A1') = 30, 'returned units go back to their batch (45 - 20 credit sale + 5)');
select pg_temp.expect_error($$select create_return(jsonb_build_object('sale_id', (select id from sales where invoice_no = 'INV-000001'),
  'lines', jsonb_build_array(jsonb_build_object('sale_line_id', (select id from sale_lines where sale_id = (select id from sales where invoice_no = 'INV-000001') and line_no = 2), 'qty_units', 1))))$$, '%already been returned in full%');
select pg_temp.expect_error($$select create_return(jsonb_build_object('sale_id', (select id from sales where invoice_no = 'INV-000001'), 'refund_method', 'account',
  'lines', jsonb_build_array(jsonb_build_object('sale_line_id', (select id from sale_lines where sale_id = (select id from sales where invoice_no = 'INV-000001') and line_no = 1), 'qty_units', 1))))$$, '%no customer%');

-- Close the drawer ----------------------------------------------------------
-- 1000 float + 749 cash sale + 0 on the credit bill + 100 khata cash - 74.01 refund
select pg_temp.check((close_shift(1774.99) ->> 'difference')::numeric = 0, 'expected cash matches the count');
select pg_temp.expect_error($$select close_shift(0)$$, '%No shift is open%');
reset role;

-- Reports: profit for the owner only --------------------------------------
select pg_temp.act_as('staff@test.pk');
select pg_temp.check((select report_summary(today_pk(), today_pk()) -> 'profit') = 'null'::jsonb, 'staff do not see profit');
select pg_temp.check((select (report_summary(today_pk(), today_pk()) ->> 'net_sales')::numeric) = 749 + 300 - 74.01, 'net sales = bills less refunds');
reset role;
select pg_temp.act_as('owner@test.pk');
select pg_temp.check((select report_summary(today_pk(), today_pk()) ->> 'profit') is not null, 'owner sees profit');
select pg_temp.check((select count(*) from report_sales_by_day(today_pk() - 6, today_pk())) = 7, 'one row per day, empty days included');
select pg_temp.check((select name from report_top_medicines(today_pk(), today_pk(), 5) limit 1) = 'Panadol', 'top medicine by revenue');

select pg_temp.expect_error($$select adjust_stock((select id from batches where batch_no='A1'), 5, 'damaged')$$, '%can only be removed%');
select pg_temp.expect_error($$select adjust_stock((select id from batches where batch_no='A1'), -31, 'damaged')$$, '%you are removing 3 packs + 1 loose%');
select adjust_stock((select id from batches where batch_no='A1'), -2, 'damaged', 'Strip torn');
select pg_temp.check((select qty_on_hand from batches where batch_no = 'A1') = 28, 'damaged units written off');
select pg_temp.check((select sum(change_units) from stock_movements where batch_id = b.id) = b.qty_on_hand, 'stock rebuilds from movements for batch ' || b.batch_no)
  from batches b;
select pg_temp.check((select is_low from medicine_stock where name = 'Panadol'), 'Panadol is below its reorder level of 50');
reset role;

select pg_temp.act_as('owner@test.pk');
select pg_temp.check((select count(*) from audit_log) >= 8, 'audit log records the actions');
reset role;
