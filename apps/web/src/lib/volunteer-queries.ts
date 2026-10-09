import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminVolunteer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  occupation: string | null;
  interests: string | null;
  availability: string | null;
  message: string | null;
  status: 'active' | 'pending' | 'inactive' | null;
  created_at: string;
};

export async function listVolunteers(
  supabase: SupabaseClient
): Promise<AdminVolunteer[]> {
  const { data, error } = await supabase
    .from('volunteers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[volunteer-queries] listVolunteers error:', error);
    return [];
  }
  return (data ?? []) as AdminVolunteer[];
}