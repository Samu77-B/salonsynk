-- Enable Realtime for barber appointment inserts (manager dashboard booking alerts).
alter table public.barber_appointments replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.barber_appointments;
exception
  when duplicate_object then null;
end $$;
