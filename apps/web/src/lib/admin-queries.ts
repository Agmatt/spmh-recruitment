import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminApplication = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  cover_letter: string | null;
  cv_path: string;
  created_at: string;
  job_posting_id: string;
  job_postings: { title: string; slug: string } | null;
};

export async function listApplications(
  supabase: SupabaseClient
): Promise<AdminApplication[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id, full_name, email, phone, status, cover_letter, cv_path, created_at, job_posting_id,
      job_postings ( title, slug )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin-queries] listApplications error:', error);
    return [];
  }
  return (data ?? []) as AdminApplication[];
}

export async function listJobsForFilter(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('job_postings')
    .select('id, title, slug, status')
    .order('created_at', { ascending: false });
  return data ?? [];
}