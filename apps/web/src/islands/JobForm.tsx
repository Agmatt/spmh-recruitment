import { useState, type FormEvent } from 'react';
import MarkdownEditor from './MarkdownEditor.tsx';

type Department = { id: string; slug: string; label: string };

type JobInitial = {
  id?: string;
  title: string;
  slug: string;
  department_id: string | null;
  employment_type: string;
  location: string;
  summary: string;
  description_md: string;
  requirements_md: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  closes_at: string | null;
};

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'locum', label: 'Locum' },
];

const SALARY_PERIODS = [
  { value: 'month', label: 'per month' },
  { value: 'year', label: 'per year' },
  { value: 'week', label: 'per week' },
  { value: 'day', label: 'per day' },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export default function JobForm({
  departments,
  initial,
  mode,
}: {
  departments: Department[];
  initial?: JobInitial;
  mode: 'create' | 'edit';
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const payload = {
      title: String(fd.get('title') ?? '').trim(),
      slug: String(fd.get('slug') ?? '').trim(),
      department_id: (fd.get('department_id') as string) || null,
      employment_type: String(fd.get('employment_type') ?? 'full_time'),
      location: String(fd.get('location') ?? '').trim(),
      summary: String(fd.get('summary') ?? '').trim(),
      description_md: String(fd.get('description_md') ?? '').trim(),
      requirements_md: String(fd.get('requirements_md') ?? '').trim(),
      salary_min: fd.get('salary_min') ? Number(fd.get('salary_min')) : null,
      salary_max: fd.get('salary_max') ? Number(fd.get('salary_max')) : null,
      salary_currency: String(fd.get('salary_currency') ?? 'KES').trim(),
      salary_period: String(fd.get('salary_period') ?? 'month'),
      closes_at: String(fd.get('closes_at') ?? '') || null,
    };

    const url = mode === 'create' ? '/api/jobs/create' : `/api/jobs/${initial?.id}/update`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'Save failed.');
        setSubmitting(false);
        return;
      }
      window.location.href = '/admin/jobs';
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Role identity">
        <Field label="Job title" required>
          <input
            name="title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
            maxLength={200}
            className={inputCls}
            placeholder="e.g. Registered Nurse"
          />
        </Field>

        <Field label="URL slug" hint="Auto-generated from title. Must be unique." required>
          <input
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
            maxLength={100}
            pattern="[a-z0-9-]+"
            className={inputCls}
            placeholder="registered-nurse"
          />
          <p className="text-[11px] text-gray-400 mt-1.5">
            Public URL: <span className="font-mono">/jobs/{slug || 'your-slug'}</span>
          </p>
        </Field>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Department">
            <select
              name="department_id"
              defaultValue={initial?.department_id ?? ''}
              className={inputCls}
            >
              <option value="">— none —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Employment type" required>
            <select
              name="employment_type"
              defaultValue={initial?.employment_type ?? 'full_time'}
              className={inputCls}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Location" required>
          <input
            name="location"
            defaultValue={initial?.location ?? 'Homa Bay, Kenya'}
            required
            maxLength={120}
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title="Content">
        <Field label="Short summary" hint="Shown on the careers list. Max 500 chars.">
          <textarea
            name="summary"
            defaultValue={initial?.summary ?? ''}
            rows={2}
            maxLength={500}
            className={`${inputCls} resize-y`}
            placeholder="One or two lines describing the role."
          />
        </Field>

        <Field
          label="Full description"
          hint="Use the toolbar or type Markdown. Preview updates live on the right."
          required
        >
          <MarkdownEditor
            name="description_md"
            defaultValue={initial?.description_md ?? ''}
            required
            rows={14}
            placeholder={'## About the role\n\nDescribe the position here…\n\n- Key responsibility\n- Another responsibility'}
          />
        </Field>

        <Field label="Requirements" hint="Markdown supported. Optional.">
          <MarkdownEditor
            name="requirements_md"
            defaultValue={initial?.requirements_md ?? ''}
            rows={10}
            placeholder={'## Requirements\n\n- Qualification\n- Experience\n- Registration'}
          />
        </Field>
      </Section>

      <Section title="Compensation & deadline">
        <div className="grid sm:grid-cols-3 gap-5">
          <Field label="Salary min">
            <input
              type="number"
              name="salary_min"
              defaultValue={initial?.salary_min ?? ''}
              min={0}
              className={inputCls}
              placeholder="Optional"
            />
          </Field>
          <Field label="Salary max">
            <input
              type="number"
              name="salary_max"
              defaultValue={initial?.salary_max ?? ''}
              min={0}
              className={inputCls}
              placeholder="Optional"
            />
          </Field>
          <Field label="Currency">
            <input
              name="salary_currency"
              defaultValue={initial?.salary_currency ?? 'KES'}
              maxLength={8}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Salary period">
            <select
              name="salary_period"
              defaultValue={initial?.salary_period ?? 'month'}
              className={inputCls}
            >
              {SALARY_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Applications close" hint="Optional. Leave blank for open-ended.">
            <input
              type="date"
              name="closes_at"
              defaultValue={initial?.closes_at ? initial.closes_at.slice(0, 10) : ''}
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <a
          href="/admin/jobs"
          className="text-sm font-semibold text-gray-500 hover:text-[var(--color-brand)]"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 bg-[var(--color-brand)] text-white font-bold text-sm rounded-xl hover:bg-[var(--color-brand-hover)] disabled:opacity-60 transition-colors"
        >
          {submitting
            ? 'Saving…'
            : mode === 'create'
              ? 'Create draft'
              : 'Save changes'}
        </button>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        Jobs are saved as <strong>drafts</strong>. You can publish them from the Job Postings list
        once you're ready for applicants to see them.
      </p>
    </form>
  );
}

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border-soft)] text-sm bg-white outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10 transition-colors';

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
      <div className="flex items-baseline justify-between mb-1.5 gap-4">
        <label className="text-sm font-semibold text-[var(--color-ink)]">
          {label} {required && <span className="text-[var(--color-brand)]">*</span>}
        </label>
        {hint && <span className="text-[11px] text-gray-400 text-right">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="bg-white border border-[var(--color-border-soft)] rounded-2xl p-6 sm:p-8 space-y-6">
      <legend className="px-3 -ml-3 text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-brand)]">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}