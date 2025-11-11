import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique token using UUID v4
 * Used for password reset tokens, email verification, etc.
 * @returns UUID v4 token
 */
export function generateToken(): string {
  return uuidv4();
}

/**
 * Generate a random string of specified length
 * @param length - Length of random string
 * @returns Random alphanumeric string
 */
export function generateRandomString(length: number = 32): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
