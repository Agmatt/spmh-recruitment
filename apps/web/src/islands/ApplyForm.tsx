import { useState, type FormEvent } from 'react';

type Job = { id: string; title: string; slug: string };

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function ApplyForm({ job }: { job: Job }) {
    const [status, setStatus] = useState<Status>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setStatus('submitting');
        setErrorMsg('');

        const fd = new FormData(e.currentTarget);
        fd.set('job_id', job.id);

        try {
            const res = await fetch('/api/apply', { method: 'POST', body: fd });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErrorMsg(body.error ?? 'Submission failed. Please try again.');
                setStatus('error');
                return;
            }
            setStatus('success');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
            setErrorMsg('Network error. Please check your connection and try again.');
            setStatus('error');
        }
    }

    if (status === 'success') {
        return (
            <div className="bg-white border border-[var(--color-border-soft)] rounded-2xl p-10 text-center">
                <div className="w-14 h-14 rounded-full bg-red-50 mx-auto flex items-center justify-center mb-5">
                    <svg className="w-7 h-7 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-2xl font-black tracking-tight mb-3">Application received</h2>
                <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                    Thank you for applying for <strong>{job.title}</strong>. A confirmation
                    has been sent to your email. Our HR team will be in touch if you are
                    shortlisted.
                </p>
                <a
                    href="/"
                    className="inline-block mt-8 px-6 py-3 bg-[var(--color-brand)] text-white text-sm font-bold rounded-xl hover:bg-[var(--color-brand-hover)] transition-colors"
                >
                    Back to all openings
                </a>
            </div>
        );
    }

    return (
        <form
            onSubmit={onSubmit}
            encType="multipart/form-data"
            className="bg-white border border-[var(--color-border-soft)] rounded-2xl p-6 sm:p-8 space-y-5"
        >
            <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Full name" required>
                    <input
                        name="full_name"
                        required
                        maxLength={100}
                        autoComplete="name"
                        className={inputCls}
                    />
                </Field>
                <Field label="Email address" required>
                    <input
                        type="email"
                        name="email"
                        required
                        maxLength={200}
                        autoComplete="email"
                        className={inputCls}
                    />
                </Field>
            </div>

            <Field label="Phone number" hint="Optional">
                <input
                    type="tel"
                    name="phone"
                    maxLength={30}
                    autoComplete="tel"
                    className={inputCls}
                />
            </Field>

            <Field label="Cover letter" hint="Optional · max 5000 characters">
                <textarea
                    name="cover_letter"
                    rows={6}
                    maxLength={5000}
                    className={`${inputCls} resize-y`}
                    placeholder="Tell us briefly why you're a good fit for this role."
                />
            </Field>

            <Field label="CV / Résumé" required hint="PDF, DOC, or DOCX · max 5 MB">
                <label className="flex items-center gap-4 border border-dashed border-[var(--color-border-soft)] rounded-xl px-4 py-4 cursor-pointer hover:border-[var(--color-brand)] transition-colors">
                    <svg className="w-6 h-6 text-[var(--color-brand)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
                    </svg>
                    <div className="min-w-0 flex-1">
                        {fileName ? (
                            <>
                                <p className="text-sm font-medium text-[var(--color-ink)] truncate">{fileName}</p>
                                <p className="text-xs text-gray-400">{(fileSize / 1024 / 1024).toFixed(2)} MB</p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-medium text-[var(--color-ink)]">Choose a file</p>
                                <p className="text-xs text-gray-400">Click to browse</p>
                            </>
                        )}
                    </div>
                    <input
                        type="file"
                        name="cv"
                        required
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="sr-only"
                        onChange={(e) => {
                            const f = e.currentTarget.files?.[0];
                            setFileName(f?.name ?? '');
                            setFileSize(f?.size ?? 0);
                        }}
                    />
                </label>
            </Field>

            <label className="flex items-start gap-3 pt-2">
                <input
                    type="checkbox"
                    name="consent"
                    value="true"
                    required
                    className="mt-0.5 w-4 h-4 accent-[var(--color-brand)] shrink-0"
                />
                <span className="text-xs text-gray-500 leading-relaxed">
                    I consent to St. Paul's Mission Hospital processing my personal data
                    for recruitment purposes. I understand my application will be retained
                    for a period consistent with the hospital's{' '}
                    <a href="/privacy" target="_blank" className="text-[var(--color-brand)] underline">
                        privacy notice
                    </a>
                    .
                </span>
            </label>

            {status === 'error' && errorMsg && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    {errorMsg}
                </div>
            )}

            <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full py-4 bg-[var(--color-brand)] text-white font-bold text-sm rounded-xl hover:bg-[var(--color-brand-hover)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
                {status === 'submitting' ? 'Submitting…' : 'Submit application'}
            </button>
        </form>
    );
}

const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border-soft)] text-sm text-[var(--color-ink)] bg-white outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10 transition-colors';

function Field({
    label,
    hint,
    required,
    children,
}: {
    label: string;
    hint?: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-xs font-semibold text-[var(--color-ink)]">
                    {label} {required && <span className="text-[var(--color-brand)]">*</span>}
                </label>
                {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
            </div>
            {children}
        </div>
    );
}