import { randomUUID } from 'node:crypto';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
const { decodeUTF8 } = naclUtil;

/**
 * Generate a challenge string for Ed25519 authentication.
 * Format: `timestamp:uuid`
 */
export function generateChallenge(): string {
  return `${Date.now()}:${randomUUID()}`;
}

/**
 * Sign a challenge using an Ed25519 secret key.
 * @param challenge - The challenge string to sign
 * @param secretKey - The 64-byte Ed25519 secret key as a Uint8Array
 * @returns Hex-encoded signature string
 */
export function signChallenge(challenge: string, secretKey: Uint8Array): string {
  const messageBytes = decodeUTF8(challenge);
  const signature = nacl.sign.detached(messageBytes, secretKey);
  return Buffer.from(signature).toString('hex');
}

/**
 * Build a Bearer auth header using Ed25519 signing.
 * Format: `Bearer agentId:challenge:signature`
 * @param agentId - The agent's unique identifier
 * @param secretKey - The 64-byte Ed25519 secret key as a Uint8Array
 * @returns The full Authorization header value
 */
export function buildAuthHeader(agentId: string, secretKey: Uint8Array): string {
  const challenge = generateChallenge();
  const signature = signChallenge(challenge, secretKey);
  return `Bearer ${agentId}:${challenge}:${signature}`;
}

/**
 * Generate a new Ed25519 keypair.
 * @returns An object with publicKey and secretKey as Uint8Arrays
 */
export function generateKeypair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  return nacl.sign.keyPair();
}

/**
 * Convert a hex-encoded secret key string to a Uint8Array.
 */
export function secretKeyFromHex(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

/**
 * Convert a Uint8Array key to a hex string.
 */
export function keyToHex(key: Uint8Array): string {
  return Buffer.from(key).toString('hex');
}
