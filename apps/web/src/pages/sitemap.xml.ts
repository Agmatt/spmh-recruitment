import type { APIRoute } from 'astro';
import { supabase } from '../lib/supabase';

const SITE = 'https://recruitment.spmh.co.ke';

const staticPaths = [
  '/',
  '/who-we-are',
  '/code-of-conduct',
  '/privacy',
  '/terms',
];

export const GET: APIRoute = async () => {
  const nowIso = new Date().toISOString();

  // Only jobs that are published AND not past their closing date
  const { data: jobs, error } = await supabase
    .from('job_postings')
    .select('slug, published_at, created_at')
    .eq('status', 'published')
    .or(`closes_at.is.null,closes_at.gte.${nowIso}`);

  if (error) {
    return new Response('Sitemap temporarily unavailable', { status: 500 });
  }

  const staticUrls = staticPaths.map(
    (p) => `  <url><loc>${SITE}${p}</loc></url>`,
  );

  const jobUrls = (jobs ?? []).map((job) => {
    const lastmod = (job.published_at ?? job.created_at ?? '').slice(0, 10);
    return `  <url>
    <loc>${SITE}/jobs/${encodeURIComponent(job.slug)}</loc>${
      lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''
    }
  </url>`;
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...jobUrls].join('\n')}
</urlset>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
