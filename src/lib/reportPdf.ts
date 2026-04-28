import jsPDF from 'jspdf';
import {
  addBlackHeader,
  addFooter,
  addSectionTitle,
  addInfoTableRow,
  addSummaryBox,
  checkPageBreak,
  MARGIN_X,
  CONTENT_W,
  PAGE_W,
  HEADER_H,
  DARK_TEXT,
  MUTED,
  GOLD,
  GREEN,
  WHITE,
  BLACK,
  ALT_ROW,
} from './pdfHelpers';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  pm?: string;
  zone?: string;
  technician?: string;
  workType?: string;
}

export interface ReportKpi {
  label: string;
  value: string | number;
}

export interface ReportTable {
  headers: string[];
  rows: string[][];
}

interface ReportData {
  title: string;
  filters: ReportFilters;
  kpis: ReportKpi[];
  table: ReportTable;
  generatedAt?: Date;
}

export function generateReportPdf(data: ReportData): jsPDF {
  const { title, filters, kpis, table } = data;
  const doc = new jsPDF();

  const dateRange =
    filters.dateFrom || filters.dateTo
      ? `${filters.dateFrom || '…'} → ${filters.dateTo || '…'}`
      : 'All time';

  addBlackHeader(doc, {
    propertyName: title,
    docType: `Report · ${dateRange}`,
  });

  let y = HEADER_H + 8;

  // Filters
  y = addSectionTitle(doc, y, 'Filters Applied');
  y = addInfoTableRow(doc, y, 'Date From', filters.dateFrom || 'All');
  y = addInfoTableRow(doc, y, 'Date To', filters.dateTo || 'All');
  y = addInfoTableRow(doc, y, 'Property Manager', filters.pm || 'All');
  y = addInfoTableRow(doc, y, 'Zone', filters.zone || 'All');
  y = addInfoTableRow(doc, y, 'Technician', filters.technician || 'All');
  y = addInfoTableRow(doc, y, 'Work Type', filters.workType || 'All');
  y += 4;

  // KPIs section as gold-bordered grid of summary boxes
  y = addSectionTitle(doc, y, 'Summary Metrics');
  const boxesPerRow = 2;
  const boxW = (CONTENT_W - 6) / boxesPerRow;
  const boxH = 22;

  for (let i = 0; i < kpis.length; i += boxesPerRow) {
    y = checkPageBreak(doc, y, boxH + 6);
    for (let j = 0; j < boxesPerRow && i + j < kpis.length; j++) {
      const kpi = kpis[i + j];
      const x = MARGIN_X + j * (boxW + 6);
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(1.2);
      doc.rect(x, y, boxW, boxH, 'FD');
      doc.setTextColor(...MUTED);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.label.toUpperCase(), x + 4, y + 7);
      doc.setTextColor(...GREEN);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(String(kpi.value), x + 4, y + 17);
    }
    y += boxH + 4;
  }
  y += 2;

  // Data table
  y = checkPageBreak(doc, y, 30);
  y = addSectionTitle(doc, y, 'Data');

  if (table.rows.length === 0) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No data matches the selected filters.', MARGIN_X + 2, y + 2);
  } else {
    const colCount = table.headers.length;
    const colW = CONTENT_W / colCount;

    // Table header (light gray bg with gold underline)
    doc.setFillColor(245, 245, 245);
    doc.rect(MARGIN_X, y, CONTENT_W, 7, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(MARGIN_X, y + 7, CONTENT_W, 0.6, 'F');
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    table.headers.forEach((h, idx) => {
      doc.text(h.toUpperCase(), MARGIN_X + idx * colW + 3, y + 4.7);
    });
    y += 7;

    // Rows with alternating bg
    table.rows.forEach((row, rIdx) => {
      y = checkPageBreak(doc, y, 8);
      const rowH = 7;
      if (rIdx % 2 === 0) {
        doc.setFillColor(...ALT_ROW);
      } else {
        doc.setFillColor(...WHITE);
      }
      doc.rect(MARGIN_X, y, CONTENT_W, rowH, 'F');
      doc.setTextColor(...DARK_TEXT);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      row.forEach((cell, cIdx) => {
        const text = doc.splitTextToSize(String(cell), colW - 4)[0] ?? '';
        doc.text(text, MARGIN_X + cIdx * colW + 3, y + 4.7);
      });
      y += rowH;
    });
  }

  addFooter(doc);
  return doc;
}
