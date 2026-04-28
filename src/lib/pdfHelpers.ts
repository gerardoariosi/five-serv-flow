import jsPDF from 'jspdf';

// ============= Brand color constants =============
export const GOLD: [number, number, number] = [255, 215, 0];
export const BLACK: [number, number, number] = [26, 26, 26];
export const PURE_BLACK: [number, number, number] = [0, 0, 0];
export const DARK_TEXT: [number, number, number] = [33, 33, 33];
export const MUTED: [number, number, number] = [120, 120, 120];
export const LIGHT_GRAY: [number, number, number] = [229, 229, 229];
export const ALT_ROW: [number, number, number] = [252, 252, 252];
export const GREEN: [number, number, number] = [34, 150, 70];
export const RED: [number, number, number] = [200, 40, 40];
export const ORANGE: [number, number, number] = [210, 100, 20];
export const WHITE: [number, number, number] = [255, 255, 255];
export const BORDER_LIGHT: [number, number, number] = [235, 235, 235];

// Page constants
export const PAGE_W = 210;
export const PAGE_H = 297;
export const MARGIN_X = 15;
export const CONTENT_W = PAGE_W - MARGIN_X * 2;
export const HEADER_H = 45;
export const FOOTER_Y = 286;

export interface HeaderOpts {
  propertyName?: string;
  docType?: string;
}

// ============= Logo loader (cached) =============
let logoDataUrlCache: string | null | undefined;
async function loadLogoDataUrl(): Promise<string | null> {
  if (logoDataUrlCache !== undefined) return logoDataUrlCache;
  try {
    const res = await fetch('/FiveServ_Logo_2_No_BG.png');
    if (!res.ok) throw new Error('logo fetch failed');
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    logoDataUrlCache = dataUrl;
    return dataUrl;
  } catch {
    logoDataUrlCache = null;
    return null;
  }
}

// Pre-warm the logo cache so synchronous addBlackHeader can use it
export async function preloadPdfAssets(): Promise<void> {
  await loadLogoDataUrl();
}

// Auto-preload on module load (browser only)
if (typeof window !== 'undefined') {
  void loadLogoDataUrl();
}

// ============= Black header with gold accent =============
export function addBlackHeader(doc: jsPDF, opts: HeaderOpts = {}) {
  // Black background
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, PAGE_W, HEADER_H, 'F');

  // Try image logo first (must be preloaded via preloadPdfAssets)
  const logo = logoDataUrlCache;
  if (logo) {
    try {
      // Logo height ~14mm, preserves aspect via auto width
      doc.addImage(logo, 'PNG', MARGIN_X, 10, 0, 14);
    } catch {
      // fallback to text wordmark
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GOLD);
      doc.text('F', MARGIN_X, 24);
      const fWidth = doc.getTextWidth('F');
      doc.setTextColor(...WHITE);
      doc.text('iveServ', MARGIN_X + fWidth, 24);
    }
  } else {
    // Fallback wordmark
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text('F', MARGIN_X, 24);
    const fWidth = doc.getTextWidth('F');
    doc.setTextColor(...WHITE);
    doc.text('iveServ', MARGIN_X + fWidth, 24);
  }

  // Tagline below wordmark
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GOLD);
  doc.text('ONE TEAM. ONE CALL. DONE.', MARGIN_X, 33);

  // Right-aligned: property name (top) + docType (bottom)
  if (opts.propertyName || opts.docType) {
    doc.setTextColor(...WHITE);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    if (opts.propertyName) {
      const txt = opts.propertyName;
      doc.text(txt, PAGE_W - MARGIN_X, 20, { align: 'right' });
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(220, 220, 220);
    if (opts.docType) {
      doc.text(opts.docType, PAGE_W - MARGIN_X, 29, { align: 'right' });
    }
  }

  // Gold 2px line at bottom of header
  doc.setFillColor(...GOLD);
  doc.rect(0, HEADER_H, PAGE_W, 2, 'F');
}

// ============= Footer =============
export function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Gold separator line — full width
    doc.setFillColor(...GOLD);
    doc.rect(0, FOOTER_Y, PAGE_W, 0.5, 'F');

    // Left: tagline
    doc.setTextColor(...DARK_TEXT);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('One Team. One Call. Done.', MARGIN_X, FOOTER_Y + 5);

    // Center: contact line
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(
      'FiveServ Property Solutions LLC  ·  info@fiveserv.net  ·  (407) 881-4942',
      PAGE_W / 2,
      FOOTER_Y + 5,
      { align: 'center' }
    );

    // Right: Confidential (italic) + page number on next line
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...MUTED);
    doc.text('Confidential', PAGE_W - MARGIN_X, FOOTER_Y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN_X, FOOTER_Y + 9, { align: 'right' });
  }
}

// ============= Section title (gold left border + uppercase + separator) =============
export function addSectionTitle(doc: jsPDF, y: number, text: string): number {
  if (y > 260) { doc.addPage(); y = HEADER_H + 8; }
  // Gold 3px left border
  doc.setFillColor(...GOLD);
  doc.rect(MARGIN_X, y, 3, 8, 'F');
  // Uppercase bold title
  doc.setTextColor(...DARK_TEXT);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(text.toUpperCase(), MARGIN_X + 6, y + 6);
  // Light separator line under title
  doc.setDrawColor(240, 240, 240);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, y + 11, PAGE_W - MARGIN_X, y + 11);
  return y + 18;
}

// ============= Two-column info row =============
export function addInfoTableRow(doc: jsPDF, y: number, label: string, value: string): number {
  if (y > 270) { doc.addPage(); y = HEADER_H + 8; }
  // Label in gray
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(label.toUpperCase(), MARGIN_X + 2, y);
  // Value in dark
  doc.setTextColor(...DARK_TEXT);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(value || '—', MARGIN_X + 55, y);
  // Thin separator
  doc.setDrawColor(235, 235, 235);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, y + 2.5, PAGE_W - MARGIN_X, y + 2.5);
  return y + 8;
}

// ============= Status pill =============
export function statusColor(status: string): [number, number, number] {
  if (status === 'good') return GREEN;
  if (status === 'urgent') return RED;
  if (status === 'paid' || status === 'closed') return GREEN;
  if (status === 'invoiced') return ORANGE;
  return ORANGE;
}

export function drawStatusPill(doc: jsPDF, x: number, y: number, label: string, color: [number, number, number]) {
  const w = doc.getTextWidth(label) + 6;
  doc.setFillColor(...color);
  doc.roundedRect(x, y - 3.5, w, 5, 1.2, 1.2, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(label, x + 3, y);
}

// ============= Item table header =============
export interface ItemColumn {
  key: string;
  label: string;
  x: number;
  align?: 'left' | 'right' | 'center';
}

export function drawItemTableHeader(doc: jsPDF, y: number, columns: ItemColumn[]): number {
  // Light gray header background
  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN_X, y, CONTENT_W, 7, 'F');
  // Gold bottom border
  doc.setFillColor(...GOLD);
  doc.rect(MARGIN_X, y + 7, CONTENT_W, 0.6, 'F');
  // Dark gray text
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  for (const col of columns) {
    doc.text(col.label.toUpperCase(), col.x, y + 4.7, { align: col.align ?? 'left' });
  }
  return y + 9;
}

// ============= Item table row with alternating bg =============
export function drawItemTableRow(
  doc: jsPDF,
  y: number,
  rowIndex: number,
  height: number,
  draw: (yOffset: number) => void
): number {
  // Alternating row bg
  if (rowIndex % 2 === 0) {
    doc.setFillColor(...ALT_ROW);
  } else {
    doc.setFillColor(...WHITE);
  }
  doc.rect(MARGIN_X, y, CONTENT_W, height, 'F');
  draw(y);
  return y + height;
}

// ============= Summary box (white + gold border) =============
export function addSummaryBox(
  doc: jsPDF,
  y: number,
  height: number,
  label: string,
  value: string,
  valueColor: [number, number, number] = GREEN
): number {
  if (y + height > 270) { doc.addPage(); y = HEADER_H + 8; }
  // White rect with gold border
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.5);
  doc.rect(MARGIN_X, y, CONTENT_W, height, 'FD');
  // Label
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(label.toUpperCase(), MARGIN_X + 6, y + 8);
  // Value (large, bold) — color configurable (default GREEN; PM-facing uses DARK_TEXT)
  doc.setTextColor(...valueColor);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(value, PAGE_W - MARGIN_X - 6, y + height - 5, { align: 'right' });
  return y + height + 4;
}

// ============= Page-break helper =============
export function checkPageBreak(doc: jsPDF, y: number, needed: number = 20): number {
  if (y + needed > 280) { doc.addPage(); return HEADER_H + 8; }
  return y;
}

// ============= Output helpers =============
export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function pdfToBase64(doc: jsPDF): string {
  return doc.output('datauristring').split(',')[1];
}
