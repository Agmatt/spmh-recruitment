import { Fragment, useMemo, useState } from 'react';

type App = {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    status: string;
    cover_letter: string | null;
    cv_path: string;
    created_at: string;
    job_posting_id: string;
    job_postings: { title: string; slug: string } | null;
};

type JobOption = { id: string; title: string; slug: string };

const STATUSES = [
    'pending',
    'reviewing',
    'shortlisted',
    'interview',
    'offer',
    'hired',
    'rejected',
    'withdrawn',
] as const;

const NOTIFIABLE_STATUSES = new Set([
    'shortlisted',
    'interview',
    'offer',
    'hired',
    'rejected',
]);

const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
    reviewing: { bg: '#dbeafe', color: '#1e40af', label: 'Reviewing' },
    shortlisted: { bg: '#d1fae5', color: '#065f46', label: 'Shortlisted' },
    interview: { bg: '#e0e7ff', color: '#3730a3', label: 'Interview' },
    offer: { bg: '#fce7f3', color: '#9f1239', label: 'Offer' },
    hired: { bg: '#ede9fe', color: '#5b21b6', label: 'Hired' },
    rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
    withdrawn: { bg: '#f3f4f6', color: '#374151', label: 'Withdrawn' },
};

export default function ApplicationsTable({
    initialApplications,
    jobs,
}: {
    initialApplications: App[];
    jobs: JobOption[];
}) {
    const [apps, setApps] = useState<App[]>(initialApplications);
    const [jobFilter, setJobFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

    const [pendingChange, setPendingChange] = useState<{
        id: string;
        status: string;
        applicantName: string;
        applicantEmail: string;
    } | null>(null);

    const filtered = useMemo(() => {
        return apps.filter((a) => {
            if (jobFilter !== 'all' && a.job_posting_id !== jobFilter) return false;
            if (statusFilter !== 'all' && a.status !== statusFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                return (
                    a.full_name.toLowerCase().includes(q) ||
                    a.email.toLowerCase().includes(q) ||
                    (a.phone ?? '').toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [apps, jobFilter, statusFilter, search]);

    // ── Status change flow ─────────────────────────────────
    function requestStatusChange(
        id: string,
        newStatus: string,
        applicantName: string,
        applicantEmail: string
    ) {
        if (NOTIFIABLE_STATUSES.has(newStatus)) {
            setPendingChange({ id, status: newStatus, applicantName, applicantEmail });
        } else {
            void applyStatus(id, newStatus, false);
        }
    }

    async function applyStatus(id: string, status: string, notify: boolean) {
        setBusyId(id);
        setPendingChange(null);

        const prev = apps.find((a) => a.id === id)?.status;
        setApps((curr) => curr.map((a) => (a.id === id ? { ...a, status } : a)));

        try {
            const res = await fetch(`/api/applications/${id}/status`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ status, notify }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error ?? 'Failed');

            if (notify && body.emailError) {
                alert(
                    'Status updated, but the applicant notification email failed to send. Check the email address, or contact support.'
                );
            }
        } catch (err) {
            if (prev) {
                setApps((curr) =>
                    curr.map((a) => (a.id === id ? { ...a, status: prev } : a))
                );
            }
            alert(err instanceof Error ? err.message : 'Could not update status.');
        } finally {
            setBusyId(null);
        }
    }

    // ── Delete ────────────────────────────────────────────
    async function deleteApp(id: string, name: string) {
        if (!confirm(`Delete application from ${name}? This cannot be undone.`)) return;
        setBusyId(id);
        try {
            const res = await fetch(`/api/applications/${id}/delete`, { method: 'POST' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                throw new Error(body.error ?? `HTTP ${res.status}`);
            }
            setApps((curr) => curr.filter((a) => a.id !== id));
        } catch (err) {
            alert(
                `Could not delete: ${err instanceof Error ? err.message : 'Unknown error'}`
            );
        } finally {
            setBusyId(null);
        }
    }

    function openCv(id: string) {
        window.open(`/api/cv/${id}`, '_blank', 'noopener');
    }

    return (
        <div className="space-y-5">
            {/* ── Filters ──────────────────────────────────── */}
            <div className="bg-white border border-[var(--color-border-soft)] rounded-2xl p-4 sm:p-5">
                <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs font-semibold mb-1.5">Role</label>
                        <select
                            value={jobFilter}
                            onChange={(e) => setJobFilter(e.target.value)}
                            className={selectCls}
                        >
                            <option value="all">All roles</option>
                            {jobs.map((j) => (
                                <option key={j.id} value={j.id}>
                                    {j.title}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1.5">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className={selectCls}
                        >
                            <option value="all">All statuses</option>
                            {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {statusStyle[s].label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1.5">Search</label>
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Name, email, phone…"
                            className={selectCls}
                        />
                    </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-border-soft)]">
                    <p className="text-xs text-gray-500">
                        Showing <strong>{filtered.length}</strong> of {apps.length} applications
                    </p>
                </div>
            </div>

            {/* ── Table ─────────────────────────────────────── */}
            <div className="bg-white border border-[var(--color-border-soft)] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead className="bg-[var(--color-warm)] border-b border-[var(--color-border-soft)]">
                            <tr>
                                {['Applicant', 'Contact', 'Role', 'Status', 'Applied', 'CV', ''].map((h) => (
                                    <th
                                        key={h}
                                        className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-brand)]"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-6 py-16 text-center text-sm text-gray-400"
                                    >
                                        No applications match your filters.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((a) => {
                                    const style = statusStyle[a.status] ?? statusStyle.pending;
                                    const busy = busyId === a.id;
                                    return (
                                        <tr
                                            key={a.id}
                                            className={`border-b border-[var(--color-border-soft)] last:border-b-0 ${busy ? 'opacity-60' : ''
                                                }`}
                                        >
                                            <td className="px-5 py-3.5">
                                                <a
                                                    href={`/admin/applications/${a.id}`}
                                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-brand)] underline decoration-1 underline-offset-4 decoration-[var(--color-brand)]/40 hover:decoration-[var(--color-brand)] hover:decoration-2 transition-all"
                                                    title="Open application"
                                                >
                                                    {a.full_name}
                                                    <svg
                                                        className="w-3 h-3 opacity-60"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth={2.5}
                                                        aria-hidden="true"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M9 5l7 7-7 7"
                                                        />
                                                    </svg>
                                                </a>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <a
                                                    href={`mailto:${a.email}`}
                                                    className="text-xs text-[var(--color-brand)] hover:underline block"
                                                >
                                                    {a.email}
                                                </a>
                                                {a.phone && (
                                                    <p className="text-xs text-gray-400 mt-0.5">{a.phone}</p>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <p className="text-xs text-gray-600">
                                                    {a.job_postings?.title ?? '—'}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <select
                                                    value={a.status}
                                                    disabled={busy}
                                                    onChange={(e) =>
                                                        requestStatusChange(
                                                            a.id,
                                                            e.target.value,
                                                            a.full_name,
                                                            a.email
                                                        )
                                                    }
                                                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border-0 cursor-pointer outline-none"
                                                    style={{ background: style.bg, color: style.color }}
                                                >
                                                    {STATUSES.map((s) => (
                                                        <option key={s} value={s}>
                                                            {statusStyle[s].label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <p className="text-xs text-gray-500">
                                                    {new Date(a.created_at).toLocaleDateString('en-KE', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                    })}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <button
                                                    onClick={() => openCv(a.id)}
                                                    className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
                                                >
                                                    View CV →
                                                </button>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <button
                                                    onClick={() => deleteApp(a.id, a.full_name)}
                                                    disabled={busy}
                                                    className="text-xs text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                                    title="Delete application"
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Status change confirmation modal ───────────── */}
            {pendingChange && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center px-4"
                    style={{
                        background: 'rgba(15,15,20,0.55)',
                        backdropFilter: 'blur(2px)',
                    }}
                    onClick={() => setPendingChange(null)}
                >
                    <div
                        className="bg-white rounded-2xl w-full max-w-md p-7 shadow-2xl border border-[#ece8e1]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-4 mb-5">
                            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0 text-[#860f0f]">
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                    />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#860f0f] mb-1.5">
                                    Send notification?
                                </p>
                                <h3 className="text-lg font-black tracking-tight text-[#1c1c1e] mb-1 truncate">
                                    Email {pendingChange.applicantName}
                                </h3>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    They'll receive a{' '}
                                    <strong className="capitalize">{pendingChange.status}</strong>{' '}
                                    update at{' '}
                                    <strong className="break-all">
                                        {pendingChange.applicantEmail}
                                    </strong>
                                    .
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setPendingChange(null)}
                                className="flex-1 py-3 text-xs font-bold rounded-xl bg-white border border-[#ece8e1] text-[#1c1c1e] hover:border-[#860f0f] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() =>
                                    applyStatus(pendingChange.id, pendingChange.status, false)
                                }
                                className="flex-1 py-3 text-xs font-bold rounded-xl bg-white border border-[#ece8e1] text-[#1c1c1e] hover:border-[#860f0f] transition-colors"
                            >
                                Update without email
                            </button>
                            <button
                                onClick={() =>
                                    applyStatus(pendingChange.id, pendingChange.status, true)
                                }
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

const selectCls =
    'w-full px-3 py-2 rounded-xl border border-[var(--color-border-soft)] text-sm bg-white outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10';