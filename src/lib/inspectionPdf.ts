import jsPDF from 'jspdf';
import {
  addBlackHeader,
  addFooter,
  addSectionTitle,
  addInfoTableRow,
  addSummaryBox,
  drawItemTableHeader,
  drawItemTableRow,
  drawStatusPill,
  statusColor,
  checkPageBreak,
  GOLD,
  BLACK,
  DARK_TEXT,
  MUTED,
  ORANGE,
  WHITE,
  ALT_ROW,
  MARGIN_X,
  CONTENT_W,
  PAGE_W,
  HEADER_H,
  type ItemColumn,
} from './pdfHelpers';

interface InspectionData {
  inspection: any;
  items: any[];
  photos: any[];
  clients: Record<string, string>;
  properties: Record<string, string>;
}

const ITEM_COLUMNS: ItemColumn[] = [
  { key: 'name', label: 'Item', x: MARGIN_X + 3, align: 'left' },
  { key: 'status', label: 'Status', x: MARGIN_X + 95, align: 'left' },
  { key: 'qty', label: 'Qty', x: MARGIN_X + 130, align: 'center' },
  { key: 'unit', label: 'Unit Price', x: MARGIN_X + 155, align: 'right' },
  { key: 'total', label: 'Total', x: MARGIN_X + CONTENT_W - 3, align: 'right' },
];

function statusLabel(s: string): string {
  if (s === 'good') return 'Good';
  if (s === 'urgent') return 'Urgent';
  return 'Needs Repair';
}

