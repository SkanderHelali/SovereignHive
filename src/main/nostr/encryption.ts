/**
 * SovereignHive NIP-44 v2 Authenticated Encryption
 *
 * Implements NIP-44 v2 end-to-end authenticated encryption using XChaCha20-Poly1305
 * and secp256k1 ECDH with deterministic conversation key derivation.
 */
import { nip44 } from 'nostr-tools';
import { decodeNpub } from './crypto';

/**
 * Derive the 32-byte shared conversation key between a private key holder and a public key holder.
 */
export function getConversationKey(secretKey: Uint8Array, peerPublicKeyHex: string): Uint8Array {
  const cleanPeerHex = peerPublicKeyHex.startsWith('npub1')
    ? decodeNpub(peerPublicKeyHex)
    : peerPublicKeyHex.trim().toLowerCase();
  return nip44.v2.utils.getConversationKey(secretKey, cleanPeerHex);
}

/**
 * Encrypt a plaintext string using a derived conversation key (NIP-44 v2).
 */
export function encryptNip44(plaintext: string, conversationKey: Uint8Array): string {
  if (typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a string');
  }
  return nip44.v2.encrypt(plaintext, conversationKey);
}

/**
 * Decrypt a NIP-44 v2 ciphertext payload using a derived conversation key.
 */
export function decryptNip44(ciphertext: string, conversationKey: Uint8Array): string {
  if (typeof ciphertext !== 'string') {
    throw new Error('Ciphertext must be a string');
  }
  return nip44.v2.decrypt(ciphertext, conversationKey);
}

/**
 * Convenience helper to encrypt a plaintext message directly for a recipient public key.
 */
export function encryptForPeer(
  plaintext: string,
  senderSecretKey: Uint8Array,
  recipientPublicKeyHexOrNpub: string
): string {
  const conversationKey = getConversationKey(senderSecretKey, recipientPublicKeyHexOrNpub);
  return encryptNip44(plaintext, conversationKey);
}

/**
 * Convenience helper to decrypt a ciphertext message directly from a sender public key.
 */
export function decryptFromPeer(
  ciphertext: string,
  recipientSecretKey: Uint8Array,
  senderPublicKeyHexOrNpub: string
): string {
  const conversationKey = getConversationKey(recipientSecretKey, senderPublicKeyHexOrNpub);
  return decryptNip44(ciphertext, conversationKey);
}
