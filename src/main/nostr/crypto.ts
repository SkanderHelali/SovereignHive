/**
 * SovereignHive Nostr Cryptographic Primitives
 *
 * Implements key generation, bech32 encoding/decoding, and event signing/verification
 * using nostr-tools (schnorr signatures on secp256k1).
 */
import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';
import type { NostrKeyPair, NostrEvent, EventTemplate, VerifiedEvent } from './types';

/**
 * Generate a cryptographically secure secp256k1 Nostr keypair.
 */
export function generateAgentKeyPair(): NostrKeyPair {
  const secretKey = generateSecretKey();
  const publicKey = getPublicKey(secretKey);
  const nsec = nip19.nsecEncode(secretKey);
  const npub = nip19.npubEncode(publicKey);
  return { secretKey, publicKey, nsec, npub };
}

/**
 * Reconstruct a NostrKeyPair from a raw Uint8Array, hex string, or bech32 `nsec1...` string.
 */
export function keyPairFromSecret(input: Uint8Array | string): NostrKeyPair {
  let secretKey: Uint8Array;

  if (input instanceof Uint8Array) {
    secretKey = input;
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('nsec1')) {
      const decoded = nip19.decode(trimmed);
      if (decoded.type !== 'nsec' || !(decoded.data instanceof Uint8Array)) {
        throw new Error('Invalid nsec bech32 string');
      }
      secretKey = decoded.data;
    } else {
      // Assume 64-character hex string
      if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        throw new Error('Invalid secret key hex string: must be 64 hex characters');
      }
      secretKey = fromHex(trimmed);
    }
  } else {
    throw new Error('Invalid secret key input');
  }

  if (secretKey.length !== 32) {
    throw new Error(`Invalid secret key length: expected 32 bytes, got ${secretKey.length}`);
  }

  const publicKey = getPublicKey(secretKey);
  const nsec = nip19.nsecEncode(secretKey);
  const npub = nip19.npubEncode(publicKey);

  return { secretKey, publicKey, nsec, npub };
}

/**
 * Encode a 32-byte hex public key into an `npub1...` bech32 identifier.
 */
export function encodeNpub(pubkeyHex: string): string {
  const cleanHex = pubkeyHex.trim().toLowerCase();
  return nip19.npubEncode(cleanHex);
}

/**
 * Decode an `npub1...` bech32 identifier into a 32-byte lowercase hex public key.
 */
export function decodeNpub(npub: string): string {
  const trimmed = npub.trim();
  if (!trimmed.startsWith('npub1')) {
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    throw new Error('Invalid npub string');
  }
  const decoded = nip19.decode(trimmed);
  if (decoded.type !== 'npub' || typeof decoded.data !== 'string') {
    throw new Error('Failed to decode npub string');
  }
  return decoded.data.toLowerCase();
}

/**
 * Encode a 32-byte secret key into an `nsec1...` bech32 string.
 */
export function encodeNsec(secretKeyBytes: Uint8Array): string {
  return nip19.nsecEncode(secretKeyBytes);
}

/**
 * Decode an `nsec1...` bech32 string into a 32-byte secret key Uint8Array.
 */
export function decodeNsec(nsec: string): Uint8Array {
  const trimmed = nsec.trim();
  const decoded = nip19.decode(trimmed);
  if (decoded.type !== 'nsec' || !(decoded.data instanceof Uint8Array)) {
    throw new Error('Failed to decode nsec string');
  }
  return decoded.data;
}

/**
 * Convert a Uint8Array to a hex string.
 */
export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

/**
 * Convert a hex string to a Uint8Array.
 */
export function fromHex(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

/**
 * Sign a Nostr event template with a secret key, returning a VerifiedEvent.
 */
export function signEvent(template: EventTemplate, secretKey: Uint8Array): VerifiedEvent {
  return finalizeEvent(template, secretKey);
}

/**
 * Verify a Nostr event's Schnorr signature and id hash.
 */
export function verifyNostrEvent(event: NostrEvent): boolean {
  try {
    return verifyEvent(event);
  } catch {
    return false;
  }
}
