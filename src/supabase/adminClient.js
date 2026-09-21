import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client — used ONLY for admin operations
 * like creating/managing coordinator auth accounts.
 *
 * REQUIRES: VITE_SUPABASE_SERVICE_KEY in .env
 * This is the service_role key from Supabase Dashboard > Project Settings > API.
 * Never expose this key in public-facing code outside the admin panel.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const serviceKey  = import.meta.env.VITE_SUPABASE_SERVICE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasServiceKey = !!import.meta.env.VITE_SUPABASE_SERVICE_KEY;

export const supabaseAdmin = serviceKey
  ? createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export const isAdminAvailable = !!supabaseUrl && !!serviceKey;
