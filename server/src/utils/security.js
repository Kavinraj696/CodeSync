const crypto = require('crypto');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(process.env.ENCRYPTION_SECRET || 'codesync_default_encryption_secret_2026')
  .digest();

/**
 * Encrypt sensitive strings (e.g. Git PAT credentials) at rest
 */
function encryptCredential(plainText) {
  if (!plainText) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt stored credential
 */
function decryptCredential(cipherText) {
  if (!cipherText || !cipherText.includes(':')) return '';
  try {
    const [ivHex, encryptedHex] = cipherText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[Security] Failed to decrypt credential:', err.message);
    return '';
  }
}

/**
 * Prevent Directory Traversal attacks (e.g. '../../etc/passwd')
 */
function sanitizePath(baseDir, userInputPath) {
  if (!userInputPath) return baseDir;
  const absoluteBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(absoluteBase, userInputPath);

  if (!resolvedPath.startsWith(absoluteBase)) {
    throw new Error(`Security Violation: Directory traversal attempt detected outside workspace (${userInputPath})`);
  }

  return resolvedPath;
}

module.exports = {
  encryptCredential,
  decryptCredential,
  sanitizePath,
};
