import assert from 'node:assert/strict';

import {
  createEncryptedPayload,
  decryptPayload,
} from '../info/plan/iberian-passage-2026/crypto.js';

const plaintext = 'A non-sensitive itinerary fixture.';
const passphrase = 'test-only-passphrase-2026';
const payload = await createEncryptedPayload(plaintext, passphrase, 100000);

assert.equal(payload.algorithm, 'AES-GCM');
assert.equal(payload.kdf, 'PBKDF2');
assert.equal(await decryptPayload(payload, passphrase), plaintext);
await assert.rejects(() => decryptPayload(payload, 'different-test-passphrase'));

console.log('Itinerary crypto round-trip passed.');
