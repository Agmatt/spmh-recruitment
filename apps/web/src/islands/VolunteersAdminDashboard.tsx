import React, { useState, useMemo, Fragment } from 'react';

type Volunteer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  occupation: string | null;
  interests: string | null;
  availability: string | null;
  message: string | null;
  status: 'active' | 'pending' | 'inactive' | null;
  created_at: string;
};

const STATUSES = ['active', 'pending', 'inactive'] as const;

export default function VolunteersAdminDashboard({
  initial,
}: {
  initial: Volunteer[];
}) {
  const [volunteers, setVolunteers] = useState<Volunteer[]>(initial);
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filteredVolunteers = useMemo(() => {
    if (statusFilter === 'all') return volunteers;
    return volunteers.filter((v) => v.status === statusFilter);
  }, [volunteers, statusFilter]);

  const updateVolunteerStatus = async (id: string, newStatus: string) => {
    setBusyId(id);
    const prev = volunteers.find((v) => v.id === id)?.status;
    setVolunteers((curr) =>
      curr.map((v) => (v.id === id ? { ...v, status: newStatus as Volunteer['status'] } : v))
    );

    try {
      const res = await fetch(`/api/volunteers/${id}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch (err) {
      console.error('Error updating volunteer:', err);
      if (prev) {
        setVolunteers((curr) =>
          curr.map((v) => (v.id === id ? { ...v, status: prev } : v))
        );
      }
      alert('Could not update status.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteVolunteer = async (id: string) => {
    if (!confirm('Delete this volunteer record permanently?')) return;

    setBusyId(id);
    const previous = volunteers;
    setVolunteers((prev) => prev.filter((v) => v.id !== id));

    try {
      const res = await fetch(`/api/volunteers/${id}/delete`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
    } catch (err) {
      console.error('Error deleting volunteer:', err);
      setVolunteers(previous);
      alert('Could not delete.');
    } finally {
      setBusyId(null);
    }
  };

  const statCardData = [
    { label: 'Total', count: volunteers.length, color: 'from-slate-600 to-slate-700' },
    { label: 'Active', count: volunteers.filter((v) => v.status === 'active').length, color: 'from-green-600 to-green-700' },
    { label: 'Pending', count: volunteers.filter((v) => v.status === 'pending').length, color: 'from-amber-600 to-amber-700' },
    { label: 'Inactive', count: volunteers.filter((v) => v.status === 'inactive').length, color: 'from-red-600 to-red-700' },
  ];

  const statusBgColor: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-amber-100 text-amber-800',
    inactive: 'bg-red-100 text-red-800',
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
        {filteredVolunteers.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-slate-500 text-sm font-medium">No volunteers found</p>
          </div>
        ) : (
          <>
            {/* DESKTOP VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider w-8"></th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Phone</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Location</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Occupation</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-700 tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredVolunteers.map((vol) => {
                    const isOpen = expanded === vol.id;
                    return (
                      <Fragment key={vol.id}>
                        <tr
                          className={`cursor-pointer hover:bg-slate-50 transition-colors ${
                            busyId === vol.id ? 'opacity-60' : ''
                          }`}
                          onClick={() => setExpanded(isOpen ? null : vol.id)}
                        >
                          <td className="px-5 py-4 text-slate-400">
                            <span className={`inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                              ▶
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                            {vol.first_name} {vol.last_name}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600">{vol.email || '-'}</td>
                          <td className="px-5 py-4 text-sm text-slate-600">{vol.phone || '-'}</td>
                          <td className="px-5 py-4 text-sm text-slate-600">{vol.location || '-'}</td>
                          <td className="px-5 py-4 text-sm text-slate-600">{vol.occupation || '-'}</td>
                          <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={vol.status || 'pending'}
                              disabled={busyId === vol.id}
                              onChange={(e) => updateVolunteerStatus(vol.id, e.target.value)}
                              className={`text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border-0 cursor-pointer outline-none ${
                                statusBgColor[vol.status || 'pending'] || statusBgColor.pending
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
                              onClick={() => deleteVolunteer(vol.id)}
                              disabled={busyId === vol.id}
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
                                <Detail label="Areas of Interest" value={vol.interests} />
                                <Detail label="Availability" value={vol.availability} />
                                <div className="sm:col-span-2">
                                  <Detail label="Motivation / Message" value={vol.message} />
                                </div>
                                <Detail
                                  label="Submitted"
                                  value={new Date(vol.created_at).toLocaleString('en-KE', {
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
              {filteredVolunteers.map((vol) => {
                const isOpen = expanded === vol.id;
                return (
                  <div key={vol.id} className="p-4 space-y-3">
                    <div
                      className="flex items-start justify-between gap-2 cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : vol.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm">
                          {vol.first_name} {vol.last_name}
                        </p>
                        <p className="text-xs text-slate-600">{vol.email || '-'}</p>
                        <p className="text-xs text-slate-600">{vol.phone || '-'}</p>
                        {vol.occupation && (
                          <p className="text-xs text-slate-500 italic mt-0.5">{vol.occupation}</p>
                        )}
                      </div>
                      <select
                        value={vol.status || 'pending'}
                        disabled={busyId === vol.id}
                        onChange={(e) => updateVolunteerStatus(vol.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`text-xs font-bold uppercase tracking-wide px-2 py-1.5 rounded-full border-0 cursor-pointer outline-none flex-shrink-0 ${
                          statusBgColor[vol.status || 'pending'] || statusBgColor.pending
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
                      📍 {vol.location || '-'}
                    </p>

                    {isOpen && (
                      <div className="pt-3 border-t border-slate-200 space-y-3 text-xs">
                        <Detail label="Areas of Interest" value={vol.interests} small />
                        <Detail label="Availability" value={vol.availability} small />
                        <Detail label="Motivation / Message" value={vol.message} small />
                        <Detail
                          label="Submitted"
                          value={new Date(vol.created_at).toLocaleDateString('en-KE')}
                          small
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => setExpanded(isOpen ? null : vol.id)}
                        className="text-xs font-bold text-slate-500 uppercase tracking-wider"
                      >
                        {isOpen ? 'Hide details' : 'View details'}
                      </button>
                      <button
                        onClick={() => deleteVolunteer(vol.id)}
                        disabled={busyId === vol.id}
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
        Showing {filteredVolunteers.length} of {volunteers.length} volunteers · Click any row to see full details
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
  small,
}: {
  label: string;
  value: string | null | undefined;
  small?: boolean;
}) {
  return (
    <div>
      <p
        className={`font-bold uppercase tracking-wider text-slate-500 mb-1 ${
          small ? 'text-[10px]' : 'text-xs'
        }`}
      >
        {label}
      </p>
      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
        {value && value.trim() ? value : <span className="text-slate-400 italic">Not provided</span>}
      </p>
    </div>
  );
}