import type { APIRoute } from 'astro';
import { supabase } from '../lib/supabase'; // adjust to your Supabase client file

export const GET: APIRoute = async () => {
  const site = 'https://recruitment.spmh.co.ke';

  // Public pages that should appear in Google
  const staticPaths = ['/', '/careers']; // adjust to your real public pages

  // Only open job postings. Adjust the table and column names to your schema.
  const { data: jobs } = await supabase
    .from('job_postings')
    .select('slug')
    .eq('status', 'open');

  const paths = [
    ...staticPaths,
    ...(jobs ?? []).map((job) => `/jobs/${job.slug}`), // adjust the job route
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${site}${p}</loc></url>`).join('\n')}
</urlset>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
