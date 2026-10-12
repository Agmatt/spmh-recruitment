import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createSupabaseServerClient } from '../../../../lib/supabase-ssr';

export const prerender = false;

const Schema = z.object({
  notes: z.string().max(5000).nullable(),
});

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id) return json({ error: 'Missing id' }, 400);

  const supabase = createSupabaseServerClient(context);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const body = await context.request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid data' }, 400);

  const { error } = await supabase
    .from('applications')
    .update({ notes: parsed.data.notes ?? null })
    .eq('id', id);

  if (error) {
    console.error('[notes] update error:', error);
    return json({ error: 'Save failed' }, 500);
  }

  return json({ ok: true }, 200);
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}