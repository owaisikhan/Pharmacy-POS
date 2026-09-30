-- Pharmacy POS: reports. Every total is summed here, in one place, so two
-- screens can never disagree. Dates are Pakistan business days.
-- Cost and profit are returned only to the owner; staff get null.

create or replace function public.report_summary(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_admin boolean;
  v_from timestamptz;
  v_to timestamptz;
  v jsonb;
begin
  perform require_active();
  v_admin := is_admin();
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose a date range where the end is on or after the start.';
  end if;
  v_from := (p_from::timestamp) at time zone 'Asia/Karachi';
  v_to := ((p_to + 1)::timestamp) at time zone 'Asia/Karachi';

  with s as (
    select * from sales where created_at >= v_from and created_at < v_to
  ), sl as (
    -- Each line's share of what was actually charged after the bill discount.
    select l.*, case when t.lines_total > 0 then s.total / t.lines_total else 0 end as factor
    from sale_lines l
    join s on s.id = l.sale_id
    join (select sale_id, sum(line_total) as lines_total from sale_lines group by sale_id) t on t.sale_id = l.sale_id
  ), r as (
    select * from returns where created_at >= v_from and created_at < v_to
  ), rl as (
    select rl.*, l.tax_amount, l.line_total
    from return_lines rl join r on r.id = rl.return_id join sale_lines l on l.id = rl.sale_line_id
  )
  select jsonb_build_object(
    'bills', (select count(*) from s),
    'gross_sales', (select coalesce(sum(total), 0) from s),
    'discounts', (select coalesce(sum(bill_discount), 0) from s) + (select coalesce(sum(discount_amount), 0) from sl),
    'cash', (select coalesce(sum(cash_amount), 0) from s),
    'card', (select coalesce(sum(card_amount), 0) from s),
    'credit', (select coalesce(sum(credit_amount), 0) from s),
    'returns_count', (select count(*) from r),
    'returns', (select coalesce(sum(refund_amount), 0) from r),
    'net_sales', (select coalesce(sum(total), 0) from s) - (select coalesce(sum(refund_amount), 0) from r),
    'tax', round((select coalesce(sum(tax_amount * factor), 0) from sl)
                 - (select coalesce(sum(case when line_total > 0 then amount * tax_amount / line_total else 0 end), 0) from rl), 2),
    'cost', case when v_admin then round((select coalesce(sum(cost_total), 0) from sl)
                                       - (select coalesce(sum(cost_total), 0) from rl), 2) end,
    'profit', case when v_admin then round(
        (select coalesce(sum((line_total - tax_amount) * factor - cost_total), 0) from sl)
      - (select coalesce(sum(amount - case when line_total > 0 then amount * tax_amount / line_total else 0 end - cost_total), 0) from rl), 2) end,
    'customer_payments', (select coalesce(sum(payment), 0) from customer_ledger
                          where kind = 'payment' and created_at >= v_from and created_at < v_to)
  ) into v;
  return v;
end $$;

create or replace function public.report_sales_by_day(p_from date, p_to date)
returns table (day date, bills int, sales numeric, returns numeric, net numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform require_active();
  if p_to - p_from > 366 then
    raise exception 'Choose a range of one year or less.';
  end if;
  return query
  with d as (select generate_series(p_from, p_to, interval '1 day')::date as day),
  s as (
    select (created_at at time zone 'Asia/Karachi')::date as day, count(*)::int as bills, sum(total) as sales
    from sales
    where created_at >= (p_from::timestamp at time zone 'Asia/Karachi')
      and created_at < ((p_to + 1)::timestamp at time zone 'Asia/Karachi')
    group by 1
  ),
  r as (
    select (created_at at time zone 'Asia/Karachi')::date as day, sum(refund_amount) as returns
    from returns
    where created_at >= (p_from::timestamp at time zone 'Asia/Karachi')
      and created_at < ((p_to + 1)::timestamp at time zone 'Asia/Karachi')
    group by 1
  )
  select d.day, coalesce(s.bills, 0), coalesce(s.sales, 0)::numeric(12,2), coalesce(r.returns, 0)::numeric(12,2),
         (coalesce(s.sales, 0) - coalesce(r.returns, 0))::numeric(12,2)
  from d left join s on s.day = d.day left join r on r.day = d.day
  order by d.day desc;
end $$;

create or replace function public.report_top_medicines(p_from date, p_to date, p_limit int default 20)
returns table (medicine_id bigint, name text, strength text, form text, units_per_pack int,
               units_sold bigint, revenue numeric, profit numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_admin boolean;
begin
  perform require_active();
  v_admin := is_admin();
  return query
  with s as (
    select id, total from sales
    where created_at >= (p_from::timestamp at time zone 'Asia/Karachi')
      and created_at < ((p_to + 1)::timestamp at time zone 'Asia/Karachi')
  ), t as (
    select sale_id, sum(line_total) as lines_total from sale_lines where sale_id in (select id from s) group by sale_id
  ), sl as (
    select l.medicine_id, l.qty_units, l.line_total, l.tax_amount, l.cost_total,
           case when t.lines_total > 0 then s.total / t.lines_total else 0 end as factor
    from sale_lines l join s on s.id = l.sale_id join t on t.sale_id = l.sale_id
  )
  select m.id, m.name, m.strength, m.form, m.units_per_pack,
         sum(sl.qty_units)::bigint,
         round(sum(sl.line_total * sl.factor), 2),
         case when v_admin then round(sum((sl.line_total - sl.tax_amount) * sl.factor - sl.cost_total), 2) end
  from sl join medicines m on m.id = sl.medicine_id
  group by m.id
  order by 7 desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
end $$;

-- Value of stock on hand at cost (owner) and at sale price (everyone).
create or replace function public.report_stock_value()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  perform require_active();
  select jsonb_build_object(
    'medicines_in_stock', count(distinct b.medicine_id) filter (where b.qty_on_hand > 0 and b.expiry_date >= today_pk()),
    'at_cost', case when is_admin() then round(coalesce(sum(b.qty_on_hand * b.cost_per_unit) filter (where b.expiry_date >= today_pk()), 0), 2) end,
    'at_sale_price', round(coalesce(sum(b.qty_on_hand * m.sale_price_per_pack / m.units_per_pack) filter (where b.expiry_date >= today_pk()), 0), 2),
    'expired_at_cost', case when is_admin() then round(coalesce(sum(b.qty_on_hand * b.cost_per_unit) filter (where b.expiry_date < today_pk()), 0), 2) end,
    'expired_batches', count(*) filter (where b.qty_on_hand > 0 and b.expiry_date < today_pk())
  ) into v
  from batches b join medicines m on m.id = b.medicine_id;
  return v;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
