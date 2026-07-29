import jsPDF from 'jspdf';
import {
  addBlackHeader,
  addFooter,
  addSectionTitle,
  addInfoTableRow,
  checkPageBreak,
  downloadPdf,
  preloadPdfAssets,
  HEADER_H,
  MARGIN_X,
  PAGE_W,
  CONTENT_W,
  DARK_TEXT,
  MUTED,
  BORDER_LIGHT,
} from './pdfHelpers';

interface PropertyReportInput {
  property: {
    address?: string;
    zoneName?: string;
    currentPm?: string;
    previousPm?: string;
    pmChangedAt?: string | null;
  };
  notes?: string | null;
  paintNotes?: string | null;
  tickets: Array<{
    fs_number?: string | null;
    work_type?: string | null;
    status?: string | null;
    date?: string | null;
    summary?: string | null;
  }>;
  inspections: Array<{
    ins_number?: string | null;
    visit_date?: string | null;
    status?: string | null;
  }>;
  gallery: Array<{ file_name: string; created_at: string }>;
  estimates: Array<{ file_name: string; created_at: string }>;
}

function drawParagraph(doc: jsPDF, y: number, text: string, opts: { size?: number } = {}): number {
  const size = opts.size ?? 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...DARK_TEXT);
  const lines = doc.splitTextToSize(text, CONTENT_W - 4);
  for (const line of lines) {
    y = checkPageBreak(doc, y, 6);
    doc.text(line, MARGIN_X + 2, y);
    y += size * 0.5;
  }
  return y + 2;
}

function drawListItem(
  doc: jsPDF,
  y: number,
  title: string,
  meta: string,
  body?: string | null
): number {
  y = checkPageBreak(doc, y, body ? 18 : 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...DARK_TEXT);
  doc.text(title, MARGIN_X + 2, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(meta, PAGE_W - MARGIN_X - 2, y, { align: 'right' });
  y += 4;

  if (body) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK_TEXT);
    const lines = doc.splitTextToSize(body, CONTENT_W - 4);
    for (const line of lines.slice(0, 3)) {
      y = checkPageBreak(doc, y, 5);
      doc.text(line, MARGIN_X + 4, y);
      y += 4;
    }
  }

  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, y + 1, PAGE_W - MARGIN_X, y + 1);
  return y + 5;
}

export async function generatePropertyReportPdf(input: PropertyReportInput): Promise<void> {
  await preloadPdfAssets();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const propertyName = input.property.address || 'Property';

  addBlackHeader(doc, { propertyName, docType: 'Property Report' });
  let y = HEADER_H + 8;

  // 1. Property info
  y = addSectionTitle(doc, y, 'Property Information');
  y = addInfoTableRow(doc, y, 'Address', input.property.address ?? '—');
  y = addInfoTableRow(doc, y, 'Zone', input.property.zoneName ?? '—');
  y = addInfoTableRow(doc, y, 'Current PM', input.property.currentPm ?? '—');
  if (input.property.previousPm) {
    const changed = input.property.pmChangedAt
      ? ` (until ${new Date(input.property.pmChangedAt).toLocaleDateString()})`
      : '';
    y = addInfoTableRow(doc, y, 'Previous PM', `${input.property.previousPm}${changed}`);
  }
  y += 4;

  // 2. Notes + Paint & More
  if (input.notes || input.paintNotes) {
    y = addSectionTitle(doc, y, 'Notes');
    if (input.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      y = checkPageBreak(doc, y, 8);
      doc.text('GENERAL NOTES', MARGIN_X + 2, y);
      y += 4;
      y = drawParagraph(doc, y, input.notes);
    }
    if (input.paintNotes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      y = checkPageBreak(doc, y, 8);
      doc.text('PAINT & MORE', MARGIN_X + 2, y);
      y += 4;
      y = drawParagraph(doc, y, input.paintNotes);
    }
    y += 2;
  }

  // 3. Ticket history
  y = addSectionTitle(doc, y, `Ticket History (${input.tickets.length})`);
  if (input.tickets.length === 0) {
    y = drawParagraph(doc, y, 'No tickets on record.');
  } else {
    for (const t of input.tickets) {
      const title = `${t.fs_number ?? 'Ticket'} — ${t.work_type ?? '—'}`;
      const dateStr = t.date ? new Date(t.date).toLocaleDateString() : '';
      const meta = [dateStr, t.status ?? ''].filter(Boolean).join(' · ');
      y = drawListItem(doc, y, title, meta, t.summary ?? null);
    }
  }
  y += 4;

  // 4. Inspection history
  y = addSectionTitle(doc, y, `Inspection History (${input.inspections.length})`);
  if (input.inspections.length === 0) {
    y = drawParagraph(doc, y, 'No inspections on record.');
  } else {
    for (const ins of input.inspections) {
      const dateStr = ins.visit_date ? new Date(ins.visit_date).toLocaleDateString() : '—';
      const title = `${ins.ins_number ?? 'Inspection'} — ${dateStr}`;
      const meta = ins.status ?? '';
      y = drawListItem(doc, y, title, meta);
    }
  }
  y += 4;

  // 5. Documents index
  y = addSectionTitle(doc, y, 'Documents');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  y = checkPageBreak(doc, y, 8);
  doc.text(`GALLERY (${input.gallery.length})`, MARGIN_X + 2, y);
  y += 4;
  if (input.gallery.length === 0) {
    y = drawParagraph(doc, y, 'No files.', { size: 8.5 });
  } else {
    for (const d of input.gallery) {
      const dateStr = new Date(d.created_at).toLocaleDateString();
      y = drawListItem(doc, y, d.file_name, dateStr);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  y = checkPageBreak(doc, y, 8);
  doc.text(`ESTIMATES & INVOICES (${input.estimates.length})`, MARGIN_X + 2, y);
  y += 4;
  if (input.estimates.length === 0) {
    y = drawParagraph(doc, y, 'No files.', { size: 8.5 });
  } else {
    for (const d of input.estimates) {
      const dateStr = new Date(d.created_at).toLocaleDateString();
      y = drawListItem(doc, y, d.file_name, dateStr);
    }
  }

  addFooter(doc);
  const safeName = propertyName.replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
  downloadPdf(doc, `Property_Report_${safeName}.pdf`);
}
