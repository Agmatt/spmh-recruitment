import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createSupabaseServerClient } from '../../../../lib/supabase-ssr';
import { sendStatusUpdate } from '../../../../lib/email';

export const prerender = false;

const StatusSchema = z.object({
  status: z.enum([
    'pending',
    'reviewing',
    'shortlisted',
    'interview',
    'offer',
    'hired',
    'rejected',
    'withdrawn',
  ]),
  notify: z.boolean().optional().default(false),
});

// Statuses that trigger an applicant-facing email
const NOTIFIABLE = new Set([
  'shortlisted',
  'interview',
  'offer',
  'hired',
  'rejected',
]);

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id) return json({ error: 'Missing id' }, 400);

  const supabase = createSupabaseServerClient(context);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const body = await context.request.json().catch(() => null);
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid status' }, 400);

  const { status, notify } = parsed.data;

  // Fetch current status + applicant info for audit + email
  const { data: before, error: fetchErr } = await supabase
    .from('applications')
    .select(`
      status, full_name, email,
      job_postings ( title, slug )
    `)
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !before) {
    return json({ error: 'Application not found' }, 404);
  }

  const previousStatus = before.status;
  const applicant = {
    full_name: before.full_name,
    email: before.email,
    jobTitle:
      (before.job_postings as unknown as { title: string; slug: string } | null)
        ?.title ?? 'the position',
    jobSlug:
      (before.job_postings as unknown as { title: string; slug: string } | null)
        ?.slug ?? '',
  };

  // ── Update status ────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', id);

  if (updateErr) {
    console.error('[status] update error:', updateErr);
    return json({ error: 'Update failed' }, 500);
  }

  // ── Audit: status_changed ────────────────────────────
  await supabase.from('application_events').insert({
    application_id: id,
    actor_id: user.id,
    event_type: 'status_changed',
    from_status: previousStatus,
    to_status: status,
  });

  // ── Optional: send applicant email ───────────────────
  let emailed = false;
  let emailError: string | null = null;

  if (notify && NOTIFIABLE.has(status)) {
    const result = await sendStatusUpdate(status, {
      to: applicant.email,
      applicantName: applicant.full_name,
      jobTitle: applicant.jobTitle,
      jobSlug: applicant.jobSlug,
    });

    if ('success' in result && result.success) {
      emailed = true;
      await supabase.from('application_events').insert({
        application_id: id,
        actor_id: user.id,
        event_type: 'notification_sent',
        to_status: status,
        metadata: { channel: 'email', template: status },
      });
    } else if ('error' in result) {
      console.error('[status] email send failed:', result.error);
      emailError = 'Email failed to send.';
    }
    // 'skipped' → not applicable, ignore
  }

  return json({ ok: true, status, emailed, emailError }, 200);
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}