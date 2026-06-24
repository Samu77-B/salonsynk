/**
 * Barber module Supabase helpers.
 * Re-exports shared core clients; add barber-specific queries here.
 */
export { createClient } from "@core/supabase/server";
export { createAdminClient } from "@core/supabase/admin";
export { getIsSuperAdmin } from "@core/supabase/admin-auth";
