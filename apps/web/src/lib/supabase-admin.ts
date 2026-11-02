import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    'Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/web/.env'
  );
}
// if (import.meta.env.DEV) {
//   const payload = serviceKey.startsWith('eyJ')
//     ? JSON.parse(
//         atob(serviceKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
//       ).role
//     : serviceKey.slice(0, 10) + '…';
//   console.log('[supabase-admin] host:', new URL(url).host, 'key:', payload);
// }

// ⚠️ Server-only. Bypasses RLS. Never import from a .astro page
// that runs in the browser or from a client island.
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});