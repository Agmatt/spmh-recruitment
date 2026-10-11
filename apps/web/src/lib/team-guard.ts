import type { SupabaseClient, User } from '@supabase/supabase-js';

export type TeamGuardResult =
  | { ok: true; user: User; role: 'super_admin' }
  | { ok: false; status: number; message: string };

export async function requireSuperAdmin(
  supabase: SupabaseClient
): Promise<TeamGuardResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const { data: adminRow } = await supabase
    .from('admins')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adminRow || adminRow.role !== 'super_admin') {
    return { ok: false, status: 403, message: 'Forbidden — super admin required' };
  }

  return { ok: true, user, role: 'super_admin' };
}