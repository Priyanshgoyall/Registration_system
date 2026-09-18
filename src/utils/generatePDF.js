// import html2canvas from 'html2canvas';
// import { jsPDF } from 'jspdf';

// /**
//  * Fetches an image URL and returns it as a base64 data URL.
//  * Prevents CORS issues when rendering external images with html2canvas.
//  */
// async function toBase64DataUrl(url) {
//   try {
//     const response = await fetch(url, { mode: 'cors' });
//     const blob = await response.blob();
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();
//       reader.onload = () => resolve(reader.result);
//       reader.onerror = reject;
//       reader.readAsDataURL(blob);
//     });
//   } catch {
//     return null;
//   }
// }

// /**
//  * Pre-processes the DOM element before capturing:
//  * Converts all img src URLs to base64 data URLs.
//  */
// async function preFetchImages(element) {
//   const imgs = element.querySelectorAll('img[src]');
//   const promises = Array.from(imgs).map(async (img) => {
//     const src = img.getAttribute('src');
//     if (!src || src.startsWith('data:')) return;
//     const base64 = await toBase64DataUrl(src);
//     if (base64) {
//       img.setAttribute('src', base64);
//     }
//   });
//   await Promise.all(promises);
// }

// /**
//  * Captures a DOM element at Ultra-High 300+ DPI resolution and returns PNG data URL & canvas.
//  */
// export async function renderHighResCardCanvas(element) {
//   // If element is a wrapper or container, target the actual card element
//   const cardElement =
//     (element.matches?.('.registration-card-root') ? element : null) ||
//     element.querySelector?.('.registration-card-root') ||
//     element.querySelector?.('[style*="8.5cm"]') ||
//     element;

//   const clone = cardElement.cloneNode(true);
//   clone.style.position = 'fixed';
//   clone.style.top = '0';
//   clone.style.left = '0';
//   clone.style.zIndex = '-9999';
//   clone.style.visibility = 'visible';
//   clone.style.opacity = '1';
//   clone.style.pointerEvents = 'auto';
//   clone.style.transform = 'none';
//   document.body.appendChild(clone);

//   await preFetchImages(clone);
//   // Ensure fonts are completely loaded and settled before capture
//   if (typeof document !== 'undefined' && document.fonts) {
//     try {
//       await document.fonts.ready;
//     } catch {
//       // fallback
//     }
//   }
//   await new Promise((r) => setTimeout(r, 150));

//   const canvas = await html2canvas(clone, {
//     scale: 4, // 300+ DPI ultra-high resolution
//     useCORS: true,
//     allowTaint: true,
//     backgroundColor: '#ffffff',
//     logging: false,
//     imageTimeout: 0,
//     scrollX: 0,
//     scrollY: 0,
//     x: 0,
//     y: 0,
//   });

//   document.body.removeChild(clone);
//   return canvas;
// }

// /**
//  * Captures a DOM element and downloads it as an exact 8.5 cm x 5.5 cm high-res PDF.
//  */
// export async function downloadAsPDF(element, filename = 'registration-card') {
//   try {
//     const canvas = await renderHighResCardCanvas(element);
//     const imgData = canvas.toDataURL('image/png', 1.0);

//     // Exact physical dimensions: 85 mm x 55 mm
//     const pdf = new jsPDF({
//       orientation: 'landscape',
//       unit: 'mm',
//       format: [85, 55],
//     });

//     pdf.addImage(imgData, 'PNG', 0, 0, 85, 55, undefined, 'FAST');
//     pdf.save(`${filename}.pdf`);
//     return true;
//   } catch (err) {
//     console.error('PDF generation failed:', err);
//     return false;
//   }
// }

// /**
//  * Generates an A4 print sheet containing 1 to 8 ID cards in a 2x4 grid.
//  * Target A4: 210 mm x 297 mm. Each Card: 85 mm x 55 mm (Landscape).
//  * @param {Array<HTMLElement>} cardElements - Array of 1 to 8 DOM elements to render
//  * @param {string} filename - Output filename
//  */
// export async function generateA4PrintPDF(cardElements, filename = 'id-cards-a4-sheet') {
//   if (!cardElements || cardElements.length === 0) {
//     throw new Error('Please select at least 1 ID card to print.');
//   }
//   if (cardElements.length > 8) {
//     throw new Error('You can print a maximum of 8 ID cards at a time.');
//   }

//   // Create A4 PDF (210 mm x 297 mm, portrait)
//   const pdf = new jsPDF({
//     orientation: 'portrait',
//     unit: 'mm',
//     format: 'a4',
//   });

//   // Grid coordinates for 2x4 layout (2 columns x 4 rows)
//   // Col 1: 15mm, Col 2: 110mm (85mm card + 10mm gutter = 95mm spacing)
//   // Rows: 15mm, 84mm, 153mm, 222mm (55mm card + 14mm gutter for easy cutting)
//   const colX = [15, 110];
//   const rowY = [15, 84, 153, 222];

//   for (let i = 0; i < cardElements.length; i++) {
//     const el = cardElements[i];
//     const canvas = await renderHighResCardCanvas(el);
//     const imgData = canvas.toDataURL('image/png', 1.0);

//     const col = i % 2; // 0 or 1
//     const row = Math.floor(i / 2); // 0 to 3

//     const x = colX[col];
//     const y = rowY[row];

//     pdf.addImage(imgData, 'PNG', x, y, 85, 55, undefined, 'FAST');
//     pdf.setDrawColor(148, 163, 184); // slate-400 crisp cut border
//     pdf.setLineWidth(0.3);
//     pdf.roundedRect(x, y, 85, 55, 3, 3, 'S');
//   }

//   pdf.save(`${filename}.pdf`);
//   return true;
// }




// Modified By Atharva


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
          await document.fonts.ready;
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
      // Preserve aspect ratio to prevent image squashing/stretching
      const canvasRatio = canvas.width / canvas.height;
      const pageRatio = W / H;
      let renderW = W;
      let renderH = H;
      let offsetX = 0;
      let offsetY = 0;

      if (Math.abs(canvasRatio - pageRatio) > 0.01) {
        if (canvasRatio > pageRatio) {
          renderH = W / canvasRatio;
          offsetY = (H - renderH) / 2;
        } else {
          renderW = H * canvasRatio;
          offsetX = (W - renderW) / 2;
        }
      }

      pdf.addImage(dataUrl, 'JPEG', offsetX, offsetY, renderW, renderH);
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
