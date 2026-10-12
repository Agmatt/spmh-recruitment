import { useEffect, useState } from 'react';

type AppData = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  cover_letter: string | null;
  notes: string | null;
  cv_path: string;
  created_at: string;
  job_postings: { title: string; slug: string } | null;
};

type Event = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_email: string | null;
};

const STATUS_OPTIONS = [
  'pending',
  'reviewing',
  'shortlisted',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const statusPill: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#fef3c7', fg: '#92400e' },
  reviewing: { bg: '#dbeafe', fg: '#1e40af' },
  shortlisted: { bg: '#d1fae5', fg: '#065f46' },
  interview: { bg: '#e0e7ff', fg: '#3730a3' },
  offer: { bg: '#fce7f3', fg: '#9f1239' },
  hired: { bg: '#ede9fe', fg: '#5b21b6' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
  withdrawn: { bg: '#f3f4f6', fg: '#374151' },
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ApplicationDetail({
  initial,
  initialEvents,
}: {
  initial: AppData;
  initialEvents: Event[];
}) {
  const [app, setApp] = useState(initial);
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<number | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [cvError, setCvError] = useState('');
  const [pendingChange, setPendingChange] = useState<string | null>(null);

  // Detect file type from cv_path extension
  const cvExtension = (app.cv_path.split('.').pop() ?? '').toLowerCase();
  const isPdf = cvExtension === 'pdf';

  useEffect(() => {
    let cancelled = false;
    setCvError('');
    fetch(`/api/applications/${app.id}/cv-url`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return body;
      })
      .then((body) => {
        if (!cancelled) {
          if (body.url) setCvUrl(body.url);
          else setCvError('CV link not returned by server.');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[cv-url] failed:', err);
          setCvError(err.message ?? 'Could not load CV.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [app.id]);

  useEffect(() => {
    if (notes === (app.notes ?? '')) return;
    const t = setTimeout(async () => {
      setNotesSaving(true);
      try {
        const res = await fetch(`/api/applications/${app.id}/notes`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ notes: notes || null }),
        });
        if (res.ok) {
          setApp((a) => ({ ...a, notes }));
          setNotesSavedAt(Date.now());
        }
      } finally {
        setNotesSaving(false);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [notes, app.id, app.notes]);

  function requestStatusChange(newStatus: string) {
    const notifyable = ['shortlisted', 'interview', 'offer', 'hired', 'rejected'].includes(
      newStatus
    );
    if (notifyable) {
      setPendingChange(newStatus);
    } else {
      void applyStatus(newStatus, false);
    }
  }

  async function applyStatus(status: string, notify: boolean) {
    setPendingChange(null);
    setStatusBusy(true);
    const prev = app.status;
    setApp((a) => ({ ...a, status }));
    try {
      const res = await fetch(`/api/applications/${app.id}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, notify }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Failed');

      const evRes = await fetch(`/api/applications/${app.id}/events`);
      if (evRes.ok) {
        const { events: fresh } = await evRes.json();
        setEvents(fresh);
      }

      if (body.emailError) {
        alert('Status updated, but the applicant email failed to send.');
      }
    } catch (err) {
      setApp((a) => ({ ...a, status: prev }));
      alert(err instanceof Error ? err.message : 'Could not update status.');
    } finally {
      setStatusBusy(false);
    }
  }

  const pill = statusPill[app.status] ?? statusPill.pending;
  const initials = app.full_name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const appliedDate = new Date(app.created_at).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 lg:gap-8">
      {/* ── LEFT ──────────────────────────────────────── */}
      <div className="space-y-6 min-w-0">
        {/* Header card */}
        <div className="bg-white border border-[var(--color-border-soft)] rounded-2xl p-5 sm:p-8">
          <div className="flex items-start gap-4 sm:gap-5 mb-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[var(--color-brand)] text-white font-bold text-base sm:text-lg flex items-center justify-center shrink-0">
              {initials || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--color-ink)] mb-1 break-words">
                {app.full_name}
              </h2>
              <p className="text-sm text-gray-500">
                {app.job_postings?.title ?? 'Unknown role'}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div className="min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">
                Email
              </dt>
              <dd className="break-all">
                <a
                  href={`mailto:${app.email}`}
                  className="text-[var(--color-brand)] hover:underline"
                >
                  {app.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">
                Phone
              </dt>
              <dd>
                {app.phone ? (
                  <a
                    href={`tel:${app.phone}`}
                    className="text-[var(--color-brand)] hover:underline"
                  >
                    {app.phone}
                  </a>
                ) : (
                  <span className="text-gray-400 italic">Not provided</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">
                Applied
              </dt>
              <dd className="text-[var(--color-ink)]">{appliedDate}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">
                Status
              </dt>
              <dd>
                <span
                  className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                  style={{ background: pill.bg, color: pill.fg }}
                >
                  {STATUS_LABEL[app.status] ?? app.status}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Cover letter */}
        <div className="bg-white border border-[var(--color-border-soft)] rounded-2xl p-5 sm:p-8">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-brand)] mb-5">
            Cover letter
          </h3>
          {app.cover_letter && app.cover_letter.trim() ? (
            <p className="text-[14px] text-gray-700 leading-[1.8] whitespace-pre-wrap">
              {app.cover_letter}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">
              The applicant did not include a cover letter.
            </p>
          )}
        </div>

        {/* CV */}
        <div className="bg-white border border-[var(--color-border-soft)] rounded-2xl overflow-hidden">
          <div className="px-5 sm:px-8 pt-5 sm:pt-8 pb-5 flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-brand)]">
              CV / Résumé
            </h3>
            {cvUrl && (
              <div className="flex gap-3 text-xs">
                <a
                  href={cvUrl}
                  target="_blank"
                  rel="noopener"
                  className="font-semibold text-[var(--color-brand)] hover:underline"
                >
                  Open in new tab
                </a>
                <a
                  href={cvUrl}
                  download={`${app.full_name}-CV.${cvExtension}`}
                  className="font-semibold text-[var(--color-brand)] hover:underline"
                >
                  Download
                </a>
              </div>
            )}
          </div>

          {cvError ? (
            <div className="px-5 sm:px-8 pb-8">
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {cvError}
              </div>
            </div>
          ) : !cvUrl ? (
            <div className="px-5 sm:px-8 pb-8">
              <div className="text-sm text-gray-400 italic">Loading CV…</div>
            </div>
          ) : isPdf ? (
            /* PDF — inline preview */
            <>
              <iframe
                src={cvUrl}
                title="CV preview"
                className="w-full border-0 border-t border-[var(--color-border-soft)]"
                style={{ height: '400px' }}
              />
              <div className="hidden sm:block">
                <iframe
                  src={cvUrl}
                  title="CV preview desktop"
                  className="w-full border-0 border-t border-[var(--color-border-soft)]"
                  style={{ height: '300px', display: 'none' }}
                />
              </div>
            </>
          ) : (
            /* Word / other — download card */
            <div className="px-5 sm:px-8 pb-8">
              <div className="border border-dashed border-[var(--color-border-soft)] rounded-xl p-8 text-center bg-[var(--color-warm)]/40">
                <div className="w-14 h-14 rounded-xl bg-white border border-[var(--color-border-soft)] flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-file-word text-2xl text-[#2b579a]"></i>
                </div>
                <p className="text-sm font-semibold text-[var(--color-ink)] mb-1">
                  Word document
                </p>
                <p className="text-xs text-gray-500 mb-5 max-w-xs mx-auto">
                  {cvExtension.toUpperCase()} files can't be previewed in the
                  browser. Download to view.
                </p>
                <a
                  href={cvUrl}
                  download={`${app.full_name}-CV.${cvExtension}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--color-brand)] text-white text-xs font-bold hover:bg-[var(--color-brand-hover)] transition-colors"
                >
                  <i className="fa-solid fa-download"></i>
                  Download CV
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT (sidebar) ───────────────────────────── */}
      <div className="space-y-6">
        {/* Status card */}
        <div className="bg-white border border-[var(--color-border-soft)] rounded-2xl p-5 sm:p-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-brand)] mb-4">
            Status
          </h3>
          <select
            value={app.status}
            disabled={statusBusy}
            onChange={(e) => requestStatusChange(e.target.value)}
            className="w-full text-sm font-semibold px-3 py-2.5 rounded-xl border-0 outline-none cursor-pointer disabled:opacity-60"
            style={{ background: pill.bg, color: pill.fg }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 leading-relaxed mt-3">
            Shortlisted, Interview, Offer, Hired, and Rejected ask whether to
            email the applicant.
          </p>

          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-brand)] mt-8 mb-4 flex items-center justify-between gap-2">
            <span>Internal notes</span>
            <span className="text-[10px] normal-case tracking-normal font-medium text-gray-400">
              {notesSaving
                ? 'Saving…'
                : notesSavedAt
                  ? 'Saved'
                  : 'Private to HR'}
            </span>
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="Notes only visible to HR…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border-soft)] text-sm text-[var(--color-ink)] bg-white outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10 transition-colors resize-y"
          />
        </div>

        {/* Activity card */}
        <div className="bg-white border border-[var(--color-border-soft)] rounded-2xl p-5 sm:p-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-brand)] mb-5">
            Activity
          </h3>
          {events.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No activity yet.</p>
          ) : (
            <ol className="relative border-l border-[var(--color-border-soft)] ml-2 space-y-5">
              {events.map((e) => (
                <li key={e.id} className="pl-5 relative">
                  <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--color-brand)] ring-4 ring-white"></span>
                  <p className="text-[13px] text-[var(--color-ink)] font-medium leading-snug">
                    {eventLabel(e)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1 break-words">
                    {relativeTime(e.created_at)}
                    {e.actor_email && (
                      <>
                        {' · '}
                        <span className="text-gray-500">{e.actor_email}</span>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {pendingChange && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(15,15,20,0.55)', backdropFilter: 'blur(2px)' }}
          onClick={() => setPendingChange(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl border border-[#ece8e1]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-brand)] mb-2">
              Send notification?
            </p>
            <h3 className="text-lg font-black tracking-tight text-[#1c1c1e] mb-2 break-words">
              Email {app.full_name}
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-6 break-words">
              They'll receive a <strong>{pendingChange}</strong> update at{' '}
              <strong>{app.email}</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setPendingChange(null)}
                className="flex-1 py-3 text-xs font-bold rounded-xl bg-white border border-[#ece8e1] text-[#1c1c1e] hover:border-[#860f0f] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => applyStatus(pendingChange, false)}
                className="flex-1 py-3 text-xs font-bold rounded-xl bg-white border border-[#ece8e1] text-[#1c1c1e] hover:border-[#860f0f] transition-colors"
              >
                Update without email
              </button>
              <button
                onClick={() => applyStatus(pendingChange, true)}
                className="flex-1 py-3 text-xs font-bold rounded-xl bg-[#860f0f] text-white hover:bg-[#a01212] transition-colors"
              >
                Send &amp; update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function eventLabel(e: Event): string {
  if (e.event_type === 'submitted') return 'Application received';
  if (e.event_type === 'status_changed') {
    const from = e.from_status ? STATUS_LABEL[e.from_status] ?? e.from_status : '—';
    const to = e.to_status ? STATUS_LABEL[e.to_status] ?? e.to_status : '—';
    return `Status changed: ${from} → ${to}`;
  }
  if (e.event_type === 'notification_sent') {
    return `Notification sent to applicant`;
  }
  return e.event_type;
}