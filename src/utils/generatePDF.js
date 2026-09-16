import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Fetches an image URL and returns it as a base64 data URL.
 * Prevents CORS issues when rendering external images with html2canvas.
 */
async function toBase64DataUrl(url) {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Pre-processes the DOM element before capturing:
 * Converts all img src URLs to base64 data URLs.
 */
async function preFetchImages(element) {
  const imgs = element.querySelectorAll('img[src]');
  const promises = Array.from(imgs).map(async (img) => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return;
    const base64 = await toBase64DataUrl(src);
    if (base64) {
      img.setAttribute('src', base64);
    }
  });
  await Promise.all(promises);
}

/**
 * Captures a DOM element at Ultra-High 300+ DPI resolution and returns PNG data URL & canvas.
 */
export async function renderHighResCardCanvas(element) {
  const clone = element.cloneNode(true);
  clone.style.position = 'fixed';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.zIndex = '-9999';
  clone.style.visibility = 'visible';
  clone.style.transform = 'none';
  document.body.appendChild(clone);

  await preFetchImages(clone);
  // Allow fonts & images to settle
  await new Promise((r) => setTimeout(r, 100));

  const canvas = await html2canvas(clone, {
    scale: 4, // 300+ DPI ultra-high resolution
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 0,
  });

  document.body.removeChild(clone);
  return canvas;
}

/**
 * Captures a DOM element and downloads it as an exact 8.5 cm x 5.5 cm high-res PDF.
 */
export async function downloadAsPDF(element, filename = 'registration-card') {
  try {
    const canvas = await renderHighResCardCanvas(element);
    const imgData = canvas.toDataURL('image/png', 1.0);

    // Exact physical dimensions: 85 mm x 55 mm
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85, 55],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, 85, 55, undefined, 'FAST');
    pdf.save(`${filename}.pdf`);
    return true;
  } catch (err) {
    console.error('PDF generation failed:', err);
    return false;
  }
}

/**
 * Generates an A4 print sheet containing 1 to 10 ID cards in a 2x5 grid.
 * Target A4: 210 mm x 297 mm. Each Card: 85 mm x 55 mm (Landscape).
 * @param {Array<HTMLElement>} cardElements - Array of 1 to 10 DOM elements to render
 * @param {string} filename - Output filename
 */
export async function generateA4PrintPDF(cardElements, filename = 'id-cards-a4-sheet') {
  if (!cardElements || cardElements.length === 0) {
    throw new Error('Please select at least 1 ID card to print.');
  }
  if (cardElements.length > 10) {
    throw new Error('You can print a maximum of 10 ID cards at a time.');
  }

  // Create A4 PDF (210 mm x 297 mm, portrait)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Grid coordinates for 2x5 layout (2 columns x 5 rows)
  // Col 1: 15mm, Col 2: 110mm (85mm card + 10mm gutter = 95mm spacing)
  // Rows: 12mm, 69mm, 126mm, 183mm, 240mm (55mm card + 2mm gutter)
  const colX = [15, 110];
  const rowY = [12, 69, 126, 183, 240];

  for (let i = 0; i < cardElements.length; i++) {
    const el = cardElements[i];
    const canvas = await renderHighResCardCanvas(el);
    const imgData = canvas.toDataURL('image/png', 1.0);

    const col = i % 2; // 0 or 1
    const row = Math.floor(i / 2); // 0 to 4

    const x = colX[col];
    const y = rowY[row];

    pdf.addImage(imgData, 'PNG', x, y, 85, 55, undefined, 'FAST');
  }

  pdf.save(`${filename}.pdf`);
  return true;
}
