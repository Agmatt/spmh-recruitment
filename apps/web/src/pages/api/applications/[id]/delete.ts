import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../lib/supabase-ssr';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id) {
    return json({ error: 'Missing id' }, 400);
  }

  const supabase = createSupabaseServerClient(context);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Verify admin
  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adminRow) {
    return json({ error: 'Forbidden' }, 403);
  }

  // Fetch CV path before deleting the row
  const { data: app, error: fetchErr } = await supabase
    .from('applications')
    .select('cv_path')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    console.error('[applications/delete] fetch error:', fetchErr);
    return json({ error: `Lookup failed: ${fetchErr.message}` }, 500);
  }

  if (!app) {
    return json({ error: 'Application not found' }, 404);
  }

  // Delete the application row (cascades to application_events)
  const { error: deleteErr } = await supabase
    .from('applications')
    .delete()
    .eq('id', id);

  if (deleteErr) {
    console.error('[applications/delete] delete error:', deleteErr);
    return json({ error: `Delete failed: ${deleteErr.message}` }, 500);
  }

  // Best-effort CV cleanup via service role (bypasses storage RLS).
  // Row already deleted — storage failure does not fail the request.
  if (app.cv_path) {
    const { error: storageErr } = await supabaseAdmin.storage
      .from('cvs')
      .remove([app.cv_path]);

    if (storageErr) {
      console.error('[applications/delete] storage cleanup failed:', storageErr);
    }
  }

  return json({ ok: true }, 200);
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}