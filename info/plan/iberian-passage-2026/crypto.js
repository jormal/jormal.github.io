const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function deriveKey(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    material,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

function validatePayload(payload) {
  if (
    payload?.version !== 1 ||
    payload.algorithm !== 'AES-GCM' ||
    payload.kdf !== 'PBKDF2' ||
    payload.hash !== 'SHA-256' ||
    !Number.isSafeInteger(payload.iterations) ||
    payload.iterations < 100000 ||
    typeof payload.salt !== 'string' ||
    typeof payload.iv !== 'string' ||
    typeof payload.ciphertext !== 'string'
  ) {
    throw new Error('Unsupported protected itinerary payload.');
  }
}

export async function createEncryptedPayload(plaintext, passphrase, iterations = 600000) {
  if (!plaintext || !passphrase || !Number.isSafeInteger(iterations) || iterations < 100000) {
    throw new Error('A plaintext, passphrase, and safe iteration count are required.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    textEncoder.encode(plaintext),
  );

  return {
    version: 1,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptPayload(payload, passphrase) {
  validatePayload(payload);

  if (!passphrase) throw new Error('A passphrase is required.');

  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const key = await deriveKey(passphrase, salt, payload.iterations);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    ciphertext,
  );

  return textDecoder.decode(plaintext);
}
