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