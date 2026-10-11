import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { sendPasswordReset } from '../../../lib/email';

export const prerender = false;

const Schema = z.object({
  email: z.string().trim().email().max(200),
});

// Service-role client with an explicit fetch timeout so DNS/network
// failures fail fast.
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
  const body = await context.request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const site =
    import.meta.env.PUBLIC_SITE_URL ?? 'https://recruitment.spmh.co.ke';

  // ⚠️ Always respond with the same success message, regardless of whether
  // the email exists. Prevents attackers from enumerating registered users.
  const genericSuccess = {
    ok: true,
    message:
      'If that email is registered, we have sent a password reset link. Check your inbox and spam folder.',
  };

  let admin;
  try {
    admin = buildAdminClient();
  } catch (err) {
    console.error('[forgot-password] client build error:', err);
    return json(genericSuccess, 200);
  }

  // Look up the user (paginated, though we expect small numbers)
  let userId: string | null = null;
  let userEmail: string | null = null;
  let userName = '';

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      console.error('[forgot-password] listUsers error:', error);
      return json(genericSuccess, 200);
    }
    const match = data?.users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );
    if (match) {
      userId = match.id;
      userEmail = match.email ?? normalizedEmail;
      const meta = match.user_metadata as { full_name?: string } | undefined;
      userName = meta?.full_name?.trim() || userEmail.split('@')[0];
      break;
    }
    if (!data?.users || data.users.length < 200) break;
  }

  // If no user found, still return success (anti-enumeration).
  // Do nothing else — no email sent.
  if (!userId || !userEmail) {
    return json(genericSuccess, 200);
  }

  // Generate a recovery link
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: userEmail,
    options: { redirectTo: `${site}/admin/reset-password` },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    console.error('[forgot-password] generateLink error:', linkErr);
    return json(genericSuccess, 200);
  }

  // Send our branded email
  const result = await sendPasswordReset({
    to: userEmail,
    recipientName: userName,
    resetLink: linkData.properties.action_link,
    requestedAt: new Date().toISOString(),
  });

  if (!result.success) {
    console.error('[forgot-password] email send failed:', result.error);
    // Still return success to the user — we don't want to leak whether the
    // send failed, and the user can retry.
  }

  return json(genericSuccess, 200);
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}