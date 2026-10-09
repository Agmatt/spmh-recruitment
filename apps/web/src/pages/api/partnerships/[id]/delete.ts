import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../lib/supabase-ssr';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id) return new Response('Bad request', { status: 400 });

  const supabase = createSupabaseServerClient(context);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { error } = await supabase.from('partnerships').delete().eq('id', id);

  if (error) {
    console.error('[partnerships/delete] error:', error);
    return new Response(JSON.stringify({ error: 'Delete failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};