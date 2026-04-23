import jsPDF from 'jspdf';
import {
  addBlackHeader,
  addFooter,
  addSectionTitle,
  addInfoTableRow,
  addSummaryBox,
  checkPageBreak,
  drawStatusPill,
  statusColor,
  MARGIN_X,
  CONTENT_W,
  PAGE_W,
  HEADER_H,
  DARK_TEXT,
  MUTED,
  GOLD,
  WHITE,
  ALT_ROW,
} from './pdfHelpers';
import { format } from 'date-fns';

interface TicketAccountingData {
  ticket: any;
  photos: any[];
  technicianName?: string | null;
  approverName?: string | null;
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateTicketAccountingPdf(data: TicketAccountingData): Promise<jsPDF> {
  const { ticket, photos, technicianName, approverName } = data;
  const doc = new jsPDF();

  const propertyName =
    (ticket.properties as any)?.name ||
    (ticket.properties as any)?.address ||
    '—';
  addBlackHeader(doc, {
    propertyName,
    docType: `${ticket.fs_number ?? 'Ticket'} · Billing Report`,
  });

  let y = HEADER_H + 8;

  // Ticket Info
  y = addSectionTitle(doc, y, 'Ticket Information');
  y = addInfoTableRow(doc, y, 'FS Number', ticket.fs_number ?? '—');
  y = addInfoTableRow(doc, y, 'Property Manager', (ticket.clients as any)?.company_name ?? '—');
  y = addInfoTableRow(doc, y, 'Property', propertyName);
  y = addInfoTableRow(doc, y, 'Unit', ticket.unit ?? '—');
  y = addInfoTableRow(doc, y, 'Work Type', ticket.work_type ?? '—');
  y = addInfoTableRow(doc, y, 'Status', ticket.status ?? '—');
  y = addInfoTableRow(doc, y, 'Technician', technicianName ?? '—');
  y = addInfoTableRow(doc, y, 'Approved By', approverName ?? '—');
  if (ticket.description) {
    y = addInfoTableRow(doc, y, 'Description', ticket.description);
  }
  y += 4;

  // Timestamps
  y = addSectionTitle(doc, y, 'Timestamps');
  const fmt = (d: string | null) => (d ? format(new Date(d), 'MMM d, yyyy h:mm a') : '—');
  y = addInfoTableRow(doc, y, 'Created', fmt(ticket.created_at));
  y = addInfoTableRow(doc, y, 'Appointment', fmt(ticket.appointment_time));
  y = addInfoTableRow(doc, y, 'Work Started', fmt(ticket.work_started_at));
  y = addInfoTableRow(doc, y, 'Closed', fmt(ticket.closed_at));
  y += 4;

  // Photos by stage
  const stages: Array<'start' | 'process' | 'close'> = ['start', 'process', 'close'];
  for (const stage of stages) {
    const stagePhotos = photos.filter((p) => p.stage === stage);
    if (stagePhotos.length === 0) continue;

    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, y, `${stage} Photos`);

    const cols = 2;
    const photoW = (CONTENT_W - 6) / cols;
    const photoH = 50;

    let col = 0;
    for (const p of stagePhotos) {
      if (!p.url) continue;
      const dataUrl = await loadImageAsDataUrl(p.url);
      if (!dataUrl) continue;

      const x = MARGIN_X + col * (photoW + 6);
      if (col === 0) {
        y = checkPageBreak(doc, y, photoH + 6);
      }
      try {
        doc.addImage(dataUrl, 'JPEG', x, y, photoW, photoH);
      } catch {
        // skip on decode error
      }
      col++;
      if (col >= cols) {
        col = 0;
        y += photoH + 4;
      }
    }
    if (col > 0) y += photoH + 4;
    y += 2;
  }

  // Billing summary box
  y = checkPageBreak(doc, y, 40);
  y = addSectionTitle(doc, y, 'Billing');
  y = addInfoTableRow(doc, y, 'Billing Status', ticket.billing_status ?? 'pending');
  y = addInfoTableRow(doc, y, 'QB Invoice #', ticket.qb_invoice_number ?? '—');
  if (ticket.accounting_notes) {
    y = addInfoTableRow(doc, y, 'Notes', ticket.accounting_notes);
  }
  y += 4;

  addFooter(doc);
  return doc;
}
