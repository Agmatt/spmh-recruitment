import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-ssr';

// ── CSRF allowlist ──────────────────────────────────────────
// Only origins on this list may send POST/PUT/PATCH/DELETE.
const ALLOWED_ORIGINS = [
  'https://recruitment.spmh.co.ke',
  'https://www.spmh.co.ke',
  'https://spmh.co.ke',
  'http://localhost:4321',
];

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

  const supabase = createSupabaseServerClient(context);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = path === '/admin/login';

  if (!user && !isLoginPage) {
    return context.redirect('/admin/login');
  }

  if (user && isLoginPage) {
    return context.redirect('/admin');
  }

  if (user && !isLoginPage) {
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
  } else {
    context.locals.admin = null;
  }

  context.locals.user = user ?? null;
  context.locals.supabase = supabase;

  const response = await next();

  // ── 3. Prevent admin pages being served from browser cache ──
  // no-store is the flag that excludes pages from Chrome/Firefox
  // back-forward cache (bfcache). Without it, the back button after
  // sign-out restores a snapshot of the admin page — no server round
  // trip, so middleware never runs.
  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, private'
  );
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
});