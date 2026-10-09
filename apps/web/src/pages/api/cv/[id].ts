import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase-ssr';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id) return new Response('Bad request', { status: 400 });

  const supabase = createSupabaseServerClient(context);

  // RLS enforces admin-only via the is_admin() policy on storage.objects.
  // But we ALSO need to read the applications row to get the cv_path — the
  // policy on applications already enforces admin-only for SELECT.
  const { data: app, error } = await supabase
    .from('applications')
    .select('cv_path')
    .eq('id', id)
    .maybeSingle();

  if (error || !app) {
    return new Response('Not found', { status: 404 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from('cvs')
    .createSignedUrl(app.cv_path, 60 * 5); // 5 minutes

  if (signErr || !signed) {
    console.error('[api/cv] sign error:', signErr);
    return new Response('Could not generate link', { status: 500 });
  }

  return Response.redirect(signed.signedUrl, 302);
};