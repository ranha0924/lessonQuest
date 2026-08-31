import { createHash as nodeHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseGeneratedScienceSpec } from '../../../packages/science-studio/src/parser.js';
import {
  buildScienceArtifact,
  serializeScienceArtifact,
} from '../../../packages/science-studio/src/artifact.js';
import { createHttpLessonQuestApi } from '../src/api-client.js';

afterEach(() => vi.unstubAllGlobals());

describe('browser preview compatibility', () => {
  it('honors an injected failing transport instead of calling the network', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('Unexpected network')));
    const api = createHttpLessonQuestApi({
      baseUrl: 'https://preview.lessonquest.invalid',
      getAuthorization: () => 'Bearer synthetic',
      fetch: () => Promise.reject(new Error('Injected transport failure')),
    });
    await expect(
      api.listStudentAssignments('018f72a4-cc52-7c5a-a6f9-8b21aa27fb01'),
    ).rejects.toThrow('Injected transport failure');
  });

  it('preserves injected request credentials, JSON and response validation', async () => {
    const api = createHttpLessonQuestApi({
      baseUrl: 'https://preview.lessonquest.invalid',
      getAuthorization: () => 'Bearer fixed-teacher',
      fetch: (input, init) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        expect(url).toBe(
          'https://preview.lessonquest.invalid/organizations/018f72a4-cc52-7c5a-a6f9-8b21aa27fb01/experiences/science',
        );
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fixed-teacher');
        expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
        expect(init?.method).toBe('POST');
        if (typeof init?.body !== 'string') throw new TypeError('Expected JSON request body');
        expect(JSON.parse(init.body)).toEqual({ title: '샘플', generatedSpecText: '{}' });
        return Promise.resolve(Response.json({ malformed: true }));
      },
    });
    await expect(
      api.createScienceExperience('018f72a4-cc52-7c5a-a6f9-8b21aa27fb01', {
        title: '샘플',
        generatedSpecText: '{}',
      }),
    ).rejects.toMatchObject({ name: 'ZodError' });
  });

  it('provides the narrow SHA-256 adapter with Node-equivalent UTF-8 chunk hashing', async () => {
    const adapter = await import('../src/dev-preview/browser-crypto.js').catch(() => null);
    expect(adapter, 'The browser preview must provide its crypto adapter').not.toBeNull();
    if (adapter === null) return;
    expect(adapter.createHash('sha256').update('abc').digest('hex')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(adapter.createHash('sha256').digest('hex')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(adapter.createHash('sha256').update('과학', 'utf8').update('🔬').digest('hex')).toBe(
      nodeHash('sha256').update('과학').update('🔬').digest('hex'),
    );
    expect(adapter.randomUUID()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(() => adapter.createHash('sha512')).toThrow();
    expect(() => adapter.createHash('sha256').update('abc', 'latin1')).toThrow();
    expect(() => adapter.createHash('sha256').digest('base64')).toThrow();
    const finalized = adapter.createHash('sha256');
    finalized.digest('hex');
    expect(() => finalized.update('late')).toThrow();
    const fixture = await readFile(
      new URL('../../../packages/science-studio/test/fixtures/force-motion.json', import.meta.url),
      'utf8',
    );
    const artifact = buildScienceArtifact(parseGeneratedScienceSpec(fixture));
    expect(
      adapter.createHash('sha256').update(serializeScienceArtifact(artifact), 'utf8').digest('hex'),
    ).toBe('821b433ddb62f2fb4ae305a379f1ef5633e50892c336112049118f7c1d1a1043');
  });
});