export function generateFiveServPdf(data: InspectionData): jsPDF {
  const { inspection, items, photos, clients, properties } = data;
  const doc = new jsPDF();

  const propertyName = inspection.property_id ? properties[inspection.property_id] ?? '—' : '—';
  addBlackHeader(doc, { propertyName, docType: `${inspection.ins_number ?? 'No INS#'} · Internal Report` });

  let y = HEADER_H + 8;

  // Info section
  y = addSectionTitle(doc, y, 'Inspection Details');
  y = addInfoTableRow(doc, y, 'INS Number', inspection.ins_number ?? '—');
  y = addInfoTableRow(doc, y, 'Property', propertyName);
  y = addInfoTableRow(doc, y, 'Client / PM', inspection.client_id ? clients[inspection.client_id] ?? '—' : '—');
  y = addInfoTableRow(doc, y, 'Visit Date', inspection.visit_date ?? '—');
  y = addInfoTableRow(doc, y, 'Status', inspection.status ?? '—');
  y = addInfoTableRow(doc, y, 'Configuration',
    `${inspection.bedrooms ?? 0}BR · ${inspection.bathrooms ?? 0}BA · ${inspection.living_rooms ?? 0}LR` +
    (inspection.has_garage ? ' · Garage' : '') +
    (inspection.has_laundry ? ' · Laundry' : '') +
    (inspection.has_exterior ? ' · Exterior' : '')
  );
  y += 5;

  // Group items and photos by area
  const itemsByArea: Record<string, any[]> = {};
  items.forEach(i => {
    const area = i.area ?? 'other';
    if (!itemsByArea[area]) itemsByArea[area] = [];
    itemsByArea[area].push(i);
  });
  const photosByArea: Record<string, any[]> = {};
  photos.forEach(p => {
    const area = p.area ?? 'other';
    if (!photosByArea[area]) photosByArea[area] = [];
    photosByArea[area].push(p);
  });

  const allAreas = new Set([...Object.keys(itemsByArea), ...Object.keys(photosByArea)]);

  y = addSectionTitle(doc, y, 'Inspection Items');

  let totalItems = 0;
  let totalValue = 0;

  for (const area of allAreas) {
    y = checkPageBreak(doc, y, 24);

    // Area sub-header
    doc.setTextColor(...DARK_TEXT);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(area.replace(/_/g, ' ').toUpperCase(), MARGIN_X + 2, y + 4);
    y += 8;

    // Column headers
    y = drawItemTableHeader(doc, y, ITEM_COLUMNS);

    // Items rows
    const areaItems = itemsByArea[area] ?? [];
    areaItems.forEach((item, idx) => {
      y = checkPageBreak(doc, y, 10);
      const color = statusColor(item.status ?? 'needs_repair');
      const qty = item.quantity ?? 1;
      const unit = item.unit_price ?? 0;
      const price = qty * unit;
      totalItems++;
      totalValue += price;

      const rowH = 8;
      y = drawItemTableRow(doc, y, idx, rowH, (rowY) => {
        // Item name
        doc.setTextColor(...DARK_TEXT);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const nameTrim = doc.splitTextToSize(item.item_name ?? '', 78)[0] ?? '';
        doc.text(nameTrim, MARGIN_X + 3, rowY + 5.2);
        // Status pill
        drawStatusPill(doc, MARGIN_X + 95, rowY + 5.2, statusLabel(item.status ?? 'needs_repair'), color);
        // Qty
        doc.setTextColor(...DARK_TEXT);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(String(qty), MARGIN_X + 130, rowY + 5.2, { align: 'center' });
        // Unit price
        doc.text(`$${unit.toFixed(2)}`, MARGIN_X + 155, rowY + 5.2, { align: 'right' });
        // Total
        doc.setFont('helvetica', 'bold');
        doc.text(`$${price.toFixed(2)}`, MARGIN_X + CONTENT_W - 3, rowY + 5.2, { align: 'right' });
      });

      // Notes (below row)
      if (item.item_note) {
        y = checkPageBreak(doc, y, 6);
        doc.setTextColor(...ORANGE);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        const lines = doc.splitTextToSize(`→ ${item.item_note}`, CONTENT_W - 8);
        doc.text(lines, MARGIN_X + 5, y + 3);
        y += lines.length * 3.5 + 1;
      }
      if (item.note) {
        y = checkPageBreak(doc, y, 6);
        doc.setTextColor(...MUTED);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        const lines = doc.splitTextToSize(`Area note: ${item.note}`, CONTENT_W - 8);
        doc.text(lines, MARGIN_X + 5, y + 3);
        y += lines.length * 3.5 + 1;
      }
    });

    // Photo count line
    const areaPhotos = photosByArea[area] ?? [];
    if (areaPhotos.length > 0) {
      y = checkPageBreak(doc, y, 8);
      doc.setTextColor(...MUTED);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`📷 ${areaPhotos.length} photo${areaPhotos.length > 1 ? 's' : ''} captured for this area`, MARGIN_X + 3, y + 4);
      y += 7;
    }
    y += 4;
  }

  // Summary
  y += 4;
  y = checkPageBreak(doc, y, 30);
  y = addSectionTitle(doc, y, 'Summary');
  // Items count line
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Items: ${totalItems}`, MARGIN_X + 2, y + 4);
  y += 9;
  // Gold-bordered total box
  y = addSummaryBox(doc, y, 18, 'Total Value', `$${totalValue.toFixed(2)}`);

  addFooter(doc);
  return doc;
}

export function generatePmVersionPdf(data: InspectionData): jsPDF {
  const { inspection, items, clients, properties } = data;
  const doc = new jsPDF();

  const propertyName = inspection.property_id ? properties[inspection.property_id] ?? '—' : '—';
  addBlackHeader(doc, { propertyName, docType: `${inspection.ins_number ?? 'No INS#'} · PM Version` });

  let y = HEADER_H + 8;

  y = addSectionTitle(doc, y, 'Inspection Details');
  y = addInfoTableRow(doc, y, 'INS Number', inspection.ins_number ?? '—');
  y = addInfoTableRow(doc, y, 'Property', propertyName);
  y = addInfoTableRow(doc, y, 'Client / PM', inspection.client_id ? clients[inspection.client_id] ?? '—' : '—');
  y = addInfoTableRow(doc, y, 'Visit Date', inspection.visit_date ?? '—');
  y = addInfoTableRow(doc, y, 'Submitted', inspection.pm_submitted_at
    ? new Date(inspection.pm_submitted_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    : '—');
  y += 5;

  const pmSelected = items.filter(i => i.pm_selected);
  y = addSectionTitle(doc, y, `Approved Items (${pmSelected.length})`);

  if (pmSelected.length === 0) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No items were selected by the PM.', MARGIN_X + 2, y + 2);
    y += 10;
  } else {
    // Table header
    y = drawItemTableHeader(doc, y, ITEM_COLUMNS);

    pmSelected.forEach((item, idx) => {
      y = checkPageBreak(doc, y, 10);
      const color = statusColor(item.status ?? 'needs_repair');
      const qty = item.quantity ?? 1;
      const unit = item.unit_price ?? 0;
      const price = qty * unit;

      const rowH = 8;
      y = drawItemTableRow(doc, y, idx, rowH, (rowY) => {
        doc.setTextColor(...DARK_TEXT);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const nameTrim = doc.splitTextToSize(item.item_name ?? '', 78)[0] ?? '';
        doc.text(nameTrim, MARGIN_X + 3, rowY + 5.2);
        drawStatusPill(doc, MARGIN_X + 95, rowY + 5.2, statusLabel(item.status ?? 'needs_repair'), color);
        doc.setTextColor(...DARK_TEXT);
        doc.setFontSize(9);
        doc.text(String(qty), MARGIN_X + 130, rowY + 5.2, { align: 'center' });
        doc.text(`$${unit.toFixed(2)}`, MARGIN_X + 155, rowY + 5.2, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text(`$${price.toFixed(2)}`, MARGIN_X + CONTENT_W - 3, rowY + 5.2, { align: 'right' });
      });

      // Notes
      if (item.item_note) {
        y = checkPageBreak(doc, y, 6);
        doc.setTextColor(...ORANGE);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        const lines = doc.splitTextToSize(`Tech: ${item.item_note}`, CONTENT_W - 8);
        doc.text(lines, MARGIN_X + 5, y + 3);
        y += lines.length * 3.5 + 1;
      }
      if (item.pm_note) {
        y = checkPageBreak(doc, y, 6);
        doc.setTextColor(...MUTED);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        const lines = doc.splitTextToSize(`PM: "${item.pm_note}"`, CONTENT_W - 8);
        doc.text(lines, MARGIN_X + 5, y + 3);
        y += lines.length * 3.5 + 1;
      }
    });
  }

  // Approved total — GREEN grand total
  y += 5;
  y = checkPageBreak(doc, y, 25);
  y = addSummaryBox(doc, y, 20, 'Approved Total', `$${(inspection.pm_total_selected ?? 0).toFixed(2)}`);

  // PM general note
  if (inspection.pm_general_note) {
    y = checkPageBreak(doc, y, 20);
    y = addSectionTitle(doc, y, 'PM General Note');
    doc.setTextColor(...DARK_TEXT);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(`"${inspection.pm_general_note}"`, CONTENT_W - 4);
    doc.text(noteLines, MARGIN_X + 2, y + 2);
    y += noteLines.length * 5 + 5;
  }

  // Signature
  if (inspection.pm_signature_data) {
    y = checkPageBreak(doc, y, 15);
    y = addSectionTitle(doc, y, 'PM Signature');
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Digital signature captured and stored on file.', MARGIN_X + 2, y + 2);
  }

  addFooter(doc);
  return doc;
}

// Re-export helpers for backward compatibility
export { downloadPdf, pdfToBase64 } from './pdfHelpers';
