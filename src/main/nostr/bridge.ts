/**
 * SovereignHive Nostr Relay Router Bridge (Phase 3)
 *
 * Bridges the local Hive mailbox system (inbox/outbox) to decentralized Nostr relays:
 *   1. Outbox Egress: Intercepts messages addressed to remote Nostr identities (npub1... or hex pubkey),
 *      wraps them in NIP-59 encrypted gift wraps, and publishes them to the relay pool.
 *   2. Inbound Ingress: Subscribes to NIP-59 gift wraps across relays directed to active agents,
 *      authenticates sender signatures, unwraps payloads, and deposits them into local inboxes.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeNpub, decodeNpub } from './crypto';
import { wrapAgentMessage, unwrapAgentMessage } from './giftwrap';
import { NostrKeyVault, defaultVault } from './vault';
import { SovereignRelayPool, defaultRelayPool, type SubscriptionHandle } from './relayClient';
import type { NostrEvent } from './types';

export interface HiveMessageBridgeTarget {
  id: string;
  conversation: string;
  in_reply_to?: string | null;
  from: string;
  to: string;
  act: string;
  subject: string;
  body: string;
  hops: number;
  requires_reply: boolean;
  needs_human: boolean;
  created_at: string;
}

export interface IngressDeliveryOptions {
  agentDirResolver: (agentId: string) => string;
  onMessageReceived?: (msg: HiveMessageBridgeTarget, recipientAgentId: string) => void;
}

export class NostrRouterBridge {
  private vault: NostrKeyVault;
  private pool: SovereignRelayPool;
  private ingressSub: SubscriptionHandle | null = null;
  private deliveryOptions: IngressDeliveryOptions | null = null;
  private subscribedNpubs = new Set<string>();
  private processedEventIds = new Set<string>();

  constructor(opts?: { vault?: NostrKeyVault; pool?: SovereignRelayPool }) {
    this.vault = opts?.vault ?? defaultVault;
    this.pool = opts?.pool ?? defaultRelayPool;
  }

  /**
   * Check if a destination address represents a Nostr remote agent identity.
   */
  isNostrRecipient(to: string): boolean {
    if (!to || typeof to !== 'string') return false;
    const trimmed = to.trim();
    if (trimmed.startsWith('npub1') && trimmed.length >= 60) return true;
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return true;
    return false;
  }

  /**
   * Egress: Route an outgoing message from a local agent to a remote Nostr public key.
   */
  async routeOutboxToRelays(
    senderAgentId: string,
    message: HiveMessageBridgeTarget,
    targetRelays?: string[]
  ): Promise<{ success: boolean; relays: string[]; eventId?: string; error?: string }> {
    try {
      const senderKeyPair = this.vault.getKeyPair(senderAgentId);
      if (!senderKeyPair) {
        return {
          success: false,
          relays: [],
          error: `No Nostr keypair provisioned for sender agent "${senderAgentId}"`
        };
      }

      const recipientHex = message.to.startsWith('npub1')
        ? decodeNpub(message.to)
        : message.to.trim().toLowerCase();

      // Wrap message in NIP-59 Gift Wrap
      const giftWrap = wrapAgentMessage({
        senderSecretKey: senderKeyPair.secretKey,
        recipientPublicKeyHexOrNpub: recipientHex,
        content: message,
        tags: [
          ['e', message.conversation],
          ['client', 'SovereignHive']
        ]
      });

      // Publish to relays
      const pubResult = await this.pool.publish(giftWrap, targetRelays);

      return {
        success: pubResult.successfulRelays.length > 0,
        relays: pubResult.successfulRelays,
        eventId: giftWrap.id,
        error: pubResult.successfulRelays.length === 0
          ? `Failed to publish to any relay: ${pubResult.failedRelays.map((f) => `${f.url} (${f.error})`).join(', ')}`
          : undefined
      };
    } catch (err) {
      return {
        success: false,
        relays: [],
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  /**
   * Configure and start the inbound relay ingress listener for active agent identities.
   */
  startIngress(options: IngressDeliveryOptions, activeAgentIds: string[], relays?: string[]): void {
    this.deliveryOptions = options;
    this.updateIngressSubscriptions(activeAgentIds, relays);
  }

  /**
   * Update or refresh subscriptions when active agents are added or removed.
   */
  updateIngressSubscriptions(activeAgentIds: string[], relays?: string[]): void {
    const targetIdentities: Array<{ agentId: string; npub: string; publicKey: string }> = [];

    for (const agentId of activeAgentIds) {
      const id = this.vault.getIdentity(agentId);
      if (id) {
        targetIdentities.push({ agentId, npub: id.npub, publicKey: id.publicKey });
      }
    }

    if (targetIdentities.length === 0) {
      if (this.ingressSub) {
        this.ingressSub.close();
        this.ingressSub = null;
      }
      this.subscribedNpubs.clear();
      return;
    }

    const npubs = targetIdentities.map((i) => i.npub);
    const npubKey = npubs.sort().join(',');
    const currentKey = Array.from(this.subscribedNpubs).sort().join(',');

    // If identical subscription, avoid reconnect churn
    if (this.ingressSub && npubKey === currentKey) {
      return;
    }

    // Close previous subscription
    if (this.ingressSub) {
      this.ingressSub.close();
      this.ingressSub = null;
    }

    this.subscribedNpubs = new Set(npubs);

    this.ingressSub = this.pool.subscribeToGiftWraps({
      recipientPublicKeysHexOrNpubs: targetIdentities.map((i) => i.publicKey),
      relays,
      onEvent: (event: NostrEvent) => {
        this.handleInboundGiftWrap(event, targetIdentities);
      }
    });
  }

  /**
   * Process and unwrap an incoming relay gift wrap event.
   */
  handleInboundGiftWrap(
    giftWrapEvent: NostrEvent,
    knownIdentities: Array<{ agentId: string; npub: string; publicKey: string }>
  ): boolean {
    if (this.processedEventIds.has(giftWrapEvent.id)) {
      return false; // deduplicate already processed relay events
    }
    this.processedEventIds.add(giftWrapEvent.id);

    // Limit deduplication cache size
    if (this.processedEventIds.size > 2000) {
      const toDelete = Array.from(this.processedEventIds).slice(0, 500);
      for (const id of toDelete) this.processedEventIds.delete(id);
    }

    // Find matching recipient agent
    const pTag = giftWrapEvent.tags?.find((t) => t[0] === 'p')?.[1]?.toLowerCase();
    if (!pTag) return false;

    const matchingIdentity = knownIdentities.find(
      (i) => i.publicKey.toLowerCase() === pTag || decodeNpub(i.npub).toLowerCase() === pTag
    );
    if (!matchingIdentity) return false;

    const recipientKeyPair = this.vault.getKeyPair(matchingIdentity.agentId);
    if (!recipientKeyPair) return false;

    const unwrapped = unwrapAgentMessage(giftWrapEvent, recipientKeyPair.secretKey);
    if (!unwrapped) return false;

    const senderNpub = encodeNpub(unwrapped.senderPublicKey);

    // Parse payload into HiveMessage
    const partial = (unwrapped.parsedJson && typeof unwrapped.parsedJson === 'object'
      ? unwrapped.parsedJson
      : {}) as Partial<HiveMessageBridgeTarget>;

    const now = new Date(unwrapped.createdAt * 1000).toISOString();
    const hiveMsg: HiveMessageBridgeTarget = {
      id: partial.id ?? `nostr-${giftWrapEvent.id.slice(0, 12)}`,
      conversation: partial.conversation ?? `conv-nostr-${unwrapped.senderPublicKey.slice(0, 8)}`,
      in_reply_to: partial.in_reply_to ?? null,
      from: senderNpub,
      to: matchingIdentity.agentId,
      act: partial.act ?? 'inform',
      subject: partial.subject ?? `[Nostr Message from ${senderNpub.slice(0, 14)}...]`,
      body: typeof partial.body === 'string' ? partial.body : unwrapped.content,
      hops: typeof partial.hops === 'number' ? partial.hops : 0,
      requires_reply: partial.requires_reply ?? false,
      needs_human: partial.needs_human ?? false,
      created_at: partial.created_at ?? now
    };

    // Deposit message into target agent inbox
    if (this.deliveryOptions?.agentDirResolver) {
      const agentDir = this.deliveryOptions.agentDirResolver(matchingIdentity.agentId);
      const inboxDir = join(agentDir, 'inbox');
      try {
        if (!existsSync(inboxDir)) mkdirSync(inboxDir, { recursive: true });
        const filePath = join(inboxDir, `${hiveMsg.id}.json`);
        writeFileSync(filePath, JSON.stringify(hiveMsg, null, 2), 'utf8');
      } catch (err) {
        console.error(`[nostr-bridge] Failed to write inbound message to inbox for ${matchingIdentity.agentId}:`, err);
      }
    }

    try {
      this.deliveryOptions?.onMessageReceived?.(hiveMsg, matchingIdentity.agentId);
    } catch { /* best effort callback */ }

    return true;
  }

  /**
   * Stop the bridge and release subscriptions.
   */
  stop(): void {
    if (this.ingressSub) {
      this.ingressSub.close();
      this.ingressSub = null;
    }
    this.subscribedNpubs.clear();
  }
}
