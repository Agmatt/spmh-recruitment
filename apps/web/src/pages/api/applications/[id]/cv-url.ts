import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../lib/supabase-ssr';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id) return new Response('Bad request', { status: 400 });

  const supabase = createSupabaseServerClient(context);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: app, error } = await supabase
    .from('applications')
    .select('cv_path')
    .eq('id', id)
    .maybeSingle();

  if (error || !app || !app.cv_path) {
    console.error('[cv-url] lookup failed:', { error, app });
    return new Response('Not found', { status: 404 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from('cvs')
    .createSignedUrl(app.cv_path, 60 * 60);

  if (signErr || !signed) {
    console.error('[cv-url] sign error:', signErr);
    return new Response('Could not generate link', { status: 500 });
  }

  return new Response(JSON.stringify({ url: signed.signedUrl }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
