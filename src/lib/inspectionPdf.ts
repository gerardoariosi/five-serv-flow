import jsPDF from 'jspdf';

interface InspectionData {
  inspection: any;
  items: any[];
  photos: any[];
  clients: Record<string, string>;
  properties: Record<string, string>;
}

const GOLD = [255, 215, 0] as const;
const DARK_BG = [26, 26, 26] as const;
const CARD_BG = [38, 38, 38] as const;
const WHITE = [255, 255, 255] as const;
const MUTED = [160, 160, 160] as const;
const GREEN = [34, 197, 94] as const;
const RED = [239, 68, 68] as const;
const ORANGE = [249, 115, 22] as const;

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 38, 210, 2, 'F');

  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 15, 18);

  doc.setTextColor(...MUTED);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 15, 28);
}

function addSectionTitle(doc: jsPDF, y: number, text: string): number {
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFillColor(...GOLD);
  doc.rect(15, y, 3, 8, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(text, 22, y + 6);
  return y + 14;
}

function addInfoRow(doc: jsPDF, y: number, label: string, value: string): number {
  if (y > 270) { doc.addPage(); y = 20; }
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(label, 20, y);
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.text(value || '—', 65, y);
  return y + 7;
}

function statusColor(status: string): readonly [number, number, number] {
  if (status === 'good') return GREEN;
  if (status === 'urgent') return RED;
  return ORANGE;
}

function addPageBackground(doc: jsPDF) {
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, 210, 297, 'F');
}

