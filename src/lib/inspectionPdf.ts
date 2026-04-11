import jsPDF from 'jspdf';

interface InspectionData {
  inspection: any;
  items: any[];
  photos: any[];
  clients: Record<string, string>;
  properties: Record<string, string>;
}

const GOLD: [number, number, number] = [255, 215, 0];
const BLACK: [number, number, number] = [0, 0, 0];
const DARK_TEXT: [number, number, number] = [33, 33, 33];
const MUTED: [number, number, number] = [120, 120, 120];
const LIGHT_BG: [number, number, number] = [245, 245, 245];
const GREEN: [number, number, number] = [34, 150, 70];
const RED: [number, number, number] = [200, 40, 40];
const ORANGE: [number, number, number] = [210, 100, 20];
const WHITE: [number, number, number] = [255, 255, 255];

function addHeader(doc: jsPDF, subtitle: string) {
  // White header with gold accent line
  doc.setFillColor(...WHITE);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 34, 210, 2, 'F');

  // FiveServ wordmark: "F" in gold, "iveServ" in black
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('F', 15, 18);
  const fWidth = doc.getTextWidth('F');
  doc.setTextColor(...BLACK);
  doc.text('iveServ', 15 + fWidth, 18);

  // Subtitle
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 15, 27);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Tagline footer
    doc.setFillColor(...GOLD);
    doc.rect(0, 286, 210, 0.5, 'F');
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text('One Team. One Call. Done.', 15, 292);
    doc.text(`Page ${i} of ${pageCount}`, 180, 292);
  }
}

function addSectionTitle(doc: jsPDF, y: number, text: string): number {
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFillColor(...GOLD);
  doc.rect(15, y, 3, 8, 'F');
  doc.setTextColor(...DARK_TEXT);
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
  doc.setTextColor(...DARK_TEXT);
  doc.setFontSize(10);
  doc.text(value || '—', 65, y);
  return y + 7;
}

function statusColor(status: string): [number, number, number] {
  if (status === 'good') return GREEN;
  if (status === 'urgent') return RED;
  return ORANGE;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number = 20): number {
  if (y + needed > 280) { doc.addPage(); return 20; }
  return y;
}

