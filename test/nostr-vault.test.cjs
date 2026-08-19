'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { NostrKeyVault } = loadTs('src/main/nostr/vault.ts');
const { generateAgentKeyPair } = loadTs('src/main/nostr/crypto.ts');

test('NostrKeyVault stores, retrieves, and isolates agent keypairs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sov-vault-test-'));
  const vaultPath = path.join(tmpDir, 'test-vault.json');

  try {
    const vault = new NostrKeyVault({ customVaultPath: vaultPath });

    const kp1 = generateAgentKeyPair();
    const kp2 = generateAgentKeyPair();

    // Store agent 1
    const identity1 = vault.storeKeyPair('agent-alpha', kp1, { nip05: 'alpha@slothy.win' });
    assert.equal(identity1.agentId, 'agent-alpha');
    assert.equal(identity1.npub, kp1.npub);
    assert.equal(identity1.publicKey, kp1.publicKey);
    assert.equal(identity1.nip05, 'alpha@slothy.win');

    // Store agent 2
    const identity2 = vault.storeKeyPair('agent-beta', kp2);
    assert.equal(identity2.agentId, 'agent-beta');
    assert.equal(identity2.npub, kp2.npub);

    // Has keys
    assert.equal(vault.hasKey('agent-alpha'), true);
    assert.equal(vault.hasKey('agent-beta'), true);
    assert.equal(vault.hasKey('agent-gamma'), false);

    // Retrieve keys
    const retrieved1 = vault.getKeyPair('agent-alpha');
    assert.ok(retrieved1 !== null);
    assert.equal(retrieved1.npub, kp1.npub);
    assert.equal(retrieved1.publicKey, kp1.publicKey);
    assert.deepEqual(retrieved1.secretKey, kp1.secretKey);

    const retrieved2 = vault.getKeyPair('agent-beta');
    assert.ok(retrieved2 !== null);
    assert.equal(retrieved2.npub, kp2.npub);
    assert.deepEqual(retrieved2.secretKey, kp2.secretKey);

    // List public identities
    const list = vault.listIdentities();
    assert.equal(list.length, 2);
    const alphaRecord = list.find((i) => i.agentId === 'agent-alpha');
    assert.ok(alphaRecord);
    assert.equal(alphaRecord.npub, kp1.npub);

    // Delete key
    assert.equal(vault.deleteKeyPair('agent-alpha'), true);
    assert.equal(vault.hasKey('agent-alpha'), false);
    assert.equal(vault.getKeyPair('agent-alpha'), null);
    assert.equal(vault.listIdentities().length, 1);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }
  }
});

test('NostrKeyVault ensureIdentity generates keypair on demand and is idempotent', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sov-vault-test-'));
  const vaultPath = path.join(tmpDir, 'test-vault.json');

  try {
    const vault = new NostrKeyVault({ customVaultPath: vaultPath });

    // First call generates
    const identity1 = vault.ensureIdentity('orchestrator', { nip05: 'orchestrator@slothy.win' });
    assert.equal(identity1.agentId, 'orchestrator');
    assert.ok(identity1.npub.startsWith('npub1'));

    // Second call returns existing
    const identity2 = vault.ensureIdentity('orchestrator');
    assert.equal(identity2.npub, identity1.npub);
    assert.equal(identity2.publicKey, identity1.publicKey);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }
  }
});