export function generateFiveServPdf(data: InspectionData): jsPDF {
  const { inspection, items, clients, properties } = data;
  const doc = new jsPDF();

  // Page 1 background
  addPageBackground(doc);
  addHeader(doc, 'FiveServ Inspection Report', `${inspection.ins_number ?? 'No INS#'} — Full Internal Report`);

  let y = 50;

  // Info section
  y = addSectionTitle(doc, y, 'Inspection Details');
  y = addInfoRow(doc, y, 'INS Number', inspection.ins_number ?? '—');
  y = addInfoRow(doc, y, 'Property', inspection.property_id ? properties[inspection.property_id] ?? '—' : '—');
  y = addInfoRow(doc, y, 'Client / PM', inspection.client_id ? clients[inspection.client_id] ?? '—' : '—');
  y = addInfoRow(doc, y, 'Visit Date', inspection.visit_date ?? '—');
  y = addInfoRow(doc, y, 'Status', inspection.status ?? '—');
  y = addInfoRow(doc, y, 'Configuration',
    `${inspection.bedrooms ?? 0}BR · ${inspection.bathrooms ?? 0}BA · ${inspection.living_rooms ?? 0}LR` +
    (inspection.has_garage ? ' · Garage' : '') +
    (inspection.has_laundry ? ' · Laundry' : '') +
    (inspection.has_exterior ? ' · Exterior' : '')
  );
  y += 5;

  // Group items by area
  const itemsByArea: Record<string, any[]> = {};
  items.forEach(i => {
    const area = i.area ?? 'other';
    if (!itemsByArea[area]) itemsByArea[area] = [];
    itemsByArea[area].push(i);
  });

  // Items section
  y = addSectionTitle(doc, y, 'Inspection Items');

  let totalItems = 0;
  let totalValue = 0;

  for (const [area, areaItems] of Object.entries(itemsByArea)) {
    if (y > 250) { doc.addPage(); addPageBackground(doc); y = 20; }

    // Area header
    doc.setFillColor(...CARD_BG);
    doc.roundedRect(15, y, 180, 8, 2, 2, 'F');
    doc.setTextColor(...GOLD);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(area.replace(/_/g, ' ').toUpperCase(), 20, y + 6);
    y += 12;

    for (const item of areaItems) {
      if (y > 270) { doc.addPage(); addPageBackground(doc); y = 20; }

      const color = statusColor(item.status ?? 'needs_repair');
      const price = (item.quantity ?? 1) * (item.unit_price ?? 0);
      totalItems++;
      totalValue += price;

      // Item row
      doc.setFillColor(color[0], color[1], color[2]);
      doc.circle(20, y - 1, 1.5, 'F');

      doc.setTextColor(...WHITE);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(item.item_name ?? '', 25, y);

      // Status
      doc.setTextColor(color[0], color[1], color[2]);
      doc.setFontSize(8);
      const statusText = item.status === 'good' ? 'Good' : item.status === 'urgent' ? 'Urgent' : 'Needs Repair';
      doc.text(statusText, 130, y);

      // Price
      doc.setTextColor(...GOLD);
      doc.setFontSize(9);
      doc.text(`$${price.toFixed(2)}`, 170, y);

      y += 5;

      // Note
      if (item.note) {
        if (y > 270) { doc.addPage(); addPageBackground(doc); y = 20; }
        doc.setTextColor(...MUTED);
        doc.setFontSize(7);
        const noteLines = doc.splitTextToSize(`Note: ${item.note}`, 160);
        doc.text(noteLines, 25, y);
        y += noteLines.length * 4;
      }
      y += 2;
    }
    y += 3;
  }

  // Summary
  y += 5;
  if (y > 250) { doc.addPage(); addPageBackground(doc); y = 20; }
  y = addSectionTitle(doc, y, 'Summary');
  doc.setFillColor(...CARD_BG);
  doc.roundedRect(15, y, 180, 20, 3, 3, 'F');
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text('Total Items:', 20, y + 8);
  doc.setTextColor(...WHITE);
  doc.text(String(totalItems), 55, y + 8);
  doc.setTextColor(...MUTED);
  doc.text('Total Value:', 20, y + 16);
  doc.setTextColor(...GOLD);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${totalValue.toFixed(2)}`, 55, y + 16);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (i > 1) addPageBackground(doc);
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(`FiveServ Operations Hub — Generated ${new Date().toLocaleDateString('en-US')}`, 15, 290);
    doc.text(`Page ${i} of ${pageCount}`, 175, 290);
  }

  return doc;
}

export function generatePmVersionPdf(data: InspectionData): jsPDF {
  const { inspection, items, clients, properties } = data;
  const doc = new jsPDF();

  addPageBackground(doc);
  addHeader(doc, 'PM Inspection Report', `${inspection.ins_number ?? 'No INS#'} — Property Manager Version`);

  let y = 50;

  // Info
  y = addSectionTitle(doc, y, 'Inspection Details');
  y = addInfoRow(doc, y, 'INS Number', inspection.ins_number ?? '—');
  y = addInfoRow(doc, y, 'Property', inspection.property_id ? properties[inspection.property_id] ?? '—' : '—');
  y = addInfoRow(doc, y, 'Client / PM', inspection.client_id ? clients[inspection.client_id] ?? '—' : '—');
  y = addInfoRow(doc, y, 'Visit Date', inspection.visit_date ?? '—');
  y = addInfoRow(doc, y, 'Submitted', inspection.pm_submitted_at
    ? new Date(inspection.pm_submitted_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    : '—');
  y += 5;

  // PM selected items only
  const pmSelected = items.filter(i => i.pm_selected);

  y = addSectionTitle(doc, y, `Approved Items (${pmSelected.length})`);

  if (pmSelected.length === 0) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(10);
    doc.text('No items were selected by the PM.', 20, y);
    y += 10;
  } else {
    for (const item of pmSelected) {
      if (y > 260) { doc.addPage(); addPageBackground(doc); y = 20; }

      const price = (item.quantity ?? 1) * (item.unit_price ?? 0);

      doc.setFillColor(...CARD_BG);
      doc.roundedRect(15, y, 180, item.pm_note ? 18 : 12, 2, 2, 'F');

      doc.setTextColor(...WHITE);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(item.item_name ?? '', 20, y + 7);

      doc.setTextColor(...GOLD);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${price.toFixed(2)}`, 170, y + 7);

      if (item.pm_note) {
        doc.setTextColor(...MUTED);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        const noteLines = doc.splitTextToSize(`"${item.pm_note}"`, 160);
        doc.text(noteLines, 20, y + 14);
      }

      y += item.pm_note ? 22 : 16;
    }
  }

  // Approved total
  y += 5;
  if (y > 260) { doc.addPage(); addPageBackground(doc); y = 20; }
  y = addSectionTitle(doc, y, 'Approved Total');
  doc.setFillColor(...CARD_BG);
  doc.roundedRect(15, y, 180, 14, 3, 3, 'F');
  doc.setTextColor(...GOLD);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${(inspection.pm_total_selected ?? 0).toFixed(2)}`, 20, y + 10);
  y += 20;

  // PM general note
  if (inspection.pm_general_note) {
    if (y > 250) { doc.addPage(); addPageBackground(doc); y = 20; }
    y = addSectionTitle(doc, y, 'PM General Note');
    doc.setTextColor(...WHITE);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(`"${inspection.pm_general_note}"`, 170);
    doc.text(noteLines, 20, y);
    y += noteLines.length * 5 + 5;
  }

  // Signature placeholder
  if (inspection.pm_signature_data) {
    if (y > 250) { doc.addPage(); addPageBackground(doc); y = 20; }
    y = addSectionTitle(doc, y, 'PM Signature');
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.text('Digital signature captured and stored on file.', 20, y);
    y += 10;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (i > 1) addPageBackground(doc);
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(`FiveServ Operations Hub — PM Report — Generated ${new Date().toLocaleDateString('en-US')}`, 15, 290);
    doc.text(`Page ${i} of ${pageCount}`, 175, 290);
  }

  return doc;
}

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function pdfToBase64(doc: jsPDF): string {
  return doc.output('datauristring').split(',')[1];
}
