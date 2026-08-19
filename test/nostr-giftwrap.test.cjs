'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { generateAgentKeyPair, verifyNostrEvent } = loadTs('src/main/nostr/crypto.ts');
const { wrapAgentMessage, unwrapAgentMessage } = loadTs('src/main/nostr/giftwrap.ts');

test('NIP-59 wrapAgentMessage produces valid kind 1059 event with privacy properties', () => {
  const alice = generateAgentKeyPair();
  const bob = generateAgentKeyPair();

  const payload = {
    act: 'request',
    subject: 'Task: Review Pull Request',
    body: 'Please review and run test suite.'
  };

  const giftWrap = wrapAgentMessage({
    senderSecretKey: alice.secretKey,
    recipientPublicKeyHexOrNpub: bob.publicKey,
    content: payload,
    tags: [['e', 'conversation-123']]
  });

  // Check external gift wrap metadata
  assert.equal(giftWrap.kind, 1059);
  assert.notEqual(giftWrap.pubkey, alice.publicKey, 'Relays must not see Alice true public key');
  assert.notEqual(giftWrap.pubkey, bob.publicKey, 'Relays must not see Bob public key as author');
  assert.ok(typeof giftWrap.sig === 'string' && giftWrap.sig.length === 128);
  assert.equal(verifyNostrEvent(giftWrap), true, 'Gift wrap must be a valid Schnorr-signed event');

  // Check tags exposed to relay: only recipient p tag
  const pTags = giftWrap.tags.filter((t) => t[0] === 'p');
  assert.equal(pTags.length, 1);
  assert.equal(pTags[0][1], bob.publicKey, 'Gift wrap must tag recipient public key for relay indexing');
});

test('NIP-59 unwrapAgentMessage extracts rumor and authenticates real sender', () => {
  const alice = generateAgentKeyPair();
  const bob = generateAgentKeyPair();

  const payload = {
    act: 'inform',
    subject: 'Status update',
    body: 'Task completed successfully with zero errors.'
  };

  const giftWrap = wrapAgentMessage({
    senderSecretKey: alice.secretKey,
    recipientPublicKeyHexOrNpub: bob.npub,
    content: payload
  });

  const unwrapped = unwrapAgentMessage(giftWrap, bob.secretKey);
  assert.ok(unwrapped !== null);
  assert.equal(unwrapped.senderPublicKey, alice.publicKey, 'Unwrapped sender must be Alice true public key');
  assert.equal(unwrapped.recipientPublicKey, bob.publicKey);
  assert.equal(unwrapped.kind, 14);
  assert.deepEqual(unwrapped.parsedJson, payload);
});

test('NIP-59 unwrap fails when non-recipient tries to decrypt', () => {
  const alice = generateAgentKeyPair();
  const bob = generateAgentKeyPair();
  const eve = generateAgentKeyPair();

  const giftWrap = wrapAgentMessage({
    senderSecretKey: alice.secretKey,
    recipientPublicKeyHexOrNpub: bob.publicKey,
    content: 'Secret instructions'
  });

  // Eve attempts to unwrap
  const unwrappedByEve = unwrapAgentMessage(giftWrap, eve.secretKey);
  assert.equal(unwrappedByEve, null, 'Decryption by non-recipient must return null');
});

test('NIP-59 unwrap returns null for non-1059 events or malformed payload', () => {
  const alice = generateAgentKeyPair();
  const fakeEvent = {
    id: '123',
    pubkey: alice.publicKey,
    created_at: 1000,
    kind: 1,
    tags: [],
    content: 'not a gift wrap',
    sig: 'abc'
  };

  assert.equal(unwrapAgentMessage(fakeEvent, alice.secretKey), null);
});