export function generateFiveServPdf(data: InspectionData): jsPDF {
  const { inspection, items, photos, clients, properties } = data;
  const doc = new jsPDF();

  addHeader(doc, `${inspection.ins_number ?? 'No INS#'} — Full Internal Report`);

  let y = 44;

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

  // All areas
  const allAreas = new Set([...Object.keys(itemsByArea), ...Object.keys(photosByArea)]);

  y = addSectionTitle(doc, y, 'Inspection Items');

  let totalItems = 0;
  let totalValue = 0;

  for (const area of allAreas) {
    y = checkPageBreak(doc, y, 20);

    // Area header
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(15, y, 180, 8, 2, 2, 'F');
    doc.setTextColor(...GOLD);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(area.replace(/_/g, ' ').toUpperCase(), 20, y + 6);
    y += 12;

    // Items for this area
    const areaItems = itemsByArea[area] ?? [];
    for (const item of areaItems) {
      y = checkPageBreak(doc, y, 12);

      const color = statusColor(item.status ?? 'needs_repair');
      const price = (item.quantity ?? 1) * (item.unit_price ?? 0);
      totalItems++;
      totalValue += price;

      doc.setFillColor(...color);
      doc.circle(20, y - 1, 1.5, 'F');

      doc.setTextColor(...DARK_TEXT);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(item.item_name ?? '', 25, y);

      doc.setTextColor(...color);
      doc.setFontSize(8);
      const statusText = item.status === 'good' ? 'Good' : item.status === 'urgent' ? 'Urgent' : 'Needs Repair';
      doc.text(statusText, 130, y);

      doc.setTextColor(...DARK_TEXT);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${price.toFixed(2)}`, 170, y);

      y += 5;

      if (item.note) {
        y = checkPageBreak(doc, y, 8);
        doc.setTextColor(...MUTED);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        const noteLines = doc.splitTextToSize(`Note: ${item.note}`, 160);
        doc.text(noteLines, 25, y);
        y += noteLines.length * 4;
      }
      y += 2;
    }

    // Photos for this area (as placeholders — we can't fetch images into jsPDF client-side easily)
    const areaPhotos = photosByArea[area] ?? [];
    if (areaPhotos.length > 0) {
      y = checkPageBreak(doc, y, 10);
      doc.setTextColor(...MUTED);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`📷 ${areaPhotos.length} photo${areaPhotos.length > 1 ? 's' : ''} captured for this area`, 25, y);
      y += 6;
    }

    y += 3;
  }

  // Summary
  y += 5;
  y = checkPageBreak(doc, y, 30);
  y = addSectionTitle(doc, y, 'Summary');
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(15, y, 180, 20, 3, 3, 'F');
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text('Total Items:', 20, y + 8);
  doc.setTextColor(...DARK_TEXT);
  doc.text(String(totalItems), 55, y + 8);
  doc.setTextColor(...MUTED);
  doc.text('Total Value:', 20, y + 16);
  doc.setTextColor(...GOLD);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${totalValue.toFixed(2)}`, 55, y + 16);

  addFooter(doc);
  return doc;
}

export function generatePmVersionPdf(data: InspectionData): jsPDF {
  const { inspection, items, clients, properties } = data;
  const doc = new jsPDF();

  addHeader(doc, `${inspection.ins_number ?? 'No INS#'} — Property Manager Version`);

  let y = 44;

  y = addSectionTitle(doc, y, 'Inspection Details');
  y = addInfoRow(doc, y, 'INS Number', inspection.ins_number ?? '—');
  y = addInfoRow(doc, y, 'Property', inspection.property_id ? properties[inspection.property_id] ?? '—' : '—');
  y = addInfoRow(doc, y, 'Client / PM', inspection.client_id ? clients[inspection.client_id] ?? '—' : '—');
  y = addInfoRow(doc, y, 'Visit Date', inspection.visit_date ?? '—');
  y = addInfoRow(doc, y, 'Submitted', inspection.pm_submitted_at
    ? new Date(inspection.pm_submitted_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    : '—');
  y += 5;

  const pmSelected = items.filter(i => i.pm_selected);
  y = addSectionTitle(doc, y, `Approved Items (${pmSelected.length})`);

  if (pmSelected.length === 0) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(10);
    doc.text('No items were selected by the PM.', 20, y);
    y += 10;
  } else {
    for (const item of pmSelected) {
      const noteHeight = item.pm_note ? 18 : 12;
      y = checkPageBreak(doc, y, noteHeight + 4);

      const price = (item.quantity ?? 1) * (item.unit_price ?? 0);
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(15, y, 180, noteHeight, 2, 2, 'F');

      doc.setTextColor(...DARK_TEXT);
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

      y += noteHeight + 4;
    }
  }

  // Approved total
  y += 5;
  y = checkPageBreak(doc, y, 25);
  y = addSectionTitle(doc, y, 'Approved Total');
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(15, y, 180, 14, 3, 3, 'F');
  doc.setTextColor(...GOLD);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${(inspection.pm_total_selected ?? 0).toFixed(2)}`, 20, y + 10);
  y += 20;

  // PM general note
  if (inspection.pm_general_note) {
    y = checkPageBreak(doc, y, 20);
    y = addSectionTitle(doc, y, 'PM General Note');
    doc.setTextColor(...DARK_TEXT);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(`"${inspection.pm_general_note}"`, 170);
    doc.text(noteLines, 20, y);
    y += noteLines.length * 5 + 5;
  }

  // Signature
  if (inspection.pm_signature_data) {
    y = checkPageBreak(doc, y, 15);
    y = addSectionTitle(doc, y, 'PM Signature');
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.text('Digital signature captured and stored on file.', 20, y);
  }

  addFooter(doc);
  return doc;
}

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function pdfToBase64(doc: jsPDF): string {
  return doc.output('datauristring').split(',')[1];
}
