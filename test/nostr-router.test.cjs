'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { NostrRouterBridge } = loadTs('src/main/nostr/bridge.ts');
const { NostrKeyVault } = loadTs('src/main/nostr/vault.ts');
const { generateAgentKeyPair, encodeNpub } = loadTs('src/main/nostr/crypto.ts');
const { wrapAgentMessage } = loadTs('src/main/nostr/giftwrap.ts');

test('NostrRouterBridge correctly classifies Nostr vs local recipients', () => {
  const bridge = new NostrRouterBridge();
  const kp = generateAgentKeyPair();

  assert.equal(bridge.isNostrRecipient('god'), false);
  assert.equal(bridge.isNostrRecipient('worker-alpha'), false);
  assert.equal(bridge.isNostrRecipient('broadcast'), false);
  assert.equal(bridge.isNostrRecipient('human'), false);

  assert.equal(bridge.isNostrRecipient(kp.npub), true);
  assert.equal(bridge.isNostrRecipient(kp.publicKey), true);
});

test('NostrRouterBridge routes outbox message to remote Nostr recipient', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sov-bridge-test-'));
  const vaultPath = path.join(tmpDir, 'vault.json');

  try {
    const vault = new NostrKeyVault({ customVaultPath: vaultPath });
    const localAgent = vault.ensureIdentity('architect');
    const remoteKeyPair = generateAgentKeyPair();

    // Mock relay pool
    const publishedEvents = [];
    const mockPool = {
      publish: async (event, relays) => {
        publishedEvents.push({ event, relays });
        return { successfulRelays: ['wss://mock.relay.org'], failedRelays: [] };
      }
    };

    const bridge = new NostrRouterBridge({ vault, pool: mockPool });

    const msg = {
      id: 'msg-local-1',
      conversation: 'conv-test-1',
      from: 'architect',
      to: remoteKeyPair.npub,
      act: 'request',
      subject: 'Review remote module',
      body: 'Please run security analysis',
      hops: 0,
      requires_reply: true,
      needs_human: false,
      created_at: new Date().toISOString()
    };

    const res = await bridge.routeOutboxToRelays('architect', msg);
    assert.equal(res.success, true);
    assert.equal(res.relays.length, 1);
    assert.equal(publishedEvents.length, 1);
    assert.equal(publishedEvents[0].event.kind, 1059);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }
  }
});

test('NostrRouterBridge ingests inbound relay gift wrap and deposits into agent inbox', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sov-bridge-test-'));
  const vaultPath = path.join(tmpDir, 'vault.json');
  const agentHome = path.join(tmpDir, 'agents', 'worker-1');
  fs.mkdirSync(path.join(agentHome, 'inbox'), { recursive: true });

  try {
    const vault = new NostrKeyVault({ customVaultPath: vaultPath });
    const localWorker = vault.ensureIdentity('worker-1');
    const remoteSender = generateAgentKeyPair();

    const bridge = new NostrRouterBridge({ vault });
    let receivedCallback = null;

    bridge.startIngress(
      {
        agentDirResolver: (id) => path.join(tmpDir, 'agents', id),
        onMessageReceived: (msg, recipientId) => {
          receivedCallback = { msg, recipientId };
        }
      },
      ['worker-1']
    );

    // Create incoming gift wrap from remote sender to local worker
    const remotePayload = {
      id: 'remote-task-99',
      conversation: 'conv-remote-1',
      act: 'request',
      subject: 'Distributed Task: Run Benchmark',
      body: 'Execute distributed benchmark test across Nostr mesh'
    };

    const giftWrap = wrapAgentMessage({
      senderSecretKey: remoteSender.secretKey,
      recipientPublicKeyHexOrNpub: localWorker.npub,
      content: remotePayload
    });

    const knownIdentities = [{ agentId: 'worker-1', npub: localWorker.npub, publicKey: localWorker.publicKey }];
    const handled = bridge.handleInboundGiftWrap(giftWrap, knownIdentities);
    assert.equal(handled, true);

    // Verify callback was fired
    assert.ok(receivedCallback !== null);
    assert.equal(receivedCallback.recipientId, 'worker-1');
    assert.equal(receivedCallback.msg.id, 'remote-task-99');
    assert.equal(receivedCallback.msg.from, remoteSender.npub);
    assert.equal(receivedCallback.msg.subject, 'Distributed Task: Run Benchmark');

    // Verify inbox file was deposited
    const inboxFile = path.join(agentHome, 'inbox', 'remote-task-99.json');
    assert.ok(fs.existsSync(inboxFile), 'Inbox file must be written to disk');
    const diskMsg = JSON.parse(fs.readFileSync(inboxFile, 'utf8'));
    assert.equal(diskMsg.id, 'remote-task-99');
    assert.equal(diskMsg.from, remoteSender.npub);
    assert.equal(diskMsg.to, 'worker-1');

    // Deduplication test: re-handling the same event ID should return false and not re-process
    const duplicateHandled = bridge.handleInboundGiftWrap(giftWrap, knownIdentities);
    assert.equal(duplicateHandled, false);

    bridge.stop();
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }
  }
});
