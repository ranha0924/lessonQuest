import { describe, expect, it } from 'vitest';

import { experienceManifestSchema } from '../src/manifest.js';

const approvedManifest = {
  schemaVersion: 1,
  id: 'science_inertia_01',
  version: 1,
  title: '급정거하는 버스',
  subject: 'science',
  gradeBands: ['middle1'],
  type: 'simulation',
  entrypoint: '/runner/science_inertia_01/1',
  organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c201',
  authorId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c202',
  status: 'approved',
  learningObjectives: ['관성을 실제 상황에 적용한다'],
  capabilities: ['quiz', 'rasa', 'class_boss'],
  createdWithAI: true,
  contentHash: `sha256:${'a'.repeat(64)}`,
} as const;

describe('experienceManifestSchema', () => {
  it('accepts an immutable approved manifest', () => {
    expect(experienceManifestSchema.parse(approvedManifest)).toEqual(approvedManifest);
  });

  it.each([
    'https://evil.example/x',
    '//evil.example/x',
    '/runner/../admin',
    '/runner\\evil',
    '/runner/%2e%2e/admin',
  ])('rejects unsafe entrypoint %s', (entrypoint) => {
    expect(() => experienceManifestSchema.parse({ ...approvedManifest, entrypoint })).toThrow();
  });

  it('rejects a draft manifest at the player boundary', () => {
    expect(() =>
      experienceManifestSchema.parse({ ...approvedManifest, status: 'draft' }),
    ).toThrow();
  });

  it('rejects unknown fields rather than mass-assigning them', () => {
    expect(() => experienceManifestSchema.parse({ ...approvedManifest, admin: true })).toThrow();
  });

  it('rejects malformed trust-boundary identifiers', () => {
    expect(() =>
      experienceManifestSchema.parse({ ...approvedManifest, organizationId: 'org_001' }),
    ).toThrow();
  });

  it('rejects duplicate grade bands and capabilities', () => {
    expect(() =>
      experienceManifestSchema.parse({ ...approvedManifest, gradeBands: ['middle1', 'middle1'] }),
    ).toThrow();
    expect(() =>
      experienceManifestSchema.parse({ ...approvedManifest, capabilities: ['quiz', 'quiz'] }),
    ).toThrow();
  });

  it('requires a lowercase SHA-256 content hash', () => {
    expect(() =>
      experienceManifestSchema.parse({
        ...approvedManifest,
        contentHash: `sha256:${'A'.repeat(64)}`,
      }),
    ).toThrow();
  });
});
