import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../lib/supabase-ssr';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id) return new Response('Bad request', { status: 400 });

  const supabase = createSupabaseServerClient(context);

  const { data: app } = await supabase
    .from('applications')
    .select('cv_path')
    .eq('id', id)
    .maybeSingle();

  if (!app) return new Response('Not found', { status: 404 });

  // Delete CV first
  await supabase.storage.from('cvs').remove([app.cv_path]);

  // Delete row (cascade removes application_events)
  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) {
    console.error('[delete application] error:', error);
    return new Response('Delete failed', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};