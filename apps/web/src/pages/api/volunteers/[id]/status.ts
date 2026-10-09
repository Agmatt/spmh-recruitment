import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createSupabaseServerClient } from '../../../../lib/supabase-ssr';

export const prerender = false;

const Schema = z.object({
  status: z.enum(['pending', 'active', 'inactive', 'archived']),
});

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id) return new Response('Bad request', { status: 400 });

  const supabase = createSupabaseServerClient(context);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = await context.request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid status' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { error } = await supabase
    .from('volunteers')
    .update({ status: parsed.data.status })
    .eq('id', id);

  if (error) {
    console.error('[volunteers/status] error:', error);
    return new Response(JSON.stringify({ error: 'Update failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};