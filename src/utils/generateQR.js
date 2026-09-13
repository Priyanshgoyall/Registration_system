import QRCode from 'qrcode';

/**
 * Generate a QR code data URL for a given text/URL
 * @param {string} text - The text to encode
 * @returns {Promise<string>} - Data URL of the QR code image
 */
export async function generateQRDataUrl(text, options = {}) {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width: 200,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      ...options,
    });
    return dataUrl;
  } catch (err) {
    console.error('QR generation failed:', err);
    return null;
  }
}
