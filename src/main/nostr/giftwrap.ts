/**
 * SovereignHive NIP-59 / NIP-17 Gift Wrap Protocol
 *
 * Encapsulates inter-agent message payloads inside ephemeral gift wraps (kind 1059)
 * containing sealed rumors (kind 13 / kind 14).
 *
 * PRIVACY GUARANTEE:
 *   Relays see ONLY:
 *     - An ephemeral, one-time sender public key
 *     - An encrypted ciphertext blob
 *     - A recipient public key ('p' tag)
 *     - Obfuscated timestamp jitter (+/- up to 2 days)
 *   Relays NEVER see:
 *     - The true sender identity
 *     - The inner message type, conversation id, or subject
 *     - The plaintext body
 */
import { nip59 } from 'nostr-tools';
import { decodeNpub } from './crypto';
import type { NostrEvent, VerifiedEvent } from './types';

export interface UnwrappedAgentMessage {
  senderPublicKey: string; // The authentic sender's real public key (from seal)
  recipientPublicKey: string;
  kind: number;            // Inner rumor kind (e.g. 14 for chat/work order)
  createdAt: number;       // Inner rumor creation timestamp
  content: string;         // Plaintext body or JSON string
  parsedJson?: unknown;    // Parsed JSON if content was valid JSON
  tags: string[][];        // Inner rumor tags
  rumorId: string;         // Inner rumor hash id
}

/**
 * Wrap an inter-agent message payload inside a NIP-59 Gift Wrap (kind 1059).
 */
export function wrapAgentMessage(params: {
  senderSecretKey: Uint8Array;
  recipientPublicKeyHexOrNpub: string;
  content: string | object;
  kind?: number;
  tags?: string[][];
  createdAtSeconds?: number;
}): NostrEvent {
  const recipientHex = params.recipientPublicKeyHexOrNpub.startsWith('npub1')
    ? decodeNpub(params.recipientPublicKeyHexOrNpub)
    : params.recipientPublicKeyHexOrNpub.trim().toLowerCase();

  const contentStr = typeof params.content === 'string'
    ? params.content
    : JSON.stringify(params.content);

  const rumorTemplate = {
    kind: params.kind ?? 14,
    created_at: params.createdAtSeconds ?? Math.floor(Date.now() / 1000),
    tags: [
      ['p', recipientHex],
      ...(params.tags ?? [])
    ],
    content: contentStr
  };

  return nip59.wrapEvent(rumorTemplate, params.senderSecretKey, recipientHex);
}

/**
 * Decrypt and unwrap a received NIP-59 Gift Wrap (kind 1059) using the recipient's secret key.
 * Returns null if the event is not a valid gift wrap or decryption fails.
 */
export function unwrapAgentMessage(
  giftWrapEvent: NostrEvent,
  recipientSecretKey: Uint8Array
): UnwrappedAgentMessage | null {
  if (giftWrapEvent.kind !== 1059) {
    return null;
  }

  try {
    const rumor = nip59.unwrapEvent(giftWrapEvent, recipientSecretKey);
    if (!rumor || typeof rumor !== 'object') return null;

    let parsedJson: unknown = undefined;
    if (typeof rumor.content === 'string') {
      const trimmed = rumor.content.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          parsedJson = JSON.parse(trimmed);
        } catch {
          // not JSON or malformed, leave undefined
        }
      }
    }

    const pTag = rumor.tags?.find((t: string[]) => t[0] === 'p')?.[1] ?? '';

    return {
      senderPublicKey: rumor.pubkey,
      recipientPublicKey: pTag,
      kind: rumor.kind,
      createdAt: rumor.created_at,
      content: rumor.content,
      parsedJson,
      tags: rumor.tags ?? [],
      rumorId: rumor.id
    };
  } catch (e) {
    return null;
  }
}
