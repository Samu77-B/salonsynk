-- 4-digit passcode hash for staff admin panel access.
-- Stored as a bcrypt/sha256 hash, never plain text.
alter table public.salon_members
  add column if not exists passcode_hash text;
