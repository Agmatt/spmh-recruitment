import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const GET: APIRoute = async (context) => {
  // ── Auth ──────────────────────────────────────────────
  const expected = import.meta.env.CRON_SECRET;
  if (!expected) {
    console.error('[cron/archive] CRON_SECRET not set');
    return json({ error: 'Server misconfigured' }, 500);
  }

  const authHeader = context.request.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${expected}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // ── Client ────────────────────────────────────────────
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[cron/archive] Missing Supabase env vars');
    return json({ error: 'Server misconfigured' }, 500);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Find published jobs past their closes_at ─────────
  const now = new Date().toISOString();

  const { data: expired, error: findErr } = await admin
    .from('job_postings')
    .select('id, slug, title')
    .eq('status', 'published')
    .not('closes_at', 'is', null)
    .lt('closes_at', now);

  if (findErr) {
    console.error('[cron/archive] find error:', findErr);
    return json({ error: 'Query failed' }, 500);
  }

  const jobs = expired ?? [];

  if (jobs.length === 0) {
    return json({ ok: true, archived: 0, reason: 'none_expired' }, 200);
  }

  // ── Archive them ──────────────────────────────────────
  const ids = jobs.map((j) => j.id);

  const { error: updateErr } = await admin
    .from('job_postings')
    .update({ status: 'archived' })
    .in('id', ids);

  if (updateErr) {
    console.error('[cron/archive] update error:', updateErr);
    return json({ error: 'Update failed' }, 500);
  }

  console.log(
    '[cron/archive] archived',
    jobs.length,
    'job(s):',
    jobs.map((j) => j.slug).join(', ')
  );

  return json(
    {
      ok: true,
      archived: jobs.length,
      jobs: jobs.map((j) => ({ id: j.id, slug: j.slug, title: j.title })),
    },
    200
  );
};