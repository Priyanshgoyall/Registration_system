import { jsPDF } from 'jspdf';

/**
 * Renders the user certificate template image to a canvas with the user's name
 * printed in elegant cursive font right on top of the horizontal line in the middle.
 */
export async function renderUserCertificateCanvas(studentName, templateImageSrc = '/user-certificate-template.jpg') {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      // Ensure Google cursive fonts are loaded
      if (typeof document !== 'undefined' && document.fonts) {
        try {
          await document.fonts.load('60px "Great Vibes"');
          await document.fonts.load('60px "Dancing Script"');
        } catch {
          // fallback gracefully
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = img.width || 2000;
      canvas.height = img.height || 1414;
      const ctx = canvas.getContext('2d');

      // Draw original template background
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const nameVal = (studentName || '—').trim();

      // Dynamic cursive font size scaling based on name length
      let fontSize = Math.round(canvas.height * 0.070); // ~100px for 1414px height
      if (nameVal.length > 30) fontSize = Math.round(canvas.height * 0.048);
      else if (nameVal.length > 22) fontSize = Math.round(canvas.height * 0.058);

      ctx.font = `bold ${fontSize}px "Great Vibes", "Dancing Script", "Alex Brush", cursive, serif`;
      ctx.fillStyle = '#0e305d'; // Deep Royal Navy matching the certificate title & JUET branding theme
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      // Position: Centered horizontally, sitting right on top of the middle horizontal line
      const x = canvas.width / 2;
      const y = canvas.height * 0.570;

      ctx.fillText(nameVal, x, y);

      resolve(canvas);
    };

    img.onerror = () => {
      console.error('Failed to load certificate template image:', templateImageSrc);
      resolve(null);
    };

    img.src = templateImageSrc;
  });
}

/**
 * Generates a user certificate PDF using the official template.
 */
export async function generateCertificatePDF({
  studentName,
  templateDataUrl = null,
}) {
  try {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297;
    const H = 210;

    const templateSrc = templateDataUrl || '/user-certificate-template.jpg';
    const canvas = await renderUserCertificateCanvas(studentName, templateSrc);

    if (canvas) {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(dataUrl, 'JPEG', 0, 0, W, H);
    } else {
      // Fallback
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(26);
      pdf.text(studentName || '—', W / 2, H * 0.5, { align: 'center' });
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
  a.download = `Certificate_${(params.studentName || 'Student').replace(/\s+/g, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
