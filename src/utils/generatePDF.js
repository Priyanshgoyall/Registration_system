import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Fetches an image URL and returns it as a base64 data URL.
 * This is needed to avoid CORS issues when rendering external images with html2canvas.
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
    return null; // fallback: use original URL (may fail in canvas)
  }
}

/**
 * Pre-processes the DOM element before capturing:
 * Converts all img src URLs to base64 data URLs to avoid CORS issues.
 */
async function preFetchImages(element) {
  const imgs = element.querySelectorAll('img[src]');
  const promises = Array.from(imgs).map(async (img) => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return; // already base64
    const base64 = await toBase64DataUrl(src);
    if (base64) {
      img.setAttribute('src', base64);
    }
  });
  await Promise.all(promises);
}

/**
 * Captures a DOM element and downloads it as a PDF.
 * @param {HTMLElement} element - The element to capture
 * @param {string} filename - The output PDF filename (without extension)
 */
export async function downloadAsPDF(element, filename = 'registration-card') {
  try {
    // Clone the element to avoid mutating the live DOM
    const clone = element.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    document.body.appendChild(clone);

    // Pre-fetch all images to avoid CORS issues
    await preFetchImages(clone);

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    document.body.removeChild(clone);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [canvas.width / 2, canvas.height / 2],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
    pdf.save(`${filename}.pdf`);
    return true;
  } catch (err) {
    console.error('PDF generation failed:', err);
    return false;
  }
}
