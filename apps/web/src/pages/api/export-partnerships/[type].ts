import type { APIRoute } from 'astro';
import ExcelJS from 'exceljs';
import { createSupabaseServerClient } from '../../../lib/supabase-ssr';

export const prerender = false;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', reviewing: 'Reviewing', approved: 'Approved', rejected: 'Rejected', archived: 'Archived',
};

type Row = {
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
    .from('partnerships')
    .select('*')
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as Row[];
  const ts = new Date().toISOString().slice(0, 10);
  const filename = `SPMH-Partnerships-${ts}.${type === 'csv' ? 'csv' : 'xlsx'}`;

  if (type === 'csv') {
    const headers = ['Organisation', 'Type', 'Country', 'Website', 'Contact Name', 'Contact Role', 'Contact Email', 'Contact Phone', 'Collaboration Areas', 'Proposal', 'Status', 'Submitted'];
    const lines = [headers.map(csvCell).join(',')];
    for (const r of rows) {
      lines.push([
        r.org_name, r.org_type ?? '', r.country ?? '', r.website ?? '',
        r.contact_name, r.contact_role ?? '',
        r.contact_email, r.contact_phone ?? '', r.collaboration_areas ?? '', r.proposal ?? '',
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
  const ws = wb.addWorksheet('Partnerships', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Organisation', key: 'org_name', width: 28 },
    { header: 'Type', key: 'org_type', width: 22 },
    { header: 'Country', key: 'country', width: 16 },
    { header: 'Website', key: 'website', width: 32 },
    { header: 'Contact Name', key: 'contact_name', width: 22 },
    { header: 'Contact Role', key: 'contact_role', width: 20 },
    { header: 'Contact Email', key: 'contact_email', width: 28 },
    { header: 'Contact Phone', key: 'contact_phone', width: 18 },
    { header: 'Collaboration Areas', key: 'collaboration_areas', width: 30 },
    { header: 'Proposal', key: 'proposal', width: 60 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Submitted', key: 'submitted', width: 14 },
  ];
  const headRow = ws.getRow(1);
  headRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF860F0F' } };
  headRow.height = 22;
  for (const r of rows) {
    ws.addRow({
      org_name: r.org_name, org_type: r.org_type ?? '', country: r.country ?? '',
      website: r.website ?? '',
      contact_name: r.contact_name, contact_role: r.contact_role ?? '',
      contact_email: r.contact_email, contact_phone: r.contact_phone ?? '',
      collaboration_areas: r.collaboration_areas ?? '', proposal: r.proposal ?? '',
      status: STATUS_LABEL[r.status] ?? r.status,
      submitted: new Date(r.created_at).toLocaleDateString('en-KE'),
    });
  }
  ws.eachRow((row, i) => {
    if (i > 1 && i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F6F2' } };
    row.alignment = { vertical: 'top', wrapText: i === 1 ? false : true };
  });
  const buf = await ws.xlsx.writeBuffer();
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