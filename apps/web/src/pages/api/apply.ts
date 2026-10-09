import type { APIRoute } from 'astro';
import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase-admin';
import { sendApplicantConfirmation, sendHrNotification } from '../../lib/email';

export const prerender = false;

const MAX_CV_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const CONSENT_TEXT_VERSION = 'v1-2026-10';

const schema = z.object({
  job_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  cover_letter: z.string().trim().max(5000).optional().or(z.literal('')),
  consent: z.literal('true'),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();

    const parsed = schema.safeParse({
      job_id: form.get('job_id'),
      full_name: form.get('full_name'),
      email: form.get('email'),
      phone: form.get('phone') ?? '',
      cover_letter: form.get('cover_letter') ?? '',
      consent: form.get('consent'),
    });

    if (!parsed.success) {
      return json(
        { error: 'Invalid form data', details: parsed.error.flatten() },
        400
      );
    }

    const cv = form.get('cv');
    if (!(cv instanceof File) || cv.size === 0) {
      return json({ error: 'CV file is required.' }, 400);
    }
    if (cv.size > MAX_CV_BYTES) {
      return json({ error: 'CV must be 5 MB or smaller.' }, 400);
    }
    if (!ALLOWED_MIME.has(cv.type)) {
      return json({ error: 'CV must be PDF, DOC, or DOCX.' }, 400);
    }

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('job_postings')
      .select('id, title, slug, status, closes_at')
      .eq('id', parsed.data.job_id)
      .maybeSingle();

    if (jobErr || !job) return json({ error: 'Job not found.' }, 404);
    if (job.status !== 'published') {
      return json({ error: 'This position is no longer accepting applications.' }, 410);
    }
    if (job.closes_at && new Date(job.closes_at) < new Date()) {
      return json({ error: 'This position has closed.' }, 410);
    }

    // Upload CV to private bucket
    const ext =
      cv.type === 'application/pdf'
        ? 'pdf'
        : cv.type === 'application/msword'
          ? 'doc'
          : 'docx';
    const cvPath = `${job.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('cvs')
      .upload(cvPath, cv, { contentType: cv.type, upsert: false });

    if (uploadErr) {
      console.error('[apply] CV upload failed:', uploadErr);
      return json({ error: 'Could not upload CV. Please try again.' }, 500);
    }

    // Insert application (service role — RLS already validated nothing here,
    // we've validated consent + published status above)
    const { data: application, error: insertErr } = await supabaseAdmin
      .from('applications')
      .insert({
        job_posting_id: job.id,
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        cover_letter: parsed.data.cover_letter || null,
        cv_path: cvPath,
        consent_given: true,
        consent_text_version: CONSENT_TEXT_VERSION,
        consent_given_at: new Date().toISOString(),
        source: 'web',
      })
      .select('id')
      .single();

    if (insertErr || !application) {
      console.error('[apply] DB insert failed:', insertErr);
      // Roll back the orphan CV
      await supabaseAdmin.storage.from('cvs').remove([cvPath]);
      return json({ error: 'Could not save your application. Please try again.' }, 500);
    }

    // Log the event
    await supabaseAdmin.from('application_events').insert({
      application_id: application.id,
      event_type: 'submitted',
      to_status: 'pending',
      metadata: { source: 'web' },
    });

    // Fire emails (non-blocking failures — don't fail the request if email bounces)
    const hrEmail = import.meta.env.EMAIL_HR_NOTIFY ?? 'recruitment@spmh.co.ke';

    await Promise.allSettled([
      sendApplicantConfirmation({
        to: parsed.data.email,
        applicantName: parsed.data.full_name,
        jobTitle: job.title,
        jobSlug: job.slug,
      }),
      sendHrNotification({
        to: hrEmail,
        applicantName: parsed.data.full_name,
        applicantEmail: parsed.data.email,
        applicantPhone: parsed.data.phone || null,
        jobTitle: job.title,
        applicationId: application.id,
      }),
    ]).then((results) => {
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[apply] email ${i === 0 ? 'applicant' : 'hr'} failed:`, r.reason);
        }
      });
    });

    return json({ ok: true, application_id: application.id });
  } catch (err) {
    console.error('[apply] unhandled:', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};