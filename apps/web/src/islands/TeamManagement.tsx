import { useState, useMemo } from 'react';

type Member = {
    user_id: string;
    email: string;
    role: 'hr_admin' | 'super_admin';
    full_name: string | null;
    invited_at: string;
    last_sign_in_at: string | null;
    created_at: string;
};

type Props = {
    initial: Member[];
    currentUserId: string;
};

const ROLE_LABEL: Record<string, string> = {
    hr_admin: 'HR Admin',
    super_admin: 'Super Admin',
};

export default function TeamManagement({ initial, currentUserId }: Props) {
    const [members, setMembers] = useState<Member[]>(initial);
    const [showInvite, setShowInvite] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const stats = useMemo(
        () => ({
            total: members.length,
            superAdmins: members.filter((m) => m.role === 'super_admin').length,
            hrAdmins: members.filter((m) => m.role === 'hr_admin').length,
        }),
        [members]
    );

    async function changeRole(id: string, role: string) {
        setBusyId(id);
        const prev = members.find((m) => m.user_id === id)?.role;
        setMembers((curr) =>
            curr.map((m) => (m.user_id === id ? { ...m, role: role as Member['role'] } : m))
        );
        try {
            const res = await fetch(`/api/team/${id}/role`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? 'Update failed');
            }
        } catch (err) {
            if (prev) {
                setMembers((curr) =>
                    curr.map((m) => (m.user_id === id ? { ...m, role: prev } : m))
                );
            }
            alert(err instanceof Error ? err.message : 'Could not update role.');
        } finally {
            setBusyId(null);
        }
    }

    async function removeMember(id: string, name: string) {
        if (
            !confirm(
                `Remove ${name} from the recruitment team?\n\nThey will no longer be able to sign in to the admin dashboard. Their account will remain but without access.`
            )
        )
            return;
        setBusyId(id);
        const previous = members;
        setMembers((curr) => curr.filter((m) => m.user_id !== id));
        try {
            const res = await fetch(`/api/team/${id}/remove`, { method: 'POST' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? 'Remove failed');
            }
        } catch (err) {
            setMembers(previous);
            alert(err instanceof Error ? err.message : 'Could not remove.');
        } finally {
            setBusyId(null);
        }
    }

    function handleInvited() {
        setShowInvite(false);
        // Reload to fetch the fresh list
        window.location.reload();
    }

    return (
        <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-4">
                <StatCard label="Team members" value={stats.total} color="from-slate-600 to-slate-700" />
                <StatCard label="Super admins" value={stats.superAdmins} color="from-[#860f0f] to-[#a01212]" />
                <StatCard label="HR admins" value={stats.hrAdmins} color="from-blue-600 to-blue-700" />
            </div>

            {/* Actions bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs text-slate-500">
                    <i className="fa-solid fa-circle-info mr-1.5 text-slate-400"></i>
                    Only super admins can manage the team.
                </p>
                <button
                    onClick={() => setShowInvite(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#860f0f] text-white text-xs font-bold rounded-xl hover:bg-[#a01212] transition-colors"
                >
                    <i className="fa-solid fa-user-plus text-[11px]"></i>
                    Invite team member
                </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                        <thead className="bg-slate-100 border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-slate-700">Name</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-slate-700">Email</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-slate-700">Role</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-slate-700">Last sign-in</th>
                                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-slate-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {members.map((m) => {
                                const busy = busyId === m.user_id;
                                const isMe = m.user_id === currentUserId;
                                const isSuper = m.role === 'super_admin';
                                return (
                                    <tr key={m.user_id} className={`hover:bg-slate-50 transition-colors ${busy ? 'opacity-60' : ''}`}>
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-semibold text-slate-900">
                                                {m.full_name || '—'}
                                                {isMe && (
                                                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[#860f0f] bg-red-50 px-2 py-0.5 rounded-full">
                                                        You
                                                    </span>
                                                )}
                                            </p>
                                        </td>
                                        <td className="px-5 py-4 text-sm text-slate-600">{m.email}</td>
                                        <td className="px-5 py-4">
                                            <select
                                                value={m.role}
                                                disabled={busy || isMe}
                                                onChange={(e) => changeRole(m.user_id, e.target.value)}
                                                className={`text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border-0 cursor-pointer outline-none disabled:cursor-not-allowed disabled:opacity-70 ${isSuper
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-blue-100 text-blue-800'
                                                    }`}
                                                title={isMe ? 'You cannot change your own role' : ''}
                                            >
                                                <option value="hr_admin">HR Admin</option>
                                                <option value="super_admin">Super Admin</option>
                                            </select>
                                        </td>
                                        <td className="px-5 py-4 text-xs text-slate-500">
                                            {m.last_sign_in_at
                                                ? new Date(m.last_sign_in_at).toLocaleDateString('en-KE', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })
                                                : <span className="text-slate-400 italic">Never</span>}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button
                                                onClick={() => removeMember(m.user_id, m.full_name || m.email)}
                                                disabled={busy || isMe}
                                                className="text-xs font-bold text-red-600 hover:text-red-700 uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                                                title={isMe ? 'You cannot remove yourself' : ''}
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {showInvite && (
                <InviteModal onClose={() => setShowInvite(false)} onInvited={handleInvited} />
            )}
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className={`bg-gradient-to-br ${color} rounded-xl p-5 text-white shadow-lg`}>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-90 mb-1">{label}</p>
            <p className="text-2xl font-black">{value}</p>
        </div>
    );
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<'hr_admin' | 'super_admin'>('hr_admin');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setWarning('');

        try {
            const res = await fetch('/api/team/invite', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email, full_name: fullName, role }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(body.error ?? 'Invite failed.');
                setSubmitting(false);
                return;
            }
            if (body.warning) {
                setWarning(body.warning);
                setSubmitting(false);
                setTimeout(onInvited, 3000);
                return;
            }
            onInvited();
        } catch {
            setError('Network error. Please try again.');
            setSubmitting(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(15,15,20,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-md p-7 shadow-2xl border border-[#ece8e1]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#860f0f] mb-1.5">
                            Invite
                        </p>
                        <h3 className="text-xl font-black tracking-tight">New team member</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold mb-1.5">Full name</label>
                        <input
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            maxLength={100}
                            placeholder="e.g. Grace Wanjiru"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1.5">Email address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            maxLength={200}
                            placeholder="grace@spmh.co.ke"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1.5">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as 'hr_admin' | 'super_admin')}
                            className={inputCls}
                        >
                            <option value="hr_admin">HR Admin — can manage jobs, applications, volunteers, partnerships</option>
                            <option value="super_admin">Super Admin — full access including team management</option>
                        </select>
                    </div>

                    {error && (
                        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            {error}
                        </div>
                    )}
                    {warning && (
                        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            {warning}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2.5 bg-[#860f0f] text-white text-xs font-bold rounded-xl hover:bg-[#a01212] disabled:opacity-60 transition-colors"
                        >
                            {submitting ? 'Sending invite…' : 'Send invite'}
                        </button>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed pt-2">
                        They'll receive an email with a link to set their password. The
                        link expires in one hour.
                    </p>
                </form>
            </div>
        </div>
    );
}

const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-[#860f0f] focus:ring-2 focus:ring-[#860f0f]/10 transition-colors';