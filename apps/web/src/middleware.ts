import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-ssr';

// ── CSRF allowlist ──────────────────────────────────────────
// Only origins on this list may send POST/PUT/PATCH/DELETE.
// Add any new domain here when you add another frontend.
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

    // Prefer Origin header; fall back to Referer for older browsers.
    let requestOrigin: string | null = origin;
    if (!requestOrigin && referer) {
      try {
        requestOrigin = new URL(referer).origin;
      } catch {
        requestOrigin = null;
      }
    }

    // If neither header is present, allow it (server-to-server calls
    // from Vercel cron, webhooks, curl, etc. have no Origin).
    // If a browser sent one and it's not on the list, block.
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

  // Non-admin routes pass straight through
  if (!path.startsWith('/admin')) {
    return next();
  }

  // Build the Supabase client bound to this request's cookies
  const supabase = createSupabaseServerClient(context);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = path === '/admin/login';

  // Not signed in → redirect to login (except on login itself)
  if (!user && !isLoginPage) {
    return context.redirect('/admin/login');
  }

  // Signed in but hitting login → push to dashboard
  if (user && isLoginPage) {
    return context.redirect('/admin');
  }

  // Attach user + client to locals for downstream pages
  context.locals.user = user ?? null;
  context.locals.supabase = supabase;

  return next();
});