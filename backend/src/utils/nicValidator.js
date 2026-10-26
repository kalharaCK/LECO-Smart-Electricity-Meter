/**
 * Utility for validating and normalizing Sri Lankan National Identity Card (NIC) numbers.
 * Supports:
 * - Old format: 9 digits followed by 'V' or 'X' (e.g., 851234567V)
 * - New format: 12 numeric digits (e.g., 198512345678)
 */

function isValidNic(nic) {
  if (!nic || typeof nic !== 'string') return false;
  const cleaned = nic.trim().toUpperCase();
  const oldNicRegex = /^[0-9]{9}[VX]$/;
  const newNicRegex = /^[0-9]{12}$/;
  return oldNicRegex.test(cleaned) || newNicRegex.test(cleaned);
}

function normalizeNic(nic) {
  if (!nic || typeof nic !== 'string') return null;
  const cleaned = nic.trim().toUpperCase();
  if (isValidNic(cleaned)) return cleaned;
  return null;
}

module.exports = {
  isValidNic,
  normalizeNic
};
