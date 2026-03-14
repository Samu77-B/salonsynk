-- Track when we last sent a "We Miss You" message to a client (so we don't spam; resend after next visit).
alter table public.clients
  add column if not exists we_miss_you_sent_at timestamptz;

comment on column public.clients.we_miss_you_sent_at is 'When we last sent a We Miss You / retention campaign to this client. Used to avoid duplicate sends until they visit again.';
