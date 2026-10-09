import type { APIRoute } from 'astro';
import ExcelJS from 'exceljs';
import { createSupabaseServerClient } from '../../../lib/supabase-ssr';

export const prerender = false;

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

const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  internship: 'Internship',
  locum: 'Locum',
};

type Row = {
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  cover_letter: string | null;
  job_postings: {
    title: string;
    slug: string;
    employment_type: string;
    location: string;
    departments: { label: string } | null;
  } | null;
};

export const GET: APIRoute = async (context) => {
  const { type } = context.params;
  if (type !== 'csv' && type !== 'xlsx') {
    return new Response('Unsupported format', { status: 400 });
  }

  const supabase = createSupabaseServerClient(context);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // RLS-enforced: only admins get rows back
  const { data, error } = await supabase
    .from('applications')
    .select(`
      full_name, email, phone, status, created_at, cover_letter,
      job_postings (
        title, slug, employment_type, location,
        departments ( label )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[export] query error:', error);
    return new Response('Export failed', { status: 500 });
  }

  const rows = (data ?? []) as unknown as Row[];
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `SPMH-Applications-${timestamp}.${type === 'csv' ? 'csv' : 'xlsx'}`;

  if (type === 'csv') {
    return csvResponse(rows, filename);
  }
  return xlsxResponse(rows, filename);
};

// ── CSV ────────────────────────────────────────────────────
function csvResponse(rows: Row[], filename: string) {
  const headers = [
    'Full Name',
    'Email',
    'Phone',
    'Role',
    'Department',
    'Employment Type',
    'Location',
    'Status',
    'Applied On',
    'Cover Letter',
  ];

  const lines: string[] = [headers.map(csvCell).join(',')];

  for (const r of rows) {
    lines.push(
      [
        r.full_name,
        r.email,
        r.phone ?? '',
        r.job_postings?.title ?? '',
        r.job_postings?.departments?.label ?? '',
        r.job_postings?.employment_type
          ? EMPLOYMENT_LABEL[r.job_postings.employment_type] ?? r.job_postings.employment_type
          : '',
        r.job_postings?.location ?? '',
        STATUS_LABEL[r.status] ?? r.status,
        new Date(r.created_at).toLocaleDateString('en-KE'),
        r.cover_letter ?? '',
      ]
        .map(csvCell)
        .join(',')
    );
  }

  const csv = '\uFEFF' + lines.join('\r\n'); // BOM so Excel opens UTF-8 correctly

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ── XLSX ───────────────────────────────────────────────────
async function xlsxResponse(rows: Row[], filename: string) {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  wb.creator = "St. Paul's Mission Hospital";

  const ws = wb.addWorksheet('Applications', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = [
    { header: 'Full Name', key: 'full_name', width: 26 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Role', key: 'role', width: 28 },
    { header: 'Department', key: 'department', width: 22 },
    { header: 'Employment Type', key: 'employment', width: 16 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Applied On', key: 'applied', width: 14 },
    { header: 'Cover Letter', key: 'cover', width: 60 },
  ];

  // Style header row
  const headRow = ws.getRow(1);
  headRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF860F0F' },
  };
  headRow.height = 22;
  headRow.alignment = { vertical: 'middle', horizontal: 'left' };

  for (const r of rows) {
    ws.addRow({
      full_name: r.full_name,
      email: r.email,
      phone: r.phone ?? '',
      role: r.job_postings?.title ?? '',
      department: r.job_postings?.departments?.label ?? '',
      employment: r.job_postings?.employment_type
        ? EMPLOYMENT_LABEL[r.job_postings.employment_type] ?? r.job_postings.employment_type
        : '',
      location: r.job_postings?.location ?? '',
      status: STATUS_LABEL[r.status] ?? r.status,
      applied: new Date(r.created_at).toLocaleDateString('en-KE'),
      cover: r.cover_letter ?? '',
    });
  }

  // Auto-row-stripe
  ws.eachRow((row, i) => {
    if (i > 1 && i % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9F6F2' },
      };
    }
    row.alignment = { vertical: 'top', wrapText: i === 1 ? false : true };
  });

  const buf = await wb.xlsx.writeBuffer();

  return new Response(buf, {
    status: 200,
    headers: {
      'content-type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}