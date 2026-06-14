-- Enable Supabase Realtime for live queue updates on the barber dashboard.
alter table public.barber_queue replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.barber_queue;
exception
  when duplicate_object then null;
end $$;

-- Owners manage the shop; hide from the public barber picker unless explicitly enabled.
update public.barber_members
set is_accepting_walk_ins = false
where role = 'owner'
  and is_accepting_walk_ins = true;
