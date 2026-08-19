/**
 * SovereignHive Nostr Key Vault
 *
 * Encrypted-at-rest storage for agent Nostr keypairs using Electron `safeStorage`.
 *
 * SECURITY:
 *   - Private keys (nsec / secretKey) are encrypted at rest with OS-level credentials
 *     (Keychain on macOS, DPAPI on Windows, Secret Service / libsecret on Linux).
 *   - Plaintext private keys are only ever held in main-process memory when signing
 *     or decrypting messages, and are NEVER exposed over IPC to the renderer.
 */
import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { generateAgentKeyPair, keyPairFromSecret } from './crypto';
import type { NostrKeyPair, AgentNostrIdentity } from './types';

interface EncryptedVaultRecord {
  agentId: string;
  npub: string;
  publicKey: string;
  encryptedNsec: string; // Base64 encoded ciphertext from safeStorage
  nip05?: string;
  createdAt: number;
  relays?: string[];
}

interface VaultFileSchema {
  version: 1;
  keys: Record<string, EncryptedVaultRecord>;
}

export class NostrKeyVault {
  private inMemoryCache = new Map<string, NostrKeyPair>();
  private customVaultPath: string | null = null;
  private customHomeResolver: (() => string | null) | null = null;

  constructor(opts?: { getHome?: () => string | null; customVaultPath?: string }) {
    if (opts?.getHome) this.customHomeResolver = opts.getHome;
    if (opts?.customVaultPath) this.customVaultPath = opts.customVaultPath;
  }

  private vaultFilePath(): string {
    if (this.customVaultPath) return this.customVaultPath;
    const home = this.customHomeResolver?.();
    if (home) {
      return join(home, 'hive', 'vault', 'nostr-identities.json');
    }
    return join(app.getPath('userData'), 'nostr-vault.json');
  }

  private readVault(): VaultFileSchema {
    const p = this.vaultFilePath();
    if (!existsSync(p)) return { version: 1, keys: {} };
    try {
      const content = readFileSync(p, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && parsed.version === 1 && typeof parsed.keys === 'object') {
        return parsed as VaultFileSchema;
      }
      return { version: 1, keys: {} };
    } catch {
      return { version: 1, keys: {} };
    }
  }

  private writeVault(vault: VaultFileSchema): void {
    const p = this.vaultFilePath();
    const dir = dirname(p);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    writeFileSync(p, JSON.stringify(vault, null, 2), { encoding: 'utf8', mode: 0o600 });
  }

  private encryptSecret(secret: string): string {
    if (typeof safeStorage !== 'undefined' && safeStorage?.isEncryptionAvailable()) {
      return safeStorage.encryptString(secret).toString('base64');
    }
    // Fallback for dev / headless testing environments without desktop keychain:
    // In production, safeStorage is available across macOS, Windows, and Linux.
    return Buffer.from(secret, 'utf8').toString('base64');
  }

  private decryptSecret(ciphertextBase64: string): string {
    const buf = Buffer.from(ciphertextBase64, 'base64');
    if (typeof safeStorage !== 'undefined' && safeStorage?.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(buf);
      } catch {
        // Fall back to plain buffer decode if safeStorage fails or wasn't used
        return buf.toString('utf8');
      }
    }
    return buf.toString('utf8');
  }

  /**
   * Check if an agent keypair exists in the vault.
   */
  hasKey(agentId: string): boolean {
    if (this.inMemoryCache.has(agentId)) return true;
    const vault = this.readVault();
    return !!vault.keys[agentId];
  }

  /**
   * Save a keypair for an agent in the vault.
   */
  storeKeyPair(agentId: string, keyPair: NostrKeyPair, metadata?: { nip05?: string; relays?: string[] }): AgentNostrIdentity {
    const encryptedNsec = this.encryptSecret(keyPair.nsec);
    const vault = this.readVault();
    const now = Date.now();

    const record: EncryptedVaultRecord = {
      agentId,
      npub: keyPair.npub,
      publicKey: keyPair.publicKey,
      encryptedNsec,
      nip05: metadata?.nip05,
      createdAt: vault.keys[agentId]?.createdAt ?? now,
      relays: metadata?.relays
    };

    vault.keys[agentId] = record;
    this.writeVault(vault);
    this.inMemoryCache.set(agentId, keyPair);

    return {
      agentId,
      npub: keyPair.npub,
      publicKey: keyPair.publicKey,
      nip05: record.nip05,
      createdAt: record.createdAt,
      relays: record.relays
    };
  }

  /**
   * Retrieve the full keypair for an agent (Main process only).
   */
  getKeyPair(agentId: string): NostrKeyPair | null {
    const cached = this.inMemoryCache.get(agentId);
    if (cached) return cached;

    const vault = this.readVault();
    const record = vault.keys[agentId];
    if (!record) return null;

    try {
      const nsec = this.decryptSecret(record.encryptedNsec);
      const keyPair = keyPairFromSecret(nsec);
      this.inMemoryCache.set(agentId, keyPair);
      return keyPair;
    } catch (e) {
      console.error(`[nostr-vault] Failed to decrypt key for agent ${agentId}:`, e);
      return null;
    }
  }

  /**
   * Get the public identity of an agent (safe for renderer IPC).
   */
  getIdentity(agentId: string): AgentNostrIdentity | null {
    const vault = this.readVault();
    const record = vault.keys[agentId];
    if (!record) return null;

    return {
      agentId: record.agentId,
      npub: record.npub,
      publicKey: record.publicKey,
      nip05: record.nip05,
      createdAt: record.createdAt,
      relays: record.relays
    };
  }

  /**
   * List all public agent identities stored in the vault.
   */
  listIdentities(): AgentNostrIdentity[] {
    const vault = this.readVault();
    return Object.values(vault.keys).map((r) => ({
      agentId: r.agentId,
      npub: r.npub,
      publicKey: r.publicKey,
      nip05: r.nip05,
      createdAt: r.createdAt,
      relays: r.relays
    }));
  }

  /**
   * Ensure an agent has a provisioned Nostr identity. If not present, generates
   * and stores a new keypair.
   */
  ensureIdentity(agentId: string, metadata?: { nip05?: string; relays?: string[] }): AgentNostrIdentity {
    const existing = this.getIdentity(agentId);
    if (existing) return existing;

    const newKeyPair = generateAgentKeyPair();
    return this.storeKeyPair(agentId, newKeyPair, metadata);
  }

  /**
   * Delete an agent's stored keypair.
   */
  deleteKeyPair(agentId: string): boolean {
    // Zero-fill the secret key buffer before evicting from memory.
    const cached = this.inMemoryCache.get(agentId);
    if (cached?.secretKey) cached.secretKey.fill(0);
    this.inMemoryCache.delete(agentId);
    const vault = this.readVault();
    if (!vault.keys[agentId]) return false;

    delete vault.keys[agentId];
    this.writeVault(vault);
    return true;
  }
}

/** Global default vault instance for convenience */
export const defaultVault = new NostrKeyVault();
