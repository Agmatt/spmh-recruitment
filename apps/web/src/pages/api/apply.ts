import type { APIRoute } from 'astro';
import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase-admin';
import { sendApplicantConfirmation } from '../../lib/email';
import {
  normalizeAndValidatePhone,
  normalizeAndValidateEmail,
} from '../../lib/validation';

export const prerender = false;

const MAX_CV_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf']);

const CONSENT_TEXT_VERSION = 'v1-2026-10';

const schema = z.object({
  job_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .max(200)
    .superRefine((val, ctx) => {
      const r = normalizeAndValidateEmail(val);
      if (!r.ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.error });
      }
    })
    .transform((val) => normalizeAndValidateEmail(val).normalized ?? val),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required.')
    .max(30)
    .superRefine((val, ctx) => {
      const r = normalizeAndValidatePhone(val);
      if (!r.ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.error });
      }
    })
    .transform((val) => normalizeAndValidatePhone(val).normalized ?? val),
  cover_letter: z
    .string()
    .trim()
    .min(20, 'Cover letter must be at least 20 characters.')
    .max(5000),
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
      const flat = parsed.error.flatten();
      // Surface the first field error as the top-level message for UX
      const firstFieldError =
        Object.values(flat.fieldErrors).flat().find(Boolean) ??
        'Please check the form and try again.';
      return json({ error: firstFieldError, details: flat }, 400);
    }

    const cv = form.get('cv');
    if (!(cv instanceof File) || cv.size === 0) {
      return json({ error: 'CV file is required.' }, 400);
    }
    if (cv.size > MAX_CV_BYTES) {
      return json({ error: 'CV must be 5 MB or smaller.' }, 400);
    }
    if (!ALLOWED_MIME.has(cv.type)) {
      return json({ error: 'CV must be a PDF file.' }, 400);
    }

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('job_postings')
      .select('id, title, slug, status, closes_at')
      .eq('id', parsed.data.job_id)
      .maybeSingle();

    if (jobErr || !job) return json({ error: 'Job not found.' }, 404);
    if (job.status !== 'published') {
      return json(
        { error: 'This position is no longer accepting applications.' },
        410,
      );
    }
    if (job.closes_at && new Date(job.closes_at) < new Date()) {
      return json({ error: 'This position has closed.' }, 410);
    }

    const ext = 'pdf';
    const cvPath = `${job.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('cvs')
      .upload(cvPath, cv, { contentType: cv.type, upsert: false });

    if (uploadErr) {
      console.error('[apply] CV upload failed:', uploadErr);
      return json({ error: 'Could not upload CV. Please try again.' }, 500);
    }

    const { data: application, error: insertErr } = await supabaseAdmin
      .from('applications')
      .insert({
        job_posting_id: job.id,
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        cover_letter: parsed.data.cover_letter,
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
      await supabaseAdmin.storage.from('cvs').remove([cvPath]);
      return json(
        { error: 'Could not save your application. Please try again.' },
        500,
      );
    }

    await supabaseAdmin.from('application_events').insert({
      application_id: application.id,
      event_type: 'submitted',
      to_status: 'pending',
      metadata: { source: 'web' },
    });

    // Only the applicant receives an instant confirmation.
    // HR reviews applications in the admin dashboard (no email notification).
    await sendApplicantConfirmation({
      to: parsed.data.email,
      applicantName: parsed.data.full_name,
      jobTitle: job.title,
      jobSlug: job.slug,
    }).catch((err) => {
      console.error('[apply] applicant confirmation failed:', err);
    });

    return json({ ok: true, application_id: application.id });
  } catch (err) {
    console.error('[apply] unhandled:', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};
