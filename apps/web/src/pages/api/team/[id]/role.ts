import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createSupabaseServerClient } from '../../../../lib/supabase-ssr';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireSuperAdmin } from '../../../../lib/team-guard';

export const prerender = false;

const Schema = z.object({
  role: z.enum(['hr_admin', 'super_admin']),
});

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id) return json({ error: 'Missing id' }, 400);

  const supabase = createSupabaseServerClient(context);
  const guard = await requireSuperAdmin(supabase);
  if (!guard.ok) return json({ error: guard.message }, guard.status);

  const body = await context.request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid role' }, 400);

  // Guard: cannot demote yourself
  if (id === guard.user.id && parsed.data.role !== 'super_admin') {
    return json(
      { error: 'You cannot change your own role. Ask another super admin.' },
      400
    );
  }

  // Guard: if demoting the only super_admin, block
  if (parsed.data.role === 'hr_admin') {
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

  const { error } = await supabaseAdmin
    .from('admins')
    .update({ role: parsed.data.role })
    .eq('user_id', id);

  if (error) {
    console.error('[team/role] error:', error);
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