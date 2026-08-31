import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

// Exact preview-build adapter for the synchronous calls made by our repositories.
// Normal Node builds continue to import node:crypto; this is not a general polyfill.
export function createHash(algorithm: string) {
  if (algorithm !== 'sha256') throw new TypeError('Unsupported preview hash algorithm');
  const hash = sha256.create();
  let finalized = false;
  const adapter = {
    update(input: string, encoding = 'utf8') {
      if (finalized || encoding !== 'utf8' || typeof input !== 'string') {
        throw new TypeError('Unsupported preview hash update');
      }
      hash.update(new TextEncoder().encode(input));
      return adapter;
    },
    digest(encoding: string) {
      if (finalized || encoding !== 'hex') throw new TypeError('Unsupported preview hash digest');
      finalized = true;
      return bytesToHex(hash.digest());
    },
  };
  return adapter;
}

export function randomUUID() {
  return globalThis.crypto.randomUUID();
}
