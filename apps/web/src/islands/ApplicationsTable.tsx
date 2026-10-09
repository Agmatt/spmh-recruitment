import { useMemo, useState } from 'react';

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
    const [apps, setApps] = useState(initialApplications);
    const [jobFilter, setJobFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

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

    async function updateStatus(id: string, status: string) {
        setBusyId(id);
        const prev = apps.find((a) => a.id === id)?.status;
        // optimistic
        setApps((curr) => curr.map((a) => (a.id === id ? { ...a, status } : a)));
        try {
            const res = await fetch(`/api/applications/${id}/status`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error('Failed');
        } catch {
            // rollback
            if (prev) {
                setApps((curr) => curr.map((a) => (a.id === id ? { ...a, status: prev } : a)));
            }
            alert('Could not update status. Please try again.');
        } finally {
            setBusyId(null);
        }
    }

    async function deleteApp(id: string, name: string) {
        if (!confirm(`Delete application from ${name}? This cannot be undone.`)) return;
        setBusyId(id);
        try {
            const res = await fetch(`/api/applications/${id}/delete`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed');
            setApps((curr) => curr.filter((a) => a.id !== id));
        } catch {
            alert('Could not delete. Please try again.');
        } finally {
            setBusyId(null);
        }
    }

    function openCv(id: string) {
        window.open(`/api/cv/${id}`, '_blank', 'noopener');
    }

    return (
        <div className="space-y-5">
            {/* Filters */}
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

            {/* Table */}
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
                                    <td colSpan={7} className="px-6 py-16 text-center text-sm text-gray-400">
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
                                            className={`border-b border-[var(--color-border-soft)] last:border-b-0 ${busy ? 'opacity-60' : ''}`}
                                        >
                                            <td className="px-5 py-3.5">
                                                <p className="text-sm font-semibold text-[var(--color-ink)]">
                                                    {a.full_name}
                                                </p>
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
                                                    onChange={(e) => updateStatus(a.id, e.target.value)}
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
        </div>
    );
}

const selectCls =
    'w-full px-3 py-2 rounded-xl border border-[var(--color-border-soft)] text-sm bg-white outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10';