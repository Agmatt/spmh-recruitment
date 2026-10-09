import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createSupabaseServerClient } from '../../../lib/supabase-ssr';

export const prerender = false;

const Schema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().min(3).max(100).regex(/^[a-z0-9-]+$/),
  department_id: z.string().uuid().nullable().optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'internship', 'locum']),
  location: z.string().trim().min(2).max(120),
  summary: z.string().trim().max(500).optional().or(z.literal('')),
  description_md: z.string().trim().min(10),
  requirements_md: z.string().trim().optional().or(z.literal('')),
  salary_min: z.coerce.number().int().positive().nullable().optional(),
  salary_max: z.coerce.number().int().positive().nullable().optional(),
  salary_currency: z.string().trim().max(8).default('KES'),
  salary_period: z.string().trim().max(16).default('month'),
  closes_at: z.string().optional().or(z.literal('')),
});

export const POST: APIRoute = async (context) => {
  const supabase = createSupabaseServerClient(context);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = await context.request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid data', details: parsed.error.flatten() }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }

  const d = parsed.data;

  const { data, error } = await supabase
    .from('job_postings')
    .insert({
      slug: d.slug,
      title: d.title,
      department_id: d.department_id ?? null,
      employment_type: d.employment_type,
      location: d.location,
      summary: d.summary || null,
      description_md: d.description_md,
      requirements_md: d.requirements_md || null,
      salary_min: d.salary_min ?? null,
      salary_max: d.salary_max ?? null,
      salary_currency: d.salary_currency || 'KES',
      salary_period: d.salary_period || 'month',
      closes_at: d.closes_at || null,
      status: 'draft',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[jobs/create] error:', error);
    const isUnique = error.code === '23505';
    return new Response(
      JSON.stringify({
        error: isUnique
          ? 'That slug is already in use. Choose another.'
          : 'Could not create job.',
      }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};