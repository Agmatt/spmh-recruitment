import { Resend } from 'resend';

const key = import.meta.env.RESEND_API_KEY;
const from = import.meta.env.EMAIL_FROM;

if (!key || !from) {
  throw new Error('Missing RESEND_API_KEY or EMAIL_FROM in apps/web/.env');
}

const resend = new Resend(key);

const wrap = (body: string) => `
<!doctype html><html><body style="margin:0;padding:0;background:#f9f6f2;font-family:system-ui,-apple-system,sans-serif;color:#1c1c1e;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:12px;font-weight:800;letter-spacing:0.2em;color:#860f0f;text-transform:uppercase;margin-bottom:24px;">
      St. Paul's Mission Hospital
    </div>
    <div style="background:#ffffff;border:1px solid #ece8e1;border-radius:16px;padding:32px;">
      ${body}
    </div>
    <p style="font-size:11px;color:#9ca3af;margin-top:24px;text-align:center;">
      This message was sent from recruitment@spmh.co.ke. Do not reply to this address for confidential matters.
    </p>
  </div>
</body></html>`;

export async function sendApplicantConfirmation(params: {
  to: string;
  applicantName: string;
  jobTitle: string;
  jobSlug: string;
}) {
  const site = import.meta.env.PUBLIC_SITE_URL ?? 'https://recruitment.spmh.co.ke';
  return resend.emails.send({
    from,
    to: params.to,
    subject: `We received your application — ${params.jobTitle}`,
    html: wrap(`
      <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;color:#1c1c1e;">
        Hi ${escapeHtml(params.applicantName.split(' ')[0] || 'there')},
      </h1>
      <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
        Thank you for applying for the <strong>${escapeHtml(params.jobTitle)}</strong> position
        at St. Paul's Mission Hospital.
      </p>
      <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 24px;">
        Our HR team will review your application and reach out if you are
        shortlisted. You can find the original posting at any time using the
        link below.
      </p>
      <a href="${site}/jobs/${params.jobSlug}"
         style="display:inline-block;background:#860f0f;color:#ffffff;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;text-decoration:none;">
        View posting
      </a>
    `),
  });
}

export async function sendHrNotification(params: {
  to: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  jobTitle: string;
  applicationId: string;
}) {
  const site = import.meta.env.PUBLIC_SITE_URL ?? 'https://recruitment.spmh.co.ke';
  return resend.emails.send({
    from,
    to: params.to,
    subject: `New application: ${params.applicantName} — ${params.jobTitle}`,
    html: wrap(`
      <h1 style="font-size:20px;font-weight:800;margin:0 0 20px;color:#1c1c1e;">
        New application received
      </h1>
      <table style="font-size:14px;line-height:1.7;color:#4b5563;width:100%;">
        <tr><td style="padding:4px 0;width:120px;color:#9ca3af;">Name</td><td><strong>${escapeHtml(params.applicantName)}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#9ca3af;">Email</td><td>${escapeHtml(params.applicantEmail)}</td></tr>
        <tr><td style="padding:4px 0;color:#9ca3af;">Phone</td><td>${escapeHtml(params.applicantPhone ?? '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#9ca3af;">Role</td><td>${escapeHtml(params.jobTitle)}</td></tr>
      </table>
      <a href="${site}/admin/applications/${params.applicationId}"
         style="display:inline-block;background:#860f0f;color:#ffffff;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;text-decoration:none;margin-top:24px;">
        Open in dashboard
      </a>
    `),
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

export async function sendAdminInvite(params: {
  to: string;
  inviteeName: string;
  inviterName: string;
  setupLink: string;
}): Promise<{ success: true } | { success: false; error: unknown }> {
  try {
    const result = await resend.emails.send({
      from,
      to: params.to,
      subject: "You've been invited to the SPMH Recruitment dashboard",
      html: wrap(`
        <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;color:#1c1c1e;">
          Welcome, ${escapeHtml(params.inviteeName.split(' ')[0] || 'there')}.
        </h1>
        <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
          ${escapeHtml(params.inviterName)} has invited you to join the
          recruitment team at St. Paul's Mission Hospital.
        </p>
        <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 24px;">
          Click the button below to set your password. The link expires in
          one hour. If you weren't expecting this email, you can safely ignore
          it.
        </p>
        <a href="${params.setupLink}"
           style="display:inline-block;background:#860f0f;color:#ffffff;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px;text-decoration:none;">
          Set your password
        </a>
                <p style="font-size:12px;line-height:1.6;color:#9ca3af;margin:24px 0 0;">
          Or copy this link into your browser:<br />
          <span style="word-break:break-all;color:#6b7280;">${params.setupLink}</span>
        </p>
        <p style="font-size:12px;line-height:1.6;color:#9ca3af;margin:20px 0 0;padding-top:20px;border-top:1px solid #ece8e1;">
          <strong style="color:#6b7280;">Link expired?</strong> Open
          <a href="https://recruitment.spmh.co.ke/admin/login" style="color:#860f0f;text-decoration:underline;">the login page</a>,
          click <em>Forgot password?</em>, and enter this email address to
          receive a fresh link.
        </p>
      `),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}
export async function sendPasswordReset(params: {
  to: string;
  recipientName: string;
  resetLink: string;
  requestedAt: string;
}): Promise<{ success: true } | { success: false; error: unknown }> {
  try {
    const result = await resend.emails.send({
      from,
      to: params.to,
      subject: 'Reset your SPMH Recruitment password',
      html: wrap(`
        <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;color:#1c1c1e;">
          Reset your password
        </h1>
        <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
          Hi ${escapeHtml(params.recipientName.split(' ')[0] || 'there')},
        </p>
        <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 24px;">
          Someone requested a password reset for your SPMH Recruitment
          account. If that was you, click the button below to choose a new
          password. The link expires in one hour.
        </p>
        <a href="${params.resetLink}"
           style="display:inline-block;background:#860f0f;color:#ffffff;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px;text-decoration:none;">
          Set a new password
        </a>
        <p style="font-size:12px;line-height:1.6;color:#9ca3af;margin:24px 0 0;">
          Or copy this link into your browser:<br />
          <span style="word-break:break-all;color:#6b7280;">${params.resetLink}</span>
        </p>
        <p style="font-size:12px;line-height:1.6;color:#9ca3af;margin:20px 0 0;padding-top:20px;border-top:1px solid #ece8e1;">
          <strong style="color:#6b7280;">Didn't request this?</strong> You can
          safely ignore this email. Your password will remain unchanged. If
          you're concerned, contact the Human Resources Department at
          <a href="mailto:info@spmh.co.ke" style="color:#860f0f;">info@spmh.co.ke</a>.
        </p>
      `),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}
// ── Status update emails ─────────────────────────────────
// Sent to applicants when their status changes. Only statuses that
// mean something to the applicant trigger an email.

type StatusEmailContext = {
  to: string;
  applicantName: string;
  jobTitle: string;
  jobSlug: string;
};

type StatusContent = {
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  showClosing?: boolean;
};

function statusContentFor(
  status: string,
  ctx: StatusEmailContext
): StatusContent | null {
  const first = ctx.applicantName.split(' ')[0] || 'there';

  switch (status) {
    case 'shortlisted':
      return {
        subject: `You've been shortlisted — ${ctx.jobTitle}`,
        heading: 'You have been shortlisted',
        body: `
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
            Dear ${escapeHtml(first)},
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
            Thank you for your application for the position of
            <strong>${escapeHtml(ctx.jobTitle)}</strong> at St. Paul's Mission
            Hospital.
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
            We are pleased to inform you that your application has been
            <strong>shortlisted</strong>. Our Human Resources Department will
            be in touch shortly with details about the next stage of the
            recruitment process.
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 24px;">
            Please keep your contact details available. If your circumstances
            change, kindly notify us as soon as possible.
          </p>
        `,
        showClosing: true,
      };

    case 'interview':
      return {
        subject: `Interview invitation — ${ctx.jobTitle}`,
        heading: 'Interview invitation',
        body: `
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
            Dear ${escapeHtml(first)},
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
            Following your application for
            <strong>${escapeHtml(ctx.jobTitle)}</strong>, we would like to
            invite you to an interview.
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 24px;">
            Our Human Resources Department will contact you separately with
            the date, time, and venue. If you have any questions in the
            meantime, please reply to this email.
          </p>
        `,
        showClosing: true,
      };

    case 'offer':
      return {
        subject: `Offer of employment — ${ctx.jobTitle}`,
        heading: 'Offer of employment',
        body: `
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
            Dear ${escapeHtml(first)},
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
            Following your application and interview for the position of
            <strong>${escapeHtml(ctx.jobTitle)}</strong>, we are pleased to
            extend an offer of employment to you.
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 24px;">
            Our Human Resources Department will contact you with the formal
            offer letter and next steps.
          </p>
        `,
        showClosing: true,
      };

    case 'hired':
      return {
        subject: `Welcome to St. Paul's Mission Hospital — ${ctx.jobTitle}`,
        heading: "Welcome to the team",
        body: `
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
            Dear ${escapeHtml(first)},
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
            On behalf of the entire team at St. Paul's Mission Hospital, welcome.
            We are delighted that you will be joining us as our new
            <strong>${escapeHtml(ctx.jobTitle)}</strong>.
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 24px;">
            Our Human Resources Department will be in touch with your
            onboarding schedule and any documents we need from you.
          </p>
        `,
        showClosing: true,
      };

    case 'rejected':
      return {
        subject: `Update on your application — ${ctx.jobTitle}`,
        heading: 'Thank you for your application',
        body: `
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
            Dear ${escapeHtml(first)},
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
            Thank you for your interest in the position of
            <strong>${escapeHtml(ctx.jobTitle)}</strong> at St. Paul's Mission
            Hospital, and for the time you invested in your application.
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 16px;">
            After careful review, we have decided not to progress your
            application further on this occasion. This decision does not
            reflect on your qualifications — we simply received a strong field
            of candidates for this role.
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 24px;">
            We encourage you to apply for future positions that match your
            experience. We wish you every success in your career.
          </p>
        `,
        showClosing: true,
      };

    case 'withdrawn':
      // No email for withdrawn — the applicant chose to withdraw.
      return null;

    // pending, reviewing → no applicant-facing email
    default:
      return null;
  }
}

export async function sendStatusUpdate(
  status: string,
  ctx: StatusEmailContext
): Promise<{ success: true } | { success: false; error: unknown } | { skipped: true }> {
  const content = statusContentFor(status, ctx);
  if (!content) return { skipped: true };

  const site = import.meta.env.PUBLIC_SITE_URL ?? 'https://recruitment.spmh.co.ke';

  try {
    const result = await resend.emails.send({
      from,
      to: ctx.to,
      subject: content.subject,
      html: wrap(`
        <h1 style="font-size:22px;font-weight:800;margin:0 0 20px;color:#1c1c1e;">
          ${content.heading}
        </h1>
        ${content.body}
        ${
          content.showClosing
            ? `
          <p style="font-size:14px;line-height:1.7;color:#6b7280;margin:24px 0 0;padding-top:20px;border-top:1px solid #ece8e1;">
            Kind regards,<br />
            <strong style="color:#1c1c1e;">Human Resources Department</strong><br />
            St. Paul's Mission Hospital
          </p>
        `
            : ''
        }
        <p style="font-size:11px;color:#9ca3af;margin:24px 0 0;">
          You are receiving this email because you applied for a position
          through the St. Paul's Mission Hospital recruitment portal. For
          questions, contact
          <a href="mailto:${from.match(/<(.+)>/)?.[1] ?? 'recruitment@spmh.co.ke'}" style="color:#860f0f;">recruitment@spmh.co.ke</a>.
        </p>
      `),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}