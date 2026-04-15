-- Audience segments for marketing campaigns (count + recipient list under RLS).

alter table public.email_campaigns
  add column if not exists audience_segment text not null default 'all',
  add column if not exists audience_service_id uuid null references public.services(id) on delete set null;

create or replace function public.count_campaign_recipients(
  p_salon_id uuid,
  p_segment text,
  p_service_id uuid default null
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.clients c
  where c.salon_id = p_salon_id
    and c.marketing_opt_in = true
    and c.email is not null
    and strpos(trim(c.email), '@') > 1
    and (
      coalesce(nullif(lower(trim(p_segment)), ''), 'all') = 'all'
      or (lower(trim(p_segment)) = 'male' and c.sex = 'male')
      or (lower(trim(p_segment)) = 'female' and c.sex = 'female')
      or (
        lower(trim(p_segment)) = 'no_show'
        and exists (
          select 1 from public.appointments a
          where a.salon_id = p_salon_id
            and a.client_id = c.id
            and a.status = 'no_show'
        )
      )
      or (
        lower(trim(p_segment)) = 'service_booked'
        and p_service_id is not null
        and exists (
          select 1 from public.appointments a
          where a.salon_id = p_salon_id
            and a.client_id = c.id
            and a.service_id = p_service_id
        )
      )
    );
$$;

create or replace function public.list_campaign_recipients(
  p_salon_id uuid,
  p_segment text,
  p_service_id uuid default null
)
returns table (id uuid, email text, name text)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.email, c.name
  from public.clients c
  where c.salon_id = p_salon_id
    and c.marketing_opt_in = true
    and c.email is not null
    and strpos(trim(c.email), '@') > 1
    and (
      coalesce(nullif(lower(trim(p_segment)), ''), 'all') = 'all'
      or (lower(trim(p_segment)) = 'male' and c.sex = 'male')
      or (lower(trim(p_segment)) = 'female' and c.sex = 'female')
      or (
        lower(trim(p_segment)) = 'no_show'
        and exists (
          select 1 from public.appointments a
          where a.salon_id = p_salon_id
            and a.client_id = c.id
            and a.status = 'no_show'
        )
      )
      or (
        lower(trim(p_segment)) = 'service_booked'
        and p_service_id is not null
        and exists (
          select 1 from public.appointments a
          where a.salon_id = p_salon_id
            and a.client_id = c.id
            and a.service_id = p_service_id
        )
      )
    );
$$;

grant execute on function public.count_campaign_recipients(uuid, text, uuid) to authenticated;
grant execute on function public.list_campaign_recipients(uuid, text, uuid) to authenticated;
