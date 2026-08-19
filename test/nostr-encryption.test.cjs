'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const { generateAgentKeyPair } = loadTs('src/main/nostr/crypto.ts');
const {
  getConversationKey,
  encryptNip44,
  decryptNip44,
  encryptForPeer,
  decryptFromPeer
} = loadTs('src/main/nostr/encryption.ts');

test('NIP-44 conversation key is symmetric', () => {
  const alice = generateAgentKeyPair();
  const bob = generateAgentKeyPair();

  const keyAliceToBob = getConversationKey(alice.secretKey, bob.publicKey);
  const keyBobToAlice = getConversationKey(bob.secretKey, alice.publicKey);

  assert.deepEqual(keyAliceToBob, keyBobToAlice);
});

test('NIP-44 conversation key accepts npub identifier', () => {
  const alice = generateAgentKeyPair();
  const bob = generateAgentKeyPair();

  const keyFromHex = getConversationKey(alice.secretKey, bob.publicKey);
  const keyFromNpub = getConversationKey(alice.secretKey, bob.npub);

  assert.deepEqual(keyFromHex, keyFromNpub);
});

test('NIP-44 encryption and decryption roundtrip for plain text', () => {
  const alice = generateAgentKeyPair();
  const bob = generateAgentKeyPair();

  const message = 'Hello Bob, please execute the task in /src/main/hive.ts';
  const ciphertext = encryptForPeer(message, alice.secretKey, bob.publicKey);

  assert.notEqual(ciphertext, message);
  assert.ok(typeof ciphertext === 'string');

  const decrypted = decryptFromPeer(ciphertext, bob.secretKey, alice.publicKey);
  assert.equal(decrypted, message);
});

test('NIP-44 handles unicode, multiline code, and large JSON payloads', () => {
  const alice = generateAgentKeyPair();
  const bob = generateAgentKeyPair();

  const payload = JSON.stringify({
    id: 'msg-98234-xyz',
    act: 'request',
    subject: 'Refactor Nostr Relay Integration 🚀 ⚡',
    body: '```typescript\nexport const MESH = true;\n```\nEmojis: 🧠🐝🔑🔒',
    data: Array.from({ length: 100 }, (_, i) => ({ step: i, hash: `hash-${i}` }))
  });

  const ciphertext = encryptForPeer(payload, alice.secretKey, bob.npub);
  const decrypted = decryptFromPeer(ciphertext, bob.secretKey, alice.npub);

  assert.equal(decrypted, payload);
  const parsed = JSON.parse(decrypted);
  assert.equal(parsed.act, 'request');
  assert.equal(parsed.data.length, 100);
});

test('NIP-44 decryption fails with wrong secret key or mismatched peer', () => {
  const alice = generateAgentKeyPair();
  const bob = generateAgentKeyPair();
  const eve = generateAgentKeyPair();

  const message = 'Top secret coordinates';
  const ciphertext = encryptForPeer(message, alice.secretKey, bob.publicKey);

  // Eve attempts to decrypt with her own key
  assert.throws(() => {
    decryptFromPeer(ciphertext, eve.secretKey, alice.publicKey);
  });

  // Bob attempts to decrypt claiming it came from Eve
  assert.throws(() => {
    decryptFromPeer(ciphertext, bob.secretKey, eve.publicKey);
  });
});
