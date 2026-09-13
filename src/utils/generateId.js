/**
 * Generates a unique Registration ID in the format REG-XXXXXXXX
 */
export function generateRegistrationId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REG-${timestamp}${random}`;
}

/**
 * Generates a unique Certificate ID in the format CERT-XXXXXXXX
 */
export function generateCertificateId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CERT-${timestamp}${random}`;
}
