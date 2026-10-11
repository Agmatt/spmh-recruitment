import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../lib/supabase-ssr';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireSuperAdmin } from '../../../../lib/team-guard';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id) return json({ error: 'Missing id' }, 400);

  const supabase = createSupabaseServerClient(context);
  const guard = await requireSuperAdmin(supabase);
  if (!guard.ok) return json({ error: guard.message }, guard.status);

  if (id === guard.user.id) {
    return json({ error: 'You cannot remove yourself.' }, 400);
  }

  const { data: target } = await supabaseAdmin
    .from('admins')
    .select('role')
    .eq('user_id', id)
    .maybeSingle();

  if (!target) return json({ error: 'Not found' }, 404);

  // Guard: cannot remove last super_admin
  if (target.role === 'super_admin') {
    const { count } = await supabaseAdmin
      .from('admins')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'super_admin');

    if ((count ?? 0) <= 1) {
      return json(
        { error: 'There must be at least one super admin.' },
        400
      );
    }
  }

  // Remove from admins — we do NOT delete the auth.users row.
  // This preserves any audit trails and lets the person be re-added
  // easily later. The middleware blocks sign-in once admins row is gone.
  const { error } = await supabaseAdmin
    .from('admins')
    .delete()
    .eq('user_id', id);

  if (error) {
    console.error('[team/remove] error:', error);
    return json({ error: error.message }, 500);
  }

  return json({ ok: true }, 200);
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}