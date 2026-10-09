import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminPartnership = {
  id: string;
  org_name: string;
  org_type: string | null;
  country: string | null;
  website: string | null;
  contact_name: string;
  contact_role: string | null;
  contact_email: string;
  contact_phone: string | null;
  collaboration_areas: string | null;
  proposal: string | null;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | null;
  created_at: string;
};

export async function listPartnerships(
  supabase: SupabaseClient
): Promise<AdminPartnership[]> {
  const { data, error } = await supabase
    .from('partnerships')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[partnership-queries] listPartnerships error:', error);
    return [];
  }
  return (data ?? []) as AdminPartnership[];
}