import { jsPDF } from 'jspdf';

/**
 * CSV export utility.
 */
export function exportToCSV(rows, columns, filename = 'export') {
  if (!rows || rows.length === 0) return;

  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.join(',');
  const body = rows.map((row) => columns.map((col) => escape(row[col])).join(',')).join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * PDF export utility — creates a formatted table using jsPDF.
 *
 * @param {Object[]} rows
 * @param {string[]} columns
 * @param {string} title
 * @param {string} filename
 */
export function exportToPDF(rows, columns, title = 'Report', filename = 'export') {
  if (!rows || rows.length === 0) return;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const margin = 14;
  const colWidth = (W - margin * 2) / columns.length;

  // ── Header ──
  pdf.setFillColor(37, 99, 235); // blue-600
  pdf.rect(0, 0, W, 16, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  pdf.text(title, margin, 10.5);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    W - margin,
    10.5,
    { align: 'right' }
  );

  let y = 22;

  // ── Column headers ──
  pdf.setFillColor(241, 245, 249); // slate-100
  pdf.rect(margin, y - 5, W - margin * 2, 8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(71, 85, 105); // slate-600
  columns.forEach((col, i) => {
    const label = col.replace(/_/g, ' ').toUpperCase();
    pdf.text(label, margin + i * colWidth + 1, y);
  });

  y += 5;

  // ── Rows ──
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(15, 23, 42); // slate-900

  rows.forEach((row, rowIdx) => {
    if (y > 190) {
      pdf.addPage();
      y = 20;
    }
    if (rowIdx % 2 === 0) {
      pdf.setFillColor(248, 250, 252); // slate-50
      pdf.rect(margin, y - 4, W - margin * 2, 7, 'F');
    }
    columns.forEach((col, i) => {
      const val = String(row[col] ?? '');
      const truncated = val.length > 20 ? val.slice(0, 18) + '…' : val;
      pdf.text(truncated, margin + i * colWidth + 1, y);
    });
    y += 7;
  });

  // ── Footer ──
  pdf.setFontSize(6);
  pdf.setTextColor(148, 163, 184);
  pdf.text(`Total: ${rows.length} records`, margin, 205);
  pdf.text('Student Registration System', W - margin, 205, { align: 'right' });

  pdf.save(`${filename}.pdf`);
}
