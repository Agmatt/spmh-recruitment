import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createSupabaseServerClient } from '../../../lib/supabase-ssr';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireSuperAdmin } from '../../../lib/team-guard';
import { sendAdminInvite } from '../../../lib/email';

export const prerender = false;

const Schema = z.object({
  email: z.string().trim().email().max(200),
  full_name: z.string().trim().min(2).max(100),
  role: z.enum(['hr_admin', 'super_admin']),
});

export const POST: APIRoute = async (context) => {
  const supabase = createSupabaseServerClient(context);
  const guard = await requireSuperAdmin(supabase);
  if (!guard.ok) return json({ error: guard.message }, guard.status);

  const body = await context.request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Invalid data', details: parsed.error.flatten() }, 400);
  }

  const { email, full_name, role } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // 1. Check if an auth user with this email already exists
  const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const existing = existingList?.users.find(
    (u) => u.email?.toLowerCase() === normalizedEmail
  );

  let userId: string;

  if (existing) {
    // User already has an auth account — just grant admin access
    userId = existing.id;
  } else {
    // Create a fresh auth user with a random strong password.
    // They'll set their own password via the invite email.
    const tempPassword = crypto.randomUUID() + '-' + crypto.randomUUID();

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name },
      });

    if (createErr || !created.user) {
      console.error('[team/invite] createUser error:', createErr);
      return json(
        { error: createErr?.message ?? 'Could not create user' },
        500
      );
    }

    userId = created.user.id;
  }

  // 2. Check if they're already an admin
  const { data: alreadyAdmin } = await supabaseAdmin
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (alreadyAdmin) {
    return json({ error: 'This person is already a team member.' }, 409);
  }

  // 3. Insert into admins
  const { error: insertErr } = await supabaseAdmin.from('admins').insert({
    user_id: userId,
    role,
    full_name,
    invited_by: guard.user.id,
  });

  if (insertErr) {
    console.error('[team/invite] insert error:', insertErr);
    return json({ error: insertErr.message }, 500);
  }

  // 4. Generate a password-setup link via Supabase
  const site =
    import.meta.env.PUBLIC_SITE_URL ?? 'https://recruitment.spmh.co.ke';

  const { data: linkData, error: linkErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo: `${site}/admin/accept-invite` },
    });

  if (linkErr || !linkData?.properties?.action_link) {
    console.error('[team/invite] generateLink error:', linkErr);
    // User + admin were created — just warn about email
    return json(
      {
        ok: true,
        warning:
          'Team member added, but invite email could not be generated. Ask them to use "Forgot password" on the login page.',
      },
      200
    );
  }

  // 5. Send custom email via Resend
  const result = await sendAdminInvite({
    to: normalizedEmail,
    inviteeName: full_name,
    inviterName: guard.user.email ?? 'an administrator',
    setupLink: linkData.properties.action_link,
  });

  if (!result.success) {
    console.error('[team/invite] email send failed:', result.error);
    return json(
      {
        ok: true,
        warning:
          'Team member added, but the invite email failed to send. Ask them to use "Forgot password" on the login page.',
      },
      200
    );
  }

  return json({ ok: true }, 200);
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}