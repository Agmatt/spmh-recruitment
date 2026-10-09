import type { APIRoute } from 'astro';
import ExcelJS from 'exceljs';
import { createSupabaseServerClient } from '../../../lib/supabase-ssr';

export const prerender = false;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', active: 'Active', inactive: 'Inactive', archived: 'Archived',
};

type Row = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  occupation: string | null;
  interests: string | null;
  availability: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

export const GET: APIRoute = async (context) => {
  const { type } = context.params;
  if (type !== 'csv' && type !== 'xlsx') return new Response('Bad format', { status: 400 });

  const supabase = createSupabaseServerClient(context);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data } = await supabase
    .from('volunteers')
    .select('*')
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as Row[];
  const ts = new Date().toISOString().slice(0, 10);
  const filename = `SPMH-Volunteers-${ts}.${type === 'csv' ? 'csv' : 'xlsx'}`;

  if (type === 'csv') {
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Location', 'Occupation', 'Interests', 'Availability', 'Message', 'Status', 'Joined'];
    const lines = [headers.map(csvCell).join(',')];
    for (const r of rows) {
      lines.push([
        r.first_name, r.last_name, r.email ?? '', r.phone ?? '', r.location ?? '',
        r.occupation ?? '', r.interests ?? '', r.availability ?? '', r.message ?? '',
        STATUS_LABEL[r.status] ?? r.status,
        new Date(r.created_at).toLocaleDateString('en-KE'),
      ].map(csvCell).join(','));
    }
    return new Response('\uFEFF' + lines.join('\r\n'), {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Volunteers', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'First Name', key: 'first_name', width: 18 },
    { header: 'Last Name', key: 'last_name', width: 18 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'Occupation', key: 'occupation', width: 22 },
    { header: 'Interests', key: 'interests', width: 32 },
    { header: 'Availability', key: 'availability', width: 24 },
    { header: 'Message', key: 'message', width: 50 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Joined', key: 'joined', width: 14 },
  ];
  const headRow = ws.getRow(1);
  headRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF860F0F' } };
  headRow.height = 22;
  for (const r of rows) {
    ws.addRow({
      first_name: r.first_name, last_name: r.last_name,
      email: r.email ?? '', phone: r.phone ?? '', location: r.location ?? '',
      occupation: r.occupation ?? '',
      interests: r.interests ?? '', availability: r.availability ?? '', message: r.message ?? '',
      status: STATUS_LABEL[r.status] ?? r.status,
      joined: new Date(r.created_at).toLocaleDateString('en-KE'),
    });
  }
  ws.eachRow((row, i) => {
    if (i > 1 && i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F6F2' } };
    row.alignment = { vertical: 'top', wrapText: i === 1 ? false : true };
  });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
};

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}