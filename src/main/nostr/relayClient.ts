/**
 * SovereignHive Nostr Relay Pool Client
 *
 * Manages WebSocket connections to multiple Nostr relays, publishing signed events
 * and subscribing to gift-wrapped agent messages in real time.
 */
import { SimplePool, type Filter } from 'nostr-tools';
import { parseAgentProfileContent } from './profile';
import { decodeNpub } from './crypto';
import { DEFAULT_NOSTR_RELAYS, type NostrEvent, type VerifiedEvent, type NostrProfileMetadata } from './types';

export interface PublishResult {
  successfulRelays: string[];
  failedRelays: Array<{ url: string; error: string }>;
}

export interface SubscriptionHandle {
  close: (reason?: string) => void;
}

export class SovereignRelayPool {
  private pool: SimplePool;
  private defaultRelays: string[];
  private activeSubscriptions = new Set<{ close: (reason?: string) => void }>();

  constructor(customRelays?: string[]) {
    this.pool = new SimplePool();
    this.defaultRelays = customRelays && customRelays.length > 0
      ? customRelays
      : DEFAULT_NOSTR_RELAYS.filter((r) => r.write || r.read).map((r) => r.url);
  }

  /**
   * Get the current configured list of default relay URLs.
   */
  getDefaultRelays(): string[] {
    return [...this.defaultRelays];
  }

  /**
   * Update the default relay URLs.
   */
  setDefaultRelays(relays: string[]): void {
    this.defaultRelays = [...relays];
  }

  /**
   * Publish an event across a set of relays.
   */
  async publish(event: NostrEvent, targetRelays?: string[]): Promise<PublishResult> {
    const relays = targetRelays && targetRelays.length > 0 ? targetRelays : this.defaultRelays;
    const successfulRelays: string[] = [];
    const failedRelays: Array<{ url: string; error: string }> = [];

    const promises = relays.map(async (relayUrl) => {
      try {
        const pubs = this.pool.publish([relayUrl], event);
        await Promise.all(pubs);
        successfulRelays.push(relayUrl);
      } catch (err) {
        failedRelays.push({
          url: relayUrl,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    });

    await Promise.all(promises);

    return {
      successfulRelays,
      failedRelays
    };
  }

  /**
   * Subscribe to NIP-59 Gift Wraps (kind 1059) addressed to one or more recipient public keys.
   */
  subscribeToGiftWraps(params: {
    recipientPublicKeysHexOrNpubs: string[];
    onEvent: (wrapEvent: NostrEvent) => void;
    relays?: string[];
    sinceSeconds?: number;
  }): SubscriptionHandle {
    const relays = params.relays && params.relays.length > 0 ? params.relays : this.defaultRelays;
    const pTags = params.recipientPublicKeysHexOrNpubs.map((pk) =>
      pk.startsWith('npub1') ? decodeNpub(pk) : pk.trim().toLowerCase()
    );

    const filter: Filter = {
      kinds: [1059],
      '#p': pTags,
      ...(params.sinceSeconds ? { since: params.sinceSeconds } : {})
    };

    const sub = this.pool.subscribeMany(relays, filter, {
      onevent: (event: NostrEvent) => {
        try {
          params.onEvent(event);
        } catch (e) {
          console.error('[nostr-relay] Error in gift wrap event handler:', e);
        }
      }
    });

    const handle: SubscriptionHandle = {
      close: (reason) => {
        this.activeSubscriptions.delete(handle);
        try {
          sub.close(reason);
        } catch { /* best effort */ }
      }
    };

    this.activeSubscriptions.add(handle);
    return handle;
  }

  /**
   * Subscribe to arbitrary Nostr filter across relays.
   */
  subscribe(params: {
    filter: Filter;
    onEvent: (event: NostrEvent) => void;
    relays?: string[];
    onEose?: () => void;
  }): SubscriptionHandle {
    const relays = params.relays && params.relays.length > 0 ? params.relays : this.defaultRelays;

    const sub = this.pool.subscribeMany(relays, params.filter, {
      onevent: (event: NostrEvent) => {
        try {
          params.onEvent(event);
        } catch (e) {
          console.error('[nostr-relay] Error in event handler:', e);
        }
      },
      oneose: params.onEose
    });

    const handle: SubscriptionHandle = {
      close: (reason) => {
        this.activeSubscriptions.delete(handle);
        try {
          sub.close(reason);
        } catch { /* best effort */ }
      }
    };

    this.activeSubscriptions.add(handle);
    return handle;
  }

  /**
   * Fetch latest profile metadata for a public key.
   */
  async fetchProfile(pubkeyHexOrNpub: string, relays?: string[]): Promise<NostrProfileMetadata | null> {
    const targetHex = pubkeyHexOrNpub.startsWith('npub1')
      ? decodeNpub(pubkeyHexOrNpub)
      : pubkeyHexOrNpub.trim().toLowerCase();

    const targetRelays = relays && relays.length > 0 ? relays : this.defaultRelays;

    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          sub.close();
          resolve(null);
        }
      }, 5000);

      const filter: Filter = {
        kinds: [0],
        authors: [targetHex],
        limit: 1
      };

      const sub = this.subscribe({
        relays: targetRelays,
        filter,
        onEvent: (event: NostrEvent) => {
          if (!resolved && event.kind === 0 && event.pubkey === targetHex) {
            resolved = true;
            clearTimeout(timeout);
            sub.close();
            resolve(parseAgentProfileContent(event.content));
          }
        },
        onEose: () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            sub.close();
            resolve(null);
          }
        }
      });
    });
  }

  /**
   * Close all active subscriptions and destroy the relay pool.
   */
  close(): void {
    for (const sub of this.activeSubscriptions) {
      try { sub.close(); } catch { /* noop */ }
    }
    this.activeSubscriptions.clear();
    try {
      this.pool.destroy();
    } catch { /* noop */ }
  }
}

/** Global default relay pool instance */
export const defaultRelayPool = new SovereignRelayPool();
