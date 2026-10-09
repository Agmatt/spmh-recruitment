import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase-ssr';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');

  if (!email || !password) {
    return context.redirect(
      '/admin/login?error=' + encodeURIComponent('Email and password are required.')
    );
  }

  const supabase = createSupabaseServerClient(context);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('[signin] error:', error.message);
    return context.redirect(
      '/admin/login?error=' + encodeURIComponent('Invalid email or password.')
    );
  }

  // Explicitly return a 303 redirect. Astro flushes cookies set on
  // context.cookies into the response headers automatically.
  return new Response(null, {
    status: 303,
    headers: { Location: '/admin' },
  });
};