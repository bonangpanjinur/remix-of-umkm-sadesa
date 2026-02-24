/**
 * Phone Number Validation Utility
 * Accepts various formats: 08xx, +62xx, 021xxx, 09xx, etc.
 */

/**
 * Validates a phone number (flexible format)
 * @param phone - The phone number to validate
 * @returns boolean indicating if the phone number is valid
 */
export function isValidIndonesianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 8 && cleaned.length <= 15;
}

/**
 * Formats a phone number for display
 * @param phone - The phone number to format
 * @returns Formatted phone number
 */
export function formatIndonesianPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 8) return `${cleaned.substring(0, 4)}-${cleaned.substring(4)}`;
  
  const part1 = cleaned.substring(0, 4);
  const part2 = cleaned.substring(4, 8);
  const part3 = cleaned.substring(8);
  return `${part1}-${part2}${part3 ? '-' + part3 : ''}`;
}

/**
 * Normalizes phone input (removes formatting but keeps digits)
 * @param phone - The phone number to normalize
 * @returns Normalized phone number (digits only)
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Gets validation error message for phone number
 * @param phone - The phone number to validate
 * @returns Error message or null if valid
 */
export function getPhoneValidationError(phone: string): string | null {
  if (!phone || phone.trim() === '') {
    return null;
  }
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length < 8) {
    return 'Nomor telepon minimal 8 digit';
  }
  
  if (cleaned.length > 15) {
    return 'Nomor telepon maksimal 15 digit';
  }
  
  return null;
}

/**
 * Validates a phone number and returns result object
 */
export function validatePhone(phone: string): { isValid: boolean; error: string | null } {
  const error = getPhoneValidationError(phone);
  return {
    isValid: error === null && phone.trim() !== '',
    error,
  };
}

/**
 * Checks if phone is in WhatsApp format
 */
export function isWhatsAppFormat(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 8 && cleaned.length <= 15;
}

/**
 * Converts Indonesian phone to international WhatsApp format
 * @param phone - The phone number to convert
 * @returns Phone in 62xxx format for WhatsApp
 */
export function toWhatsAppFormat(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('62')) {
    return cleaned;
  }
  
  if (cleaned.startsWith('0')) {
    return '62' + cleaned.substring(1);
  }
  
  return cleaned;
}
