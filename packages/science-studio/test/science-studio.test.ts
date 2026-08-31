import { readFile } from 'node:fs/promises';

import type { ScienceBlockSpec } from '@lessonquest/contracts';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ScienceGenerationError,
  buildScienceArtifact,
  buildScienceSandboxDocument,
  hashScienceArtifact,
  parseGeneratedScienceSpec,
  validateScienceSpec,
  verifyScienceArtifactHash,
} from '../src/index.js';

let validSpec: ScienceBlockSpec;
let validText: string;

beforeAll(async () => {
  validText = await readFile(new URL('./fixtures/force-motion.json', import.meta.url), 'utf8');
  validSpec = JSON.parse(validText) as ScienceBlockSpec;
});

describe('parseGeneratedScienceSpec', () => {
  it('parses legal multibyte JSON without Buffer and retains the byte limit', () => {
    vi.stubGlobal('Buffer', undefined);
    try {
      expect(parseGeneratedScienceSpec(validText).title).toBe(
        '가벼운 손수레가 더 빨리 움직이는 이유',
      );
      expect(() => parseGeneratedScienceSpec('가'.repeat(11_000))).toThrowError(
        expect.objectContaining({ code: 'SPEC_TOO_LARGE' }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('parses a strict bounded generated JSON specification', () => {
    expect(parseGeneratedScienceSpec(validText)).toEqual(validSpec);
  });

  it('distinguishes malformed JSON, invalid schema, and oversized UTF-8 input', () => {
    const invalidSchema = JSON.stringify({ ...validSpec, script: 'fetch("https://evil.test")' });

    expect(() => parseGeneratedScienceSpec('{')).toThrowError(
      expect.objectContaining({ code: 'INVALID_JSON' }),
    );
    expect(() => parseGeneratedScienceSpec(invalidSchema)).toThrowError(
      expect.objectContaining({ code: 'INVALID_SPEC' }),
    );
    expect(() => parseGeneratedScienceSpec('가'.repeat(11_000))).toThrowError(
      expect.objectContaining({ code: 'SPEC_TOO_LARGE' }),
    );
    expect(() => parseGeneratedScienceSpec('{')).toThrow(ScienceGenerationError);
  });
});

describe('validateScienceSpec', () => {
  it('returns a versioned independent PASS report for a safe complete specification', () => {
    expect(validateScienceSpec(validSpec)).toEqual({
      policyVersion: 'science-validator-1',
      verdict: 'PASS',
      findings: [],
    });
  });

  it('reports objective coverage and a simulation with no observable change', () => {
    const extraObjectiveSpec: ScienceBlockSpec = {
      ...validSpec,
      learningObjectives: [
        ...validSpec.learningObjectives,
        { id: 'objective_uncovered', text: '새로운 목표를 설명한다.' },
      ],
      blocks: validSpec.blocks.map((block) =>
        block.kind === 'SIMULATION'
          ? { ...block, parameters: { ...block.parameters, forceN: 0 } }
          : block,
      ),
    };

    expect(validateScienceSpec(extraObjectiveSpec)).toEqual({
      policyVersion: 'science-validator-1',
      verdict: 'FAIL',
      findings: [
        {
          code: 'OBJECTIVE_NOT_COVERED',
          severity: 'ERROR',
          blockId: null,
        },
        {
          code: 'SIMULATION_NO_OBSERVABLE_CHANGE',
          severity: 'ERROR',
          blockId: 'simulate_force',
        },
      ],
    });
  });
});

describe('science artifacts', () => {
  it('uses a stable canonical SHA-256 hash independent of input key order', () => {
    const artifact = buildScienceArtifact(validSpec);
    const reorderedSpec = {
      blocks: validSpec.blocks,
      learningObjectives: validSpec.learningObjectives,
      unit: validSpec.unit,
      gradeBand: validSpec.gradeBand,
      title: validSpec.title,
      schemaVersion: validSpec.schemaVersion,
    } as ScienceBlockSpec;
    const expectedHash = 'sha256:821b433ddb62f2fb4ae305a379f1ef5633e50892c336112049118f7c1d1a1043';

    expect(hashScienceArtifact(artifact)).toBe(expectedHash);
    expect(hashScienceArtifact(buildScienceArtifact(reorderedSpec))).toBe(expectedHash);
    expect(verifyScienceArtifactHash(artifact, expectedHash)).toBe(true);
    expect(
      verifyScienceArtifactHash(
        buildScienceArtifact({ ...validSpec, title: '변조된 제목' }),
        expectedHash,
      ),
    ).toBe(false);
  });

  it('renders only escaped content inside a network-denied scripts-only sandbox document', () => {
    const concept = validSpec.blocks[0];
    if (concept?.kind !== 'CONCEPT_CARD') {
      throw new TypeError('Fixture concept block is missing');
    }
    const injectedSpec: ScienceBlockSpec = {
      ...validSpec,
      blocks: [{ ...concept, title: '<img src=x onerror=alert(1)>' }, ...validSpec.blocks.slice(1)],
    };
    const document = buildScienceSandboxDocument(buildScienceArtifact(injectedSpec));

    expect(document).toContain("default-src 'none'");
    expect(document).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(document).not.toContain('<img src=x');
    expect(document).not.toContain('https://');
    expect(document).not.toContain('fetch(');
  });
});
