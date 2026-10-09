import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createSupabaseServerClient } from '../../../../lib/supabase-ssr';

export const prerender = false;

const StatusSchema = z.object({
  status: z.enum([
    'pending',
    'reviewing',
    'shortlisted',
    'interview',
    'offer',
    'hired',
    'rejected',
    'withdrawn',
  ]),
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
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid status' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Fetch current status for audit trail
  const { data: before } = await supabase
    .from('applications')
    .select('status')
    .eq('id', id)
    .maybeSingle();

  if (!before) {
    return new Response(JSON.stringify({ error: 'Application not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { error: updateErr } = await supabase
    .from('applications')
    .update({ status: parsed.data.status })
    .eq('id', id);

  if (updateErr) {
    console.error('[status update] error:', updateErr);
    return new Response(JSON.stringify({ error: 'Update failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Log to audit trail
  await supabase.from('application_events').insert({
    application_id: id,
    actor_id: user.id,
    event_type: 'status_changed',
    from_status: before.status,
    to_status: parsed.data.status,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};