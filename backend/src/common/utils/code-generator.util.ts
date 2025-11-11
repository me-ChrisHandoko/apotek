/**
 * Generate a code with prefix and padded number
 * @param prefix - Code prefix (e.g., 'TENANT', 'CUST')
 * @param number - Sequential number
 * @param padding - Number of digits to pad (default: 6)
 * @returns Generated code (e.g., 'TENANT000001')
 */
export function generateCode(
  prefix: string,
  number: number,
  padding: number = 6,
): string {
  const paddedNumber = number.toString().padStart(padding, '0');
  return `${prefix}${paddedNumber}`;
}

/**
 * Generate a unique tenant code
 * @param lastNumber - Last used number
 * @returns Generated tenant code (e.g., 'PHARM000001')
 */
export function generateTenantCode(lastNumber: number): string {
  return generateCode('PHARM', lastNumber + 1, 6);
}

/**
 * Generate a unique customer code
 * @param lastNumber - Last used number
 * @returns Generated customer code (e.g., 'CUST000001')
 */
export function generateCustomerCode(lastNumber: number): string {
  return generateCode('CUST', lastNumber + 1, 6);
}

/**
 * Generate a unique supplier code
 * @param lastNumber - Last used number
 * @returns Generated supplier code (e.g., 'SUPP000001')
 */
export function generateSupplierCode(lastNumber: number): string {
  return generateCode('SUPP', lastNumber + 1, 6);
}

/**
 * Generate a unique product code
 * @param lastNumber - Last used number
 * @returns Generated product code (e.g., 'PROD000001')
 */
export function generateProductCode(lastNumber: number): string {
  return generateCode('PROD', lastNumber + 1, 6);
}
