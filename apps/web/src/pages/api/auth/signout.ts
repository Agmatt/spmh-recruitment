import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase-ssr';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createSupabaseServerClient(context);
  await supabase.auth.signOut();

  // 303 See Other + Clear-Site-Data:
  // - 303 forces the browser to GET /admin/login instead of re-POSTing.
  // - Clear-Site-Data tells the browser to wipe cached responses,
  //   cookies, and local/session storage for this origin. Combined with
  //   the no-store headers set in middleware.ts, this ensures the admin
  //   pages cannot be restored via the back or forward button.
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin/login?reason=signed-out',
      'Clear-Site-Data': '"cache", "cookies", "storage"',
    },
  });
};