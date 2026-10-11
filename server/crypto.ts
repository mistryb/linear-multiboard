import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { env } from './env'

// Linear API keys are stored encrypted at rest with AES-256-GCM.
// Stored format: base64(iv[12] | authTag[16] | ciphertext).

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', env.encryptionKey, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')
}

export function decrypt(stored: string): string {
  const buf = Buffer.from(stored, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', env.encryptionKey, buf.subarray(0, 12))
  decipher.setAuthTag(buf.subarray(12, 28))
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8')
}

/** A random URL-safe token (sessions, magic links). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Tokens are stored hashed so a database leak can't be replayed as logins. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
