'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { SovereignRelayPool } = loadTs('src/main/nostr/relayClient.ts');
const { DEFAULT_NOSTR_RELAYS } = loadTs('src/main/nostr/types.ts');

test('SovereignRelayPool initializes with default relays and allows customization', () => {
  const pool = new SovereignRelayPool();
  const defaults = pool.getDefaultRelays();
  assert.ok(defaults.length >= 3);
  assert.ok(defaults.includes('wss://relay.damus.io'));

  pool.setDefaultRelays(['wss://custom.relay.local', 'wss://nos.lol']);
  assert.deepEqual(pool.getDefaultRelays(), ['wss://custom.relay.local', 'wss://nos.lol']);

  pool.close();
});

const { generateAgentKeyPair } = loadTs('src/main/nostr/crypto.ts');

test('SovereignRelayPool closes active subscriptions cleanly', () => {
  const pool = new SovereignRelayPool(['wss://relay.damus.io']);
  const kp = generateAgentKeyPair();

  const sub = pool.subscribeToGiftWraps({
    recipientPublicKeysHexOrNpubs: [kp.npub],
    onEvent: () => {}
  });

  assert.ok(typeof sub.close === 'function');
  sub.close();
  pool.close();
});
