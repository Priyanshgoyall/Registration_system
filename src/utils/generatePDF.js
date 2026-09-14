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
 * Captures a DOM element and downloads it as an exact 8.5 cm x 5.5 cm PDF.
 * @param {HTMLElement} element - The element to capture
 * @param {string} filename - The output PDF filename
 */
export async function downloadAsPDF(element, filename = 'registration-card') {
  try {
    const clone = element.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    document.body.appendChild(clone);

    await preFetchImages(clone);

    const canvas = await html2canvas(clone, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    document.body.removeChild(clone);

    const imgData = canvas.toDataURL('image/png');
    // PDF dimensions: exact 85 mm width x 55 mm height (8.5 cm x 5.5 cm)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85, 55],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, 85, 55);
    pdf.save(`${filename}.pdf`);
    return true;
  } catch (err) {
    console.error('PDF generation failed:', err);
    return false;
  }
}
