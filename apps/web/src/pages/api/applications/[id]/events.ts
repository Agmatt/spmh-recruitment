import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '../../../../lib/supabase-ssr';

export const prerender = false;

type EventRow = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_id: string | null;
};

export const GET: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id) return new Response('Bad request', { status: 400 });

  const supabase = createSupabaseServerClient(context);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data, error } = await supabase
    .from('application_events')
    .select('id, event_type, from_status, to_status, metadata, created_at, actor_id')
    .eq('application_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[events] error:', error);
    return new Response('Query failed', { status: 500 });
  }

  const actorIds = Array.from(
    new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))
  ) as string[];

  const emailMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const url = import.meta.env.PUBLIC_SUPABASE_URL;
    const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const admin = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      for (const uid of actorIds) {
        const { data: u } = await admin.auth.admin.getUserById(uid);
        if (u?.user?.email) emailMap.set(uid, u.user.email);
      }
    }
  }

  const events = (data ?? []).map((r: EventRow) => ({
    id: r.id,
    event_type: r.event_type,
    from_status: r.from_status,
    to_status: r.to_status,
    metadata: r.metadata ?? {},
    created_at: r.created_at,
    actor_email: r.actor_id ? emailMap.get(r.actor_id) ?? null : null,
  }));

  return new Response(JSON.stringify({ events }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};