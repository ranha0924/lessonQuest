import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { setImmediate } from 'node:timers/promises';

if (process.argv[2] === 'runtime') {
  const { createServerHandler } = await import('@lessonquest/api/server-runtime');
  const handler = createServerHandler();
  for (const [route, status, code] of [
    ['/api/session', 503, 'SERVER_NOT_READY'],
    ['/api/unknown', 404, 'RESOURCE_NOT_FOUND'],
    ['/api/session?path=forged', 404, 'RESOURCE_NOT_FOUND'],
  ]) {
    const response = await handler(new globalThis.Request('https://example.test' + route));
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).error.code, code);
  }
  process.stdout.write('runtime-safe\n');
} else if (process.argv[2] === 'jwks') {
  const apiRequire = createRequire(path.resolve('services/api/package.json'));
  const adminRequire = createRequire(apiRequire.resolve('firebase-admin/app'));
  const jwksRsa = adminRequire('jwks-rsa');
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const keys = [
    { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'rsa', alg: 'RS256', use: 'sig' },
    { ...ec.publicKey.export({ format: 'jwk' }), kid: 'ec', alg: 'ES256', use: 'sig' },
    { ...rsa.privateKey.export({ format: 'jwk' }), kid: 'private', alg: 'RS256' },
    { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'encryption', use: 'enc' },
    { kty: 'RSA', kid: 'broken', alg: 'RS256' },
  ];
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ keys }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const options = { jwksUri: `http://127.0.0.1:${address.port}/keys`, cache: false };
    const client = jwksRsa(options);
    const signingKeys = await client.getSigningKeys();
    assert.deepEqual(signingKeys.map((key) => key.kid).sort(), ['ec', 'rsa']);
    for (const [kid, pair] of [
      ['rsa', rsa],
      ['ec', ec],
    ]) {
      const key = await client.getSigningKey(kid);
      const payload = Buffer.from('F02 synthetic signature fixture');
      const signature = sign('sha256', payload, pair.privateKey);
      assert.equal(verify('sha256', payload, key.getPublicKey(), signature), true);
      assert.equal(verify('sha256', Buffer.from('tampered'), key.getPublicKey(), signature), false);
    }
    await assert.rejects(client.getSigningKey('missing'), { name: 'SigningKeyNotFoundError' });
    const provider = jwksRsa.passportJwtSecret(options);
    const token = (alg, kid) => {
      const header = Buffer.from(JSON.stringify({ alg, kid })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'synthetic-only' })).toString('base64url');
      const data = `${header}.${payload}`;
      return data + '.' + sign('sha256', Buffer.from(data), rsa.privateKey).toString('base64url');
    };
    for (const [raw, valid] of [
      [token('RS256', 'rsa'), true],
      ['malformed', false],
      [token('none', 'rsa'), false],
      [token('RS256', 'missing'), false],
    ]) {
      let calls = 0;
      const result = await new Promise((resolve, reject) => {
        Promise.resolve(
          provider({}, raw, (error, key) => {
            calls += 1;
            if (error) reject(error);
            else resolve(key);
          }),
        ).catch(reject);
      });
      await setImmediate();
      assert.equal(calls, 1);
      assert.equal(Boolean(result), valid);
      if (valid) {
        const [header, payload, signature] = raw.split('.');
        assert.equal(
          verify(
            'sha256',
            Buffer.from(`${header}.${payload}`),
            result,
            Buffer.from(signature, 'base64url'),
          ),
          true,
        );
      }
    }
    process.stdout.write('jwks-rsa-ec-negative-passport-safe\n');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
} else {
  throw new Error('Unknown fixture mode');
}
