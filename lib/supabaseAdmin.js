import { createClient } from '@supabase/supabase-js';

// Server-only klient so service_role kľúčom (API routes). Nikdy neimportovať do 'use client'.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
