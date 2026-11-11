-- טופס ההזמנות: קופון "חד־פעמי לכל לקוחה" נאכף בשרת.
-- 1. oncePerCustomer — אם כבר הגיעה מהטופס הזמנה עם אותו קוד מאותו מספר טלפון, הקוד נדחה.
-- 2. firstOrderOnly / oncePerCustomer — השוואת טלפון לפי 9 הספרות האחרונות (050… ו־+97250… הם אותה לקוחה).
-- כל השאר זהה ל־20261111_form_submit_coupons.sql.
CREATE OR REPLACE FUNCTION public.form_submit(p_slug text, p_order jsonb)
 RETURNS TABLE(ok boolean, ref text, msg text, total numeric, due numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cfg jsonb; d date; today date := (now() at time zone 'Asia/Jerusalem')::date;
  dow int; day jsonb; cap int; booked int; it jsonb; prod jsonb; q int; opt text; maxq int;
  items jsonb := '[]'::jsonb; subtotal numeric := 0; fee numeric := 0; method text; digits text; new_id bigint;
  pay_mode text; pct numeric; amount_due numeric;
  cp jsonb; cp_code text; cp_val numeric; cp_from date; cp_to date; cp_max int; discount numeric := 0;
begin
  select config into cfg from public.order_forms where slug = p_slug;
  if cfg is null then return query select false, null::text, 'הטופס לא נמצא', null::numeric, null::numeric; return; end if;
  if coalesce((cfg->>'open')::boolean, true) = false then return query select false, null::text, coalesce(cfg->>'closedMsg', 'ההזמנות סגורות כרגע'), null::numeric, null::numeric; return; end if;
  if pg_column_size(p_order) > 30000 then return query select false, null::text, 'ההזמנה גדולה מדי', null::numeric, null::numeric; return; end if;
  if length(trim(coalesce(p_order->>'name', ''))) < 2 then return query select false, null::text, 'נא למלא שם', null::numeric, null::numeric; return; end if;
  digits := regexp_replace(coalesce(p_order->>'phone', ''), '\D', '', 'g');
  if length(digits) < 9 or length(digits) > 13 then return query select false, null::text, 'נא למלא טלפון תקין', null::numeric, null::numeric; return; end if;
  if (select count(*) from public.form_orders where slug = p_slug and phone_digits = digits and created_at > now() - interval '1 hour') >= 4
     or (select count(*) from public.form_orders where slug = p_slug and created_at > now() - interval '1 hour') >= 40 then
    return query select false, null::text, 'נשלחו הרבה הזמנות בזמן קצר. נסי שוב מאוחר יותר', null::numeric, null::numeric; return;
  end if;
  begin d := (p_order->>'date')::date; exception when others then d := null; end;
  if d is null then return query select false, null::text, 'נא לבחור תאריך', null::numeric, null::numeric; return; end if;
  if d < today + coalesce((cfg->>'leadDays')::int, 0) or d > today + coalesce((cfg->>'maxDaysAhead')::int, 60) then
    return query select false, null::text, 'התאריך שנבחר לא זמין להזמנה', null::numeric, null::numeric; return; end if;
  dow := extract(dow from d)::int; day := cfg->'days'->(dow::text);
  if day is null or coalesce((day->>'on')::boolean, false) = false then return query select false, null::text, 'ביום הזה אין איסוף/משלוחים', null::numeric, null::numeric; return; end if;
  if coalesce(cfg->'blocked', '[]'::jsonb) ? d::text then return query select false, null::text, 'התאריך הזה סגור להזמנות', null::numeric, null::numeric; return; end if;
  cap := coalesce((cfg->>'capacity')::int, 0);
  if cap > 0 then
    booked := coalesce((cfg->'load'->>d::text)::int, 0) + (select count(*) from public.form_orders where slug = p_slug and order_date = d and imported_at is null);
    if booked >= cap then return query select false, null::text, 'היום הזה כבר מלא. נא לבחור תאריך אחר', null::numeric, null::numeric; return; end if;
  end if;
  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items') = 0 then return query select false, null::text, 'נא לבחור לפחות מוצר אחד', null::numeric, null::numeric; return; end if;
  for it in select * from jsonb_array_elements(p_order->'items') loop
    select p into prod from jsonb_array_elements(cfg->'products') p where p->>'id' = it->>'id';
    if prod is null then return query select false, null::text, 'אחד המוצרים כבר לא זמין. רענני את הדף', null::numeric, null::numeric; return; end if;
    begin q := (it->>'qty')::int; exception when others then q := 0; end;
    maxq := coalesce(nullif(prod->>'maxQty', '')::int, 50);
    if q < 1 or q > maxq then return query select false, null::text, 'כמות לא תקינה עבור ' || (prod->>'name'), null::numeric, null::numeric; return; end if;
    opt := nullif(trim(coalesce(it->>'option', '')), '');
    if jsonb_array_length(coalesce(prod->'options', '[]'::jsonb)) > 0 and (opt is null or not (prod->'options' ? opt)) then
      return query select false, null::text, 'נא לבחור סוג עבור ' || (prod->>'name'), null::numeric, null::numeric; return; end if;
    items := items || jsonb_build_array(jsonb_build_object('id', prod->>'id', 'name', prod->>'name', 'qty', q, 'price', (prod->>'price')::numeric,
      'option', opt, 'note', left(coalesce(it->>'note', ''), 300)));
    subtotal := subtotal + q * (prod->>'price')::numeric;
  end loop;
  method := case when p_order->>'method' = 'delivery' then 'delivery' else 'pickup' end;
  if method = 'delivery' then
    if coalesce((cfg->'delivery'->>'on')::boolean, false) = false then return query select false, null::text, 'אין משלוחים כרגע', null::numeric, null::numeric; return; end if;
    if length(trim(coalesce(p_order->>'address', ''))) < 3 then return query select false, null::text, 'נא למלא כתובת למשלוח', null::numeric, null::numeric; return; end if;
    fee := coalesce((cfg->'delivery'->>'fee')::numeric, 0);
    if coalesce((cfg->'delivery'->>'freeAbove')::numeric, 0) > 0 and subtotal >= (cfg->'delivery'->>'freeAbove')::numeric then fee := 0; end if;
  end if;
  if subtotal < coalesce((cfg->>'minOrder')::numeric, 0) then return query select false, null::text, 'סכום ההזמנה המינימלי הוא ₪' || (cfg->>'minOrder'), null::numeric, null::numeric; return; end if;
  -- קוד הנחה: נבדק מול הקופונים שפורסמו בטופס. כל הודעות השגיאה מתחילות ב"קוד ההנחה" (הדף מזהה אותן לפי זה).
  cp_code := upper(trim(coalesce(p_order->>'couponCode', '')));
  if cp_code <> '' and coalesce(p_order->>'v', '') = '2' then
    select c into cp from jsonb_array_elements(coalesce(cfg->'coupons', '[]'::jsonb)) c where upper(c->>'code') = cp_code limit 1;
    if cp is null then return query select false, null::text, 'קוד ההנחה לא קיים או כבר לא פעיל', null::numeric, null::numeric; return; end if;
    begin cp_from := nullif(cp->>'from', '')::date; exception when others then cp_from := null; end;
    begin cp_to := nullif(cp->>'to', '')::date; exception when others then cp_to := null; end;
    if cp_from is not null and today < cp_from then return query select false, null::text, 'קוד ההנחה עוד לא בתוקף', null::numeric, null::numeric; return; end if;
    if cp_to is not null and today > cp_to then return query select false, null::text, 'קוד ההנחה פג תוקף', null::numeric, null::numeric; return; end if;
    if subtotal < coalesce(nullif(cp->>'minOrder', '')::numeric, 0) then return query select false, null::text, 'קוד ההנחה תקף בהזמנה מעל ₪' || (cp->>'minOrder'), null::numeric, null::numeric; return; end if;
    cp_max := coalesce(nullif(cp->>'maxUses', '')::numeric, 0)::int;
    if cp_max > 0 and coalesce(nullif(cp->>'uses', '')::numeric, 0)::int
        + (select count(*) from public.form_orders where slug = p_slug and imported_at is null and upper(coalesce(payload->>'couponCode', '')) = cp_code) >= cp_max then
      return query select false, null::text, 'קוד ההנחה כבר נוצל עד הסוף', null::numeric, null::numeric; return; end if;
    if coalesce((cp->>'firstOrderOnly')::boolean, false) and exists (select 1 from public.form_orders where slug = p_slug and right(phone_digits, 9) = right(digits, 9)) then
      return query select false, null::text, 'קוד ההנחה מיועד להזמנה ראשונה בלבד', null::numeric, null::numeric; return; end if;
    -- חד־פעמי לכל לקוחה: אותו קוד + אותו מספר טלפון כבר הופיעו בהזמנה קודמת מהטופס
    if coalesce((cp->>'oncePerCustomer')::boolean, false) and exists (select 1 from public.form_orders
        where slug = p_slug and right(phone_digits, 9) = right(digits, 9) and upper(coalesce(payload->>'couponCode', '')) = cp_code) then
      return query select false, null::text, 'קוד ההנחה כבר נוצל במספר הטלפון הזה (הקוד חד־פעמי לכל לקוחה)', null::numeric, null::numeric; return; end if;
    cp_val := greatest(coalesce(nullif(cp->>'value', '')::numeric, 0), 0);
    discount := case when cp->>'type' = 'percent' then round(subtotal * least(cp_val, 100) / 100, 2) else least(cp_val, subtotal) end;
    cp_code := cp->>'code';
  else
    cp_code := '';
  end if;
  -- דרישת תשלום לאישור ההזמנה (אחרי ההנחה)
  pay_mode := coalesce(cfg->'pay'->>'mode', 'none');
  pct := least(greatest(coalesce((cfg->'pay'->>'pct')::numeric, 50), 1), 100);
  amount_due := case pay_mode when 'full' then subtotal + fee - discount when 'deposit' then ceil((subtotal + fee - discount) * pct / 100) else 0 end;
  insert into public.form_orders(slug, payload, order_date, phone_digits) values (p_slug, jsonb_build_object(
    'name', left(trim(p_order->>'name'), 80), 'phone', left(p_order->>'phone', 20), 'date', d::text, 'time', left(coalesce(p_order->>'time', ''), 5),
    'method', method, 'address', left(coalesce(p_order->>'address', ''), 200), 'allergies', left(coalesce(p_order->>'allergies', ''), 200),
    'notes', left(coalesce(p_order->>'notes', ''), 600), 'items', items, 'subtotal', subtotal, 'deliveryFee', fee,
    'couponCode', cp_code, 'couponDiscount', discount, 'total', subtotal + fee - discount,
    'payMode', pay_mode, 'amountDue', amount_due
  ), d, digits) returning id into new_id;
  return query select true, (1000 + new_id)::text, 'ok', subtotal + fee - discount, amount_due;
end $function$;
