import { useMemo, useState } from 'react';

type Job = {
    id: string;
    slug: string;
    title: string;
    status: 'draft' | 'published' | 'archived' | 'closed';
    employment_type: string;
    location: string;
    created_at: string;
    published_at: string | null;
    departments: { label: string } | null;
    _count?: { applications: number };
};

const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: '#f3f4f6', color: '#374151', label: 'Draft' },
    published: { bg: '#d1fae5', color: '#065f46', label: 'Published' },
    archived: { bg: '#fef3c7', color: '#92400e', label: 'Archived' },
    closed: { bg: '#fee2e2', color: '#991b1b', label: 'Closed' },
};

const EMPLOYMENT_LABEL: Record<string, string> = {
    full_time: 'Full Time',
    part_time: 'Part Time',
    contract: 'Contract',
    internship: 'Internship',
    locum: 'Locum',
};

export default function JobsList({ initialJobs }: { initialJobs: Job[] }) {
    const [jobs, setJobs] = useState(initialJobs);
    const [statusFilter, setStatusFilter] = useState('all');
    const [busyId, setBusyId] = useState<string | null>(null);

    const filtered = useMemo(
        () => (statusFilter === 'all' ? jobs : jobs.filter((j) => j.status === statusFilter)),
        [jobs, statusFilter]
    );

    async function updateStatus(id: string, status: string) {
        setBusyId(id);
        const prev = jobs.find((j) => j.id === id)?.status;
        setJobs((curr) =>
            curr.map((j) =>
                j.id === id
                    ? {
                        ...j,
                        status: status as Job['status'],
                        published_at:
                            status === 'published' && !j.published_at
                                ? new Date().toISOString()
                                : j.published_at,
                    }
                    : j
            )
        );
        try {
            const res = await fetch(`/api/jobs/${id}/status`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error('Failed');
        } catch {
            if (prev) {
                setJobs((curr) => curr.map((j) => (j.id === id ? { ...j, status: prev } : j)));
            }
            alert('Could not update status.');
        } finally {
            setBusyId(null);
        }
    }

    async function deleteJob(id: string, title: string) {
        if (
            !confirm(
                `Delete "${title}"?\n\nThis will also permanently delete all applications for this role. If you just want to hide it, use Archive instead.`
            )
        )
            return;
        setBusyId(id);
        try {
            const res = await fetch(`/api/jobs/${id}/delete`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed');
            setJobs((curr) => curr.filter((j) => j.id !== id));
        } catch {
            alert('Could not delete.');
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="space-y-5">
            <div className="bg-white border border-[var(--color-border-soft)] rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold">Filter</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-[var(--color-border-soft)] text-sm bg-white outline-none focus:border-[var(--color-brand)]"
                    >
                        <option value="all">All statuses</option>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                        <option value="closed">Closed</option>
                    </select>
                    <span className="text-xs text-gray-400">
                        {filtered.length} of {jobs.length}
                    </span>
                </div>
                <a
                    href="/admin/jobs/new"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--color-brand)] text-white text-xs font-bold rounded-xl hover:bg-[var(--color-brand-hover)] transition-colors"
                >
                    + New job
                </a>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white border border-[var(--color-border-soft)] rounded-2xl p-16 text-center">
                    <p className="text-sm text-gray-400">No jobs match this filter.</p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {filtered.map((j) => {
                        const style = statusStyle[j.status];
                        const busy = busyId === j.id;
                        return (
                            <li
                                key={j.id}
                                className={`bg-white border border-[var(--color-border-soft)] rounded-2xl p-5 sm:p-6 ${busy ? 'opacity-60' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-6 flex-wrap">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-3 flex-wrap mb-1.5">
                                            <h3 className="text-base font-bold text-[var(--color-ink)]">{j.title}</h3>
                                            <span
                                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                                                style={{ background: style.bg, color: style.color }}
                                            >
                                                {style.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {j.departments?.label ?? 'No department'} ·{' '}
                                            {EMPLOYMENT_LABEL[j.employment_type] ?? j.employment_type} · {j.location}
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-2 font-mono">/jobs/{j.slug}</p>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        {/* Status-based actions */}
                                        {j.status === 'draft' && (
                                            <>
                                                <ActionBtn onClick={() => updateStatus(j.id, 'published')} disabled={busy} primary>
                                                    Publish
                                                </ActionBtn>
                                                <ActionLink href={`/admin/jobs/${j.id}/edit`}>Edit</ActionLink>
                                            </>
                                        )}

                                        {j.status === 'published' && (
                                            <>
                                                <ActionLink href={`/jobs/${j.slug}`} target="_blank">
                                                    View live ↗
                                                </ActionLink>
                                                <ActionLink href={`/admin/jobs/${j.id}/edit`}>Edit</ActionLink>
                                                <ActionBtn onClick={() => updateStatus(j.id, 'closed')} disabled={busy}>
                                                    Close
                                                </ActionBtn>
                                            </>
                                        )}

                                        {j.status === 'closed' && (
                                            <>
                                                <ActionLink href={`/admin/jobs/${j.id}/edit`}>Edit</ActionLink>
                                                <ActionBtn onClick={() => updateStatus(j.id, 'published')} disabled={busy} primary>
                                                    Reopen
                                                </ActionBtn>
                                                <ActionBtn onClick={() => updateStatus(j.id, 'archived')} disabled={busy}>
                                                    Archive
                                                </ActionBtn>
                                            </>
                                        )}

                                        {j.status === 'archived' && (
                                            <>
                                                <ActionBtn onClick={() => updateStatus(j.id, 'draft')} disabled={busy}>
                                                    Restore to draft
                                                </ActionBtn>
                                            </>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => deleteJob(j.id, j.title)}
                                            disabled={busy}
                                            className="text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors px-2"
                                            title="Delete permanently"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function ActionBtn({
    children,
    onClick,
    disabled,
    primary,
}: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    primary?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={
                primary
                    ? 'px-3.5 py-2 text-xs font-bold rounded-lg bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] disabled:opacity-60 transition-colors'
                    : 'px-3.5 py-2 text-xs font-bold rounded-lg bg-white border border-[var(--color-border-soft)] text-[var(--color-ink)] hover:border-[var(--color-brand)] disabled:opacity-60 transition-colors'
            }
        >
            {children}
        </button>
    );
}

function ActionLink({
    children,
    href,
    target,
}: {
    children: React.ReactNode;
    href: string;
    target?: string;
}) {
    return (
        <a
            href={href}
            target={target}
            rel={target === '_blank' ? 'noopener' : undefined}
            className="px-3.5 py-2 text-xs font-bold rounded-lg bg-white border border-[var(--color-border-soft)] text-[var(--color-ink)] hover:border-[var(--color-brand)] transition-colors"
        >
            {children}
        </a>
    );
}