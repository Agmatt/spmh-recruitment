import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-ssr';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Only touch auth on admin routes
  if (!path.startsWith('/admin')) return next();

  const supabase = createSupabaseServerClient(context);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = path === '/admin/login';

  // Not signed in → force login (except on the login page itself)
  if (!user && !isLoginPage) {
    return context.redirect('/admin/login');
  }

  // Signed in but hitting login → push to dashboard
  if (user && isLoginPage) {
    return context.redirect('/admin');
  }

  // Attach user + supabase to locals for downstream use
  context.locals.user = user ?? null;
  context.locals.supabase = supabase;

  return next();
});