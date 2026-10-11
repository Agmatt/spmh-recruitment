import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-ssr';

// ── CSRF allowlist ──────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://recruitment.spmh.co.ke',
  'https://www.spmh.co.ke',
  'https://spmh.co.ke',
  'http://localhost:4321',
];

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Paths under /admin that are publicly accessible (no session required).
// These pages handle their own auth flow client-side.
const PUBLIC_ADMIN_PATHS = new Set([
  '/admin/login',
  '/admin/accept-invite',
]);

export const onRequest = defineMiddleware(async (context, next) => {
  // ── 1. CSRF protection for state-changing requests ────────
  if (MUTATING_METHODS.has(context.request.method)) {
    const origin = context.request.headers.get('origin');
    const referer = context.request.headers.get('referer');

    let requestOrigin: string | null = origin;
    if (!requestOrigin && referer) {
      try {
        requestOrigin = new URL(referer).origin;
      } catch {
        requestOrigin = null;
      }
    }

    if (requestOrigin && !ALLOWED_ORIGINS.includes(requestOrigin)) {
      console.warn(
        '[csrf] blocked:',
        requestOrigin,
        '->',
        context.url.pathname
      );
      return new Response('Cross-origin request blocked', { status: 403 });
    }
  }

  // ── 2. Admin route protection ─────────────────────────────
  const url = new URL(context.request.url);
  const path = url.pathname;

  if (!path.startsWith('/admin')) {
    return next();
  }

  // Public admin paths bypass the session check entirely.
  // They manage their own auth flow client-side (login form,
  // invite/recovery token consumption, etc.).
  if (PUBLIC_ADMIN_PATHS.has(path)) {
    return next();
  }

  const supabase = createSupabaseServerClient(context);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return context.redirect('/admin/login');
  }

  const { data: adminRow } = await supabase
    .from('admins')
    .select('role, full_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adminRow) {
    await supabase.auth.signOut();
    return context.redirect(
      '/admin/login?error=' +
        encodeURIComponent(
          'Your account is not authorised to access this dashboard.'
        )
    );
  }

  context.locals.admin = {
    role: adminRow.role,
    full_name: adminRow.full_name ?? null,
  };
  context.locals.user = user;
  context.locals.supabase = supabase;

  const response = await next();

  // ── 3. Prevent admin pages being served from browser cache ──
  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, private'
  );
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
});