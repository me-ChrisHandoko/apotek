import * as argon2 from 'argon2';

/**
 * Hash a plain text password using argon2id
 * @param plain - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    // Uses recommended defaults for memory cost, time cost, and parallelism
  });
}

/**
 * Verify a plain text password against a hash
 * @param plain - Plain text password
 * @param hash - Hashed password
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
