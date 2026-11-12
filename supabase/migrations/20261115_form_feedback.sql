-- משובי לקוחות: טופס ציבורי (QR על ההזמנות) עם דירוג 1–5, טקסט חופשי ותמונות.
-- ההגדרות (השאלות) נשמרות בתוך config.feedback של טופס ההזמנות; התשובות כאן.
-- הטבלה סגורה לגמרי (RLS בלי מדיניות) — גישה רק דרך הפונקציות: שליחה פתוחה לכולם, קריאה רק עם המפתח של בעלת הטופס.
create table if not exists public.form_feedback (
  id bigserial primary key,
  slug text not null references public.order_forms(slug) on delete cascade,
  payload jsonb not null,
  photos jsonb not null default '[]'::jsonb,
  rating smallint,
  created_at timestamptz not null default now(),
  imported_at timestamptz
);
create index if not exists form_feedback_slug_id on public.form_feedback(slug, id);
alter table public.form_feedback enable row level security;
revoke all on public.form_feedback from anon, authenticated;

create or replace function public.feedback_submit(p_slug text, p_fb jsonb)
 returns table(ok boolean, msg text)
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  cfg jsonb; fb jsonb; q jsonb; v text; n int; overall int; answers jsonb := '[]'::jsonb; photos jsonb := '[]'::jsonb; ph jsonb; s text;
  digits text; ord int; filled int := 0;
begin
  select config into cfg from public.order_forms where slug = p_slug;
  if cfg is null then return query select false, 'הטופס לא נמצא'; return; end if;
  fb := cfg->'feedback';
  if fb is null or coalesce((fb->>'on')::boolean, false) = false then return query select false, 'טופס המשוב סגור כרגע'; return; end if;
  if pg_column_size(p_fb) > 2200000 then return query select false, 'התמונות גדולות מדי'; return; end if;
  if (select count(*) from public.form_feedback where slug = p_slug and created_at > now() - interval '1 hour') >= 40 then
    return query select false, 'נשלחו הרבה משובים בזמן קצר. נסי שוב מאוחר יותר'; return; end if;
  for q in select * from jsonb_array_elements(coalesce(fb->'questions', '[]'::jsonb)) loop
    v := nullif(trim(coalesce(p_fb->'answers'->>(q->>'id'), '')), '');
    if q->>'type' = 'rating' then
      if v is not null then
        begin n := v::int; exception when others then n := null; end;
        if n is null or n < 1 or n > 5 then return query select false, 'דירוג לא תקין'; return; end if;
        if overall is null then overall := n; end if; -- שאלת הדירוג הראשונה היא הדירוג הכללי
        answers := answers || jsonb_build_array(jsonb_build_object('id', q->>'id', 'type', 'rating', 'label', q->>'label', 'value', n));
        filled := filled + 1;
      elsif coalesce((q->>'required')::boolean, false) then
        return query select false, 'נא לסמן דירוג: ' || (q->>'label'); return;
      end if;
    else
      if v is not null then
        answers := answers || jsonb_build_array(jsonb_build_object('id', q->>'id', 'type', 'text', 'label', q->>'label', 'value', left(v, 2000)));
        filled := filled + 1;
      elsif coalesce((q->>'required')::boolean, false) then
        return query select false, 'נא למלא: ' || (q->>'label'); return;
      end if;
    end if;
  end loop;
  if filled = 0 then return query select false, 'נא לענות לפחות על שאלה אחת'; return; end if;
  if coalesce((fb->>'photos')::boolean, true) and jsonb_typeof(p_fb->'photos') = 'array' then
    if jsonb_array_length(p_fb->'photos') > 3 then return query select false, 'אפשר לצרף עד 3 תמונות'; return; end if;
    for ph in select * from jsonb_array_elements(p_fb->'photos') loop
      if jsonb_typeof(ph) <> 'string' then return query select false, 'התמונה לא נתמכת'; return; end if;
      s := ph #>> '{}';
      if length(s) > 700000 or s !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' then return query select false, 'התמונה לא נתמכת'; return; end if;
      photos := photos || jsonb_build_array(s);
    end loop;
  end if;
  digits := regexp_replace(coalesce(p_fb->>'phone', ''), '\D', '', 'g');
  if digits <> '' and (length(digits) < 9 or length(digits) > 13) then return query select false, 'מספר הטלפון לא תקין'; return; end if;
  ord := case when coalesce(p_fb->>'order', '') ~ '^\d{1,8}$' then (p_fb->>'order')::int end;
  insert into public.form_feedback(slug, payload, photos, rating) values (p_slug, jsonb_build_object(
    'answers', answers, 'name', left(trim(coalesce(p_fb->>'name', '')), 60), 'phone', case when digits <> '' then left(trim(p_fb->>'phone'), 20) else '' end,
    'consent', coalesce(p_fb->>'consent', '') = 'true', 'order', ord, 'photos', jsonb_array_length(photos)), photos, overall);
  return query select true, null::text;
end $function$;

create or replace function public.feedback_inbox(p_key text, p_slug text)
 returns table(id bigint, payload jsonb, rating smallint, created_at timestamptz, fetched_at timestamptz)
 language sql stable security definer set search_path to 'public', 'extensions'
as $function$
  select b.id, b.payload, b.rating, b.created_at, now()
  from public.form_feedback b join public.order_forms f on f.slug = b.slug
  where b.slug = p_slug and f.owner_hash = encode(extensions.digest(p_key, 'sha256'), 'hex') and b.imported_at is null
  order by b.id limit 100;
$function$;

create or replace function public.feedback_ack(p_key text, p_slug text, p_ids bigint[])
 returns integer language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare n int;
begin
  update public.form_feedback b set imported_at = coalesce(b.imported_at, now()) from public.order_forms f
  where f.slug = b.slug and b.slug = p_slug and b.id = any(p_ids) and f.owner_hash = encode(extensions.digest(p_key, 'sha256'), 'hex');
  get diagnostics n = row_count; return n;
end $function$;

create or replace function public.feedback_photos(p_key text, p_slug text, p_id bigint)
 returns jsonb language sql stable security definer set search_path to 'public', 'extensions'
as $function$
  select b.photos from public.form_feedback b join public.order_forms f on f.slug = b.slug
  where b.slug = p_slug and b.id = p_id and f.owner_hash = encode(extensions.digest(p_key, 'sha256'), 'hex');
$function$;

create or replace function public.feedback_delete(p_key text, p_slug text, p_id bigint)
 returns integer language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare n int;
begin
  delete from public.form_feedback b using public.order_forms f
  where f.slug = b.slug and b.slug = p_slug and b.id = p_id and f.owner_hash = encode(extensions.digest(p_key, 'sha256'), 'hex');
  get diagnostics n = row_count; return n;
end $function$;
