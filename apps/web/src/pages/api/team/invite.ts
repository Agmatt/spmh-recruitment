import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '../../../lib/supabase-ssr';
import { requireSuperAdmin } from '../../../lib/team-guard';
import { sendAdminInvite } from '../../../lib/email';

export const prerender = false;

const Schema = z.object({
  email: z.string().trim().email().max(200),
  full_name: z.string().trim().min(2).max(100),
  role: z.enum(['hr_admin', 'super_admin']),
});

// Service-role client with an explicit fetch timeout so DNS/network
// failures fail fast instead of hanging for the OS default (~10s+).
function buildAdminClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/web/.env'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20_000);
        return fetch(input, { ...init, signal: controller.signal }).finally(() =>
          clearTimeout(timer)
        );
      },
    },
  });
}

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

  let admin;
  try {
    admin = buildAdminClient();
  } catch (err) {
    console.error('[team/invite] client build error:', err);
    return json(
      { error: 'Server misconfiguration. Contact the administrator.' },
      500
    );
  }

  // ── Step 1: find existing auth user, paginating until found ──
  let userId: string | null = null;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      console.error('[team/invite] listUsers error:', error);
      const msg = (error.message ?? '').toLowerCase();
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('abort')) {
        return json(
          {
            error:
              'Could not reach the authentication service. Check your internet connection and try again.',
          },
          503
        );
      }
      return json(
        { error: `Could not reach authentication service: ${error.message}` },
        503
      );
    }

    const match = data?.users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );
    if (match) {
      userId = match.id;
      break;
    }
    if (!data?.users || data.users.length < 200) break; // last page
  }

  // ── Step 2: if not found, create them ──
  if (!userId) {
    const tempPassword = crypto.randomUUID() + '-' + crypto.randomUUID();
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name },
      });

    if (createErr || !created?.user) {
      console.error('[team/invite] createUser error:');
      console.error('  message:', createErr?.message);
      console.error('  status:', createErr?.status);
      console.error('  code:', createErr?.code);
      console.error('  name:', createErr?.name);

      const msg = (createErr?.message ?? '').toLowerCase();

      // Race condition: created between our list & create
      if (
        msg.includes('already') ||
        msg.includes('exists') ||
        msg.includes('registered')
      ) {
        return json(
          {
            error:
              'This email already has an account. Try again — it should be found automatically on retry.',
          },
          409
        );
      }

      // Network-level failure
      if (
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('abort') ||
        createErr?.status === 0
      ) {
        return json(
          {
            error:
              'Could not reach Supabase. Check your internet connection and try again.',
          },
          503
        );
      }

      // Bad request (domain blocked, invalid email, policy violation, etc.)
      if (createErr?.status === 400) {
        return json(
          {
            error:
              'Supabase rejected this user. It usually means the email already exists, the domain is blocked, or a password policy was violated. Check Supabase → Authentication → Users.',
          },
          400
        );
      }

      return json(
        {
          error: `Could not create the account: ${createErr?.message ?? 'unknown error'}`,
        },
        500
      );
    }

    userId = created.user.id;
  }

  // ── Step 3: is this user already an admin? ──
  const { data: alreadyAdmin } = await admin
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (alreadyAdmin) {
    return json({ error: 'This person is already a team member.' }, 409);
  }

  // ── Step 4: insert admin row ──
  const { error: insertErr } = await admin.from('admins').insert({
    user_id: userId,
    role,
    full_name,
    invited_by: guard.user.id,
  });

  if (insertErr) {
    console.error('[team/invite] insert error:', insertErr);
    return json({ error: insertErr.message }, 500);
  }

  // ── Step 5: generate password-setup link ──
  const site =
    import.meta.env.PUBLIC_SITE_URL ?? 'https://recruitment.spmh.co.ke';

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: normalizedEmail,
    options: { redirectTo: `${site}/admin/accept-invite` },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    console.error('[team/invite] generateLink error:', linkErr);
    return json(
      {
        ok: true,
        warning:
          'Team member added, but the invite link could not be generated. Ask them to use "Forgot password?" on the login page.',
      },
      200
    );
  }

  // ── Step 6: send email ──
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
          'Team member added, but the invite email failed to send. Ask them to use "Forgot password?" on the login page.',
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