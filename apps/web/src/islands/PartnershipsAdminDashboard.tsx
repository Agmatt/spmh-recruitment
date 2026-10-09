import React, { useState, useMemo, Fragment } from 'react';

type Partnership = {
    id: string;
    org_name: string;
    org_type: string | null;
    country: string | null;
    website: string | null;
    contact_name: string;
    contact_role: string | null;
    contact_email: string;
    contact_phone: string | null;
    collaboration_areas: string | null;
    proposal: string | null;
    status: 'pending' | 'reviewing' | 'approved' | 'rejected' | null;
    created_at: string;
};

const STATUSES = ['pending', 'reviewing', 'approved', 'rejected'] as const;

export default function PartnershipsAdminDashboard({
    initial,
}: {
    initial: Partnership[];
}) {
    const [partnerships, setPartnerships] = useState<Partnership[]>(initial);
    const [statusFilter, setStatusFilter] = useState('all');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const filteredPartnerships = useMemo(() => {
        if (statusFilter === 'all') return partnerships;
        return partnerships.filter((p) => p.status === statusFilter);
    }, [partnerships, statusFilter]);

    const updatePartnershipStatus = async (id: string, newStatus: string) => {
        setBusyId(id);
        const prev = partnerships.find((p) => p.id === id)?.status;
        setPartnerships((curr) =>
            curr.map((p) => (p.id === id ? { ...p, status: newStatus as Partnership['status'] } : p))
        );

        try {
            const res = await fetch(`/api/partnerships/${id}/status`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error('Failed');
        } catch (err) {
            console.error('Error updating partnership:', err);
            if (prev) {
                setPartnerships((curr) =>
                    curr.map((p) => (p.id === id ? { ...p, status: prev } : p))
                );
            }
            alert('Could not update status.');
        } finally {
            setBusyId(null);
        }
    };

    const deletePartnership = async (id: string) => {
        if (!confirm('Delete this partnership inquiry permanently?')) return;

        setBusyId(id);
        const previous = partnerships;
        setPartnerships((prev) => prev.filter((p) => p.id !== id));

        try {
            const res = await fetch(`/api/partnerships/${id}/delete`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed');
        } catch (err) {
            console.error('Error deleting partnership:', err);
            setPartnerships(previous);
            alert('Could not delete.');
        } finally {
            setBusyId(null);
        }
    };

    const statCardData = [
        { label: 'Total', count: partnerships.length, color: 'from-slate-600 to-slate-700' },
        { label: 'Pending', count: partnerships.filter((p) => p.status === 'pending').length, color: 'from-amber-600 to-amber-700' },
        { label: 'In Review', count: partnerships.filter((p) => p.status === 'reviewing').length, color: 'from-blue-600 to-blue-700' },
        { label: 'Approved', count: partnerships.filter((p) => p.status === 'approved').length, color: 'from-green-600 to-green-700' },
    ];

    const statusBgColor: Record<string, string> = {
        pending: 'bg-amber-100 text-amber-800',
        reviewing: 'bg-blue-100 text-blue-800',
        approved: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
    };

    return (
        <div className="space-y-6">
            {/* STAT CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {statCardData.map((card) => (
                    <div
                        key={card.label}
                        className={`bg-gradient-to-br ${card.color} rounded-xl p-5 text-white shadow-lg`}
                    >
                        <p className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1">
                            {card.label}
                        </p>
                        <p className="text-3xl font-black">{card.count}</p>
                    </div>
                ))}
            </div>

            {/* FILTER */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <label className="block text-xs font-bold uppercase text-slate-700 mb-3">
                    Filter by Status
                </label>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full sm:w-64 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-opacity-20 bg-slate-50"
                >
                    <option value="all">All Statuses</option>
                    {STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            {/* TABLE/LIST */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {filteredPartnerships.length === 0 ? (
                    <div className="text-center py-12 px-4">
                        <p className="text-slate-500 text-sm font-medium">No partnerships found</p>
                    </div>
                ) : (
                    <>
                        {/* DESKTOP VIEW */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-100 border-b border-slate-200">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider w-8"></th>
                                        <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Organization</th>
                                        <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Contact</th>
                                        <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Email</th>
                                        <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Type</th>
                                        <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Country</th>
                                        <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Status</th>
                                        <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredPartnerships.map((part) => {
                                        const isOpen = expanded === part.id;
                                        return (
                                            <Fragment key={part.id}>
                                                <tr
                                                    className={`cursor-pointer hover:bg-slate-50 transition-colors ${busyId === part.id ? 'opacity-60' : ''
                                                        }`}
                                                    onClick={() => setExpanded(isOpen ? null : part.id)}
                                                >
                                                    <td className="px-5 py-4 text-slate-400">
                                                        <span className={`inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                                                            ▶
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                                                        {part.org_name}
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">
                                                        {part.contact_name}
                                                        {part.contact_role && (
                                                            <p className="text-xs text-slate-400 italic">{part.contact_role}</p>
                                                        )}
                                                    </td>
                                                    <td
                                                        className="px-5 py-4 text-sm text-blue-600 hover:underline"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <a href={`mailto:${part.contact_email}`}>{part.contact_email}</a>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">{part.org_type || '-'}</td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">{part.country || '-'}</td>
                                                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                                        <select
                                                            value={part.status || 'pending'}
                                                            disabled={busyId === part.id}
                                                            onChange={(e) => updatePartnershipStatus(part.id, e.target.value)}
                                                            className={`text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border-0 cursor-pointer outline-none ${statusBgColor[part.status || 'pending'] || statusBgColor.pending
                                                                }`}
                                                        >
                                                            {STATUSES.map((s) => (
                                                                <option key={s} value={s}>
                                                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td
                                                        className="px-5 py-4 text-right"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <button
                                                            onClick={() => deletePartnership(part.id)}
                                                            disabled={busyId === part.id}
                                                            className="text-xs font-bold text-red-600 hover:text-red-700 uppercase tracking-wider disabled:opacity-50"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                                {isOpen && (
                                                    <tr className="bg-slate-50">
                                                        <td colSpan={8} className="px-5 py-5">
                                                            <div className="grid sm:grid-cols-2 gap-5 text-sm">
                                                                <Detail label="Contact Phone" value={part.contact_phone} />
                                                                <Detail
                                                                    label="Website"
                                                                    value={part.website}
                                                                    link={part.website ?? undefined}
                                                                />
                                                                <div className="sm:col-span-2">
                                                                    <Detail
                                                                        label="Proposed Area(s) of Collaboration"
                                                                        value={part.collaboration_areas}
                                                                    />
                                                                </div>
                                                                <div className="sm:col-span-2">
                                                                    <Detail
                                                                        label="Brief Description of Proposed Collaboration"
                                                                        value={part.proposal}
                                                                    />
                                                                </div>
                                                                <Detail
                                                                    label="Submitted"
                                                                    value={new Date(part.created_at).toLocaleString('en-KE', {
                                                                        day: 'numeric',
                                                                        month: 'long',
                                                                        year: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                    })}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* MOBILE VIEW */}
                        <div className="md:hidden divide-y divide-slate-200">
                            {filteredPartnerships.map((part) => {
                                const isOpen = expanded === part.id;
                                return (
                                    <div key={part.id} className="p-4 space-y-3">
                                        <div
                                            className="flex items-start justify-between gap-2 cursor-pointer"
                                            onClick={() => setExpanded(isOpen ? null : part.id)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-900 text-sm truncate">
                                                    {part.org_name}
                                                </p>
                                                <p className="text-xs text-slate-600">{part.contact_name}</p>
                                                {part.contact_role && (
                                                    <p className="text-xs text-slate-400 italic">{part.contact_role}</p>
                                                )}
                                                <p className="text-xs text-blue-600">
                                                    <a href={`mailto:${part.contact_email}`}>{part.contact_email}</a>
                                                </p>
                                            </div>
                                            <select
                                                value={part.status || 'pending'}
                                                disabled={busyId === part.id}
                                                onChange={(e) => updatePartnershipStatus(part.id, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className={`text-xs font-bold uppercase tracking-wide px-2 py-1.5 rounded-full border-0 cursor-pointer outline-none flex-shrink-0 ${statusBgColor[part.status || 'pending'] || statusBgColor.pending
                                                    }`}
                                            >
                                                {STATUSES.map((s) => (
                                                    <option key={s} value={s}>
                                                        {s.charAt(0).toUpperCase() + s.slice(1)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <p className="text-xs font-medium text-slate-600">
                                            📍 {part.country || '-'} · {part.org_type || 'Type not specified'}
                                        </p>

                                        {isOpen && (
                                            <div className="pt-3 border-t border-slate-200 space-y-3 text-xs">
                                                <Detail label="Contact Phone" value={part.contact_phone} small />
                                                <Detail label="Website" value={part.website} link={part.website ?? undefined} small />
                                                <Detail
                                                    label="Proposed Area(s) of Collaboration"
                                                    value={part.collaboration_areas}
                                                    small
                                                />
                                                <Detail
                                                    label="Brief Description of Proposed Collaboration"
                                                    value={part.proposal}
                                                    small
                                                />
                                                <Detail
                                                    label="Submitted"
                                                    value={new Date(part.created_at).toLocaleDateString('en-KE')}
                                                    small
                                                />
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-1">
                                            <button
                                                onClick={() => setExpanded(isOpen ? null : part.id)}
                                                className="text-xs font-bold text-slate-500 uppercase tracking-wider"
                                            >
                                                {isOpen ? 'Hide details' : 'View details'}
                                            </button>
                                            <button
                                                onClick={() => deletePartnership(part.id)}
                                                disabled={busyId === part.id}
                                                className="text-xs font-bold text-red-600 uppercase tracking-wider disabled:opacity-50"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            <p className="text-xs text-slate-500 font-medium">
                Showing {filteredPartnerships.length} of {partnerships.length} partnership inquiries · Click any row to see full details
            </p>
        </div>
    );
}

function Detail({
    label,
    value,
    link,
    small,
}: {
    label: string;
    value: string | null | undefined;
    link?: string;
    small?: boolean;
}) {
    return (
        <div>
            <p
                className={`font-bold uppercase tracking-wider text-slate-500 mb-1 ${small ? 'text-[10px]' : 'text-xs'
                    }`}
            >
                {label}
            </p>
            {value && value.trim() ? (
                link ? (
                    <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                    >
                        {value}
                    </a>
                ) : (
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{value}</p>
                )
            ) : (
                <span className="text-slate-400 italic">Not provided</span>
            )}
        </div>
    );
}