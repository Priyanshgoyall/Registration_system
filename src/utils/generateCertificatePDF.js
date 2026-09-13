import { jsPDF } from 'jspdf';
import { generateQRDataUrl } from './generateQR';

/**
 * Generates a certificate PDF.
 *
 * Dynamic fields supported in templates:
 *   {{student_name}}, {{school_name}}, {{email}}, {{city}}, {{session_name}}, {{certificate_id}}, {{date}}
 */
export async function generateCertificatePDF({
  studentName,
  schoolName,
  email,
  city,
  className,
  sessionName,
  certificateId,
  issuedAt,
  templateDataUrl = null,
}) {
  try {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297;
    const H = 210;

    const dateStr = issuedAt
      ? new Date(issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    const emailStr = email || '';
    const cityStr = city || '';
    const metaLine = [schoolName, cityStr, emailStr].filter(Boolean).join(' · ');

    if (templateDataUrl) {
      // ── Custom template mode ──────────────────────────────────────────────
      const imgType = templateDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      pdf.addImage(templateDataUrl, imgType, 0, 0, W, H);

      // Student name — centered
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(26);
      pdf.setTextColor(15, 23, 42);
      pdf.text(studentName || '—', W / 2, H * 0.38, { align: 'center' });

      // School, City & Email
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor(30, 41, 59);
      pdf.text(metaLine || '—', W / 2, H * 0.48, { align: 'center' });

      // Session
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.setTextColor(37, 99, 235);
      pdf.text(sessionName || '—', W / 2, H * 0.56, { align: 'center' });

      // Date
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Issued on ${dateStr}`, W / 2, H * 0.64, { align: 'center' });

      // Certificate ID
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Certificate ID: ${certificateId}`, W / 2, H * 0.70, { align: 'center' });

      // QR Code
      const verifyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/verify?cert=${certificateId}`;
      const qrDataUrl = await generateQRDataUrl(verifyUrl, { width: 120, color: { dark: '#0f172a', light: '#ffffff' } });
      if (qrDataUrl) {
        const qrSize = 28;
        const qrX = W - 42;
        const qrY = H - 42;
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 2, 2, 'F');
        pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Scan to verify', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });
      }
    } else {
      // ── Built-in design mode ──────────────────────────────────────────────
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, W, H, 'F');

      pdf.setFillColor(37, 99, 235);
      pdf.rect(0, 0, W, 8, 'F');
      pdf.rect(0, H - 8, W, 8, 'F');

      pdf.setDrawColor(234, 179, 8);
      pdf.setLineWidth(0.5);
      pdf.line(12, 12, W - 12, 12);
      pdf.line(12, H - 12, W - 12, H - 12);

      const cs = 8;
      [[12, 12], [W - 12, 12], [12, H - 12], [W - 12, H - 12]].forEach(([x, y]) => {
        pdf.setDrawColor(234, 179, 8);
        pdf.setLineWidth(1);
        pdf.line(x - cs / 2, y, x + cs / 2, y);
        pdf.line(x, y - cs / 2, x, y + cs / 2);
      });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(148, 163, 184);
      pdf.text('CERTIFICATE OF PARTICIPATION', W / 2, 25, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor(203, 213, 225);
      pdf.text('This is to certify that', W / 2, 45, { align: 'center' });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(28);
      pdf.setTextColor(255, 255, 255);
      pdf.text(studentName || '—', W / 2, 65, { align: 'center' });

      const nameWidth = pdf.getTextWidth(studentName || '—');
      const nameX = W / 2 - nameWidth / 2;
      pdf.setDrawColor(37, 99, 235);
      pdf.setLineWidth(0.6);
      pdf.line(nameX, 68, nameX + nameWidth, 68);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(203, 213, 225);
      pdf.text(`from ${metaLine || '—'}`, W / 2, 80, { align: 'center' });

      pdf.setFontSize(11);
      pdf.text('has successfully participated in', W / 2, 92, { align: 'center' });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(96, 165, 250);
      pdf.text(sessionName || '—', W / 2, 108, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Issued on ${dateStr}`, W / 2, 122, { align: 'center' });

      pdf.setFont('courier', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Certificate ID: ${certificateId}`, W / 2, 135, { align: 'center' });

      // QR
      const verifyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/verify?cert=${certificateId}`;
      const qrDataUrl = await generateQRDataUrl(verifyUrl, { width: 120, color: { dark: '#0f172a', light: '#ffffff' } });
      if (qrDataUrl) {
        const qrSize = 30;
        const qrX = W - 55;
        const qrY = H - 55;
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 2, 2, 'F');
        pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Scan to verify', qrX + qrSize / 2, qrY + qrSize + 6, { align: 'center' });
      }

      // Signature line
      pdf.setDrawColor(51, 65, 85);
      pdf.setLineWidth(0.3);
      pdf.line(30, H - 35, 90, H - 35);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Authorized Signature', 60, H - 30, { align: 'center' });
    }

    return pdf.output('blob');
  } catch (err) {
    console.error('Certificate PDF generation failed:', err);
    return null;
  }
}

export async function downloadCertificatePDF(params) {
  const blob = await generateCertificatePDF(params);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.certificateId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
