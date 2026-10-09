/// <reference types="astro/client" />

import type { SupabaseClient, User } from '@supabase/supabase-js';

declare namespace App {
  interface Locals {
    user: User | null;
    admin: { role: string; full_name: string | null } | null;
    supabase: SupabaseClient;
  }
}