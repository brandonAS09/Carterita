import * as Crypto from 'expo-crypto';

/**
 * Hash de contraseñas local (F00).
 * Formato almacenado en Usuario.password_hash:  sha256$<salt_hex>$<hash_hex>
 */
const PREFIX = 'sha256';

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const digest = (salt: string, password: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);

export const isHashedPassword = (stored: string): boolean =>
  stored.startsWith(`${PREFIX}$`) && stored.split('$').length === 3;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = toHex(Crypto.getRandomBytes(16));
  const hash = await digest(salt, password);
  return `${PREFIX}$${salt}$${hash}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  if (!isHashedPassword(stored)) return false;
  const [, salt, expected] = stored.split('$');
  const actual = await digest(salt, password);
  return actual === expected;
};
