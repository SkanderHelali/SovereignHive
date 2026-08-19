/**
 * SovereignHive Nostr Type Definitions
 */
import type { Event as NostrEvent, EventTemplate, VerifiedEvent } from 'nostr-tools/pure';

export type { NostrEvent, EventTemplate, VerifiedEvent };

export interface NostrKeyPair {
  secretKey: Uint8Array;
  publicKey: string; // 32-byte lowercase hex
  nsec: string;      // bech32 encoded private key (nsec1...)
  npub: string;      // bech32 encoded public key (npub1...)
}

export interface AgentNostrIdentity {
  agentId: string;
  npub: string;
  publicKey: string; // hex
  nip05?: string;
  createdAt: number;
  relays?: string[];
}

export interface NostrProfileMetadata {
  name: string;
  displayName?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud16?: string;
  bot?: boolean;
}

export interface NostrRelayConfig {
  url: string;
  read: boolean;
  write: boolean;
}

export const DEFAULT_NOSTR_RELAYS: readonly NostrRelayConfig[] = [
  { url: 'wss://nostr.slothy.win', read: true, write: true },
  { url: 'wss://relay.damus.io', read: true, write: true },
  { url: 'wss://nos.lol', read: true, write: true },
  { url: 'wss://relay.primal.net', read: true, write: true },
  { url: 'wss://nostr.mom', read: true, write: true }
] as const;
