import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminJob = {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published' | 'archived' | 'closed';
  employment_type: string;
  location: string;
  summary: string | null;
  description_md: string;
  requirements_md: string | null;
  department_id: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  published_at: string | null;
  closes_at: string | null;
  created_at: string;
  updated_at: string;
  departments: { id: string; slug: string; label: string } | null;
};

export async function listAllJobs(supabase: SupabaseClient): Promise<AdminJob[]> {
  const { data, error } = await supabase
    .from('job_postings')
    .select(`
      id, slug, title, status, employment_type, location, summary,
      description_md, requirements_md, department_id,
      salary_min, salary_max, salary_currency, salary_period,
      published_at, closes_at, created_at, updated_at,
      departments ( id, slug, label )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[job-queries] listAllJobs error:', error);
    return [];
  }
  return (data ?? []) as unknown as AdminJob[];
}

export async function getJobById(
  supabase: SupabaseClient,
  id: string
): Promise<AdminJob | null> {
  const { data, error } = await supabase
    .from('job_postings')
    .select(`
      id, slug, title, status, employment_type, location, summary,
      description_md, requirements_md, department_id,
      salary_min, salary_max, salary_currency, salary_period,
      published_at, closes_at, created_at, updated_at,
      departments ( id, slug, label )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[job-queries] getJobById error:', error);
    return null;
  }
  return (data ?? null) as unknown as AdminJob | null;
}

export async function listDepartments(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('departments')
    .select('id, slug, label, sort_order')
    .order('sort_order', { ascending: true });
  return data ?? [];
}