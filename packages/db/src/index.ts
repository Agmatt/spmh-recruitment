import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

export type { Database };

export type SupabaseDB = SupabaseClient<Database>;

export const createBrowserClient = (url: string, anonKey: string): SupabaseDB =>
  createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });

export const createServerClient = (
  url: string,
  serviceRoleKey: string,
): SupabaseDB =>
  createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });