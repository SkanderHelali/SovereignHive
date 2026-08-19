'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const {
  generateAgentKeyPair,
  keyPairFromSecret,
  encodeNpub,
  decodeNpub,
  encodeNsec,
  decodeNsec,
  toHex,
  fromHex,
  signEvent,
  verifyNostrEvent
} = loadTs('src/main/nostr/crypto.ts');

const {
  buildAgentProfileEvent,
  parseAgentProfileContent
} = loadTs('src/main/nostr/profile.ts');

test('generateAgentKeyPair produces valid secp256k1 keypair and bech32 encodings', () => {
  const kp = generateAgentKeyPair();
  assert.equal(kp.secretKey.length, 32);
  assert.equal(typeof kp.publicKey, 'string');
  assert.equal(kp.publicKey.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(kp.publicKey));
  assert.ok(kp.npub.startsWith('npub1'));
  assert.ok(kp.nsec.startsWith('nsec1'));
});

test('keyPairFromSecret restores keypair from Uint8Array, hex, and nsec', () => {
  const original = generateAgentKeyPair();

  // From Uint8Array
  const fromBytes = keyPairFromSecret(original.secretKey);
  assert.equal(fromBytes.publicKey, original.publicKey);
  assert.equal(fromBytes.npub, original.npub);
  assert.equal(fromBytes.nsec, original.nsec);

  // From hex string
  const hex = toHex(original.secretKey);
  const fromHexStr = keyPairFromSecret(hex);
  assert.equal(fromHexStr.publicKey, original.publicKey);
  assert.equal(fromHexStr.npub, original.npub);

  // From nsec string
  const fromNsec = keyPairFromSecret(original.nsec);
  assert.equal(fromNsec.publicKey, original.publicKey);
  assert.equal(fromNsec.npub, original.npub);
});

test('npub encode and decode roundtrip', () => {
  const kp = generateAgentKeyPair();
  const encoded = encodeNpub(kp.publicKey);
  assert.equal(encoded, kp.npub);
  const decoded = decodeNpub(encoded);
  assert.equal(decoded, kp.publicKey);
});

test('nsec encode and decode roundtrip', () => {
  const kp = generateAgentKeyPair();
  const encoded = encodeNsec(kp.secretKey);
  assert.equal(encoded, kp.nsec);
  const decoded = decodeNsec(encoded);
  assert.deepEqual(decoded, kp.secretKey);
});

test('signEvent creates a valid Schnorr-signed Nostr event', () => {
  const kp = generateAgentKeyPair();
  const template = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', kp.publicKey]],
    content: 'Hello SovereignHive'
  };

  const event = signEvent(template, kp.secretKey);
  assert.equal(event.pubkey, kp.publicKey);
  assert.equal(typeof event.id, 'string');
  assert.equal(event.id.length, 64);
  assert.equal(typeof event.sig, 'string');
  assert.equal(event.sig.length, 128);
  assert.equal(verifyNostrEvent(event), true);
});

test('verifyNostrEvent detects tampered events', () => {
  const kp = generateAgentKeyPair();
  const template = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: 'Genuine message'
  };

  const event = signEvent(template, kp.secretKey);
  assert.equal(verifyNostrEvent(event), true);

  // Tamper with content without copying internal symbol cache
  const tampered = {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags,
    sig: event.sig,
    content: 'Tampered message'
  };
  assert.equal(verifyNostrEvent(tampered), false);
});

test('buildAgentProfileEvent creates valid NIP-01 Kind 0 profile event', () => {
  const kp = generateAgentKeyPair();
  const profile = {
    name: 'Sovereign Agent 01',
    about: 'Autonomous code review and architecture specialist',
    picture: 'https://slothy.win/avatar.png',
    nip05: 'agent01@slothy.win',
    bot: true
  };

  const event = buildAgentProfileEvent(kp.secretKey, profile);
  assert.equal(event.kind, 0);
  assert.equal(event.pubkey, kp.publicKey);
  assert.equal(verifyNostrEvent(event), true);

  const parsed = parseAgentProfileContent(event.content);
  assert.ok(parsed !== null);
  assert.equal(parsed.name, 'Sovereign Agent 01');
  assert.equal(parsed.about, 'Autonomous code review and architecture specialist');
  assert.equal(parsed.picture, 'https://slothy.win/avatar.png');
  assert.equal(parsed.nip05, 'agent01@slothy.win');
  assert.equal(parsed.bot, true);
});
