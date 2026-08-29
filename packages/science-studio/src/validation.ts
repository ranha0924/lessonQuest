import { scienceBlockSpecSchema, type ScienceBlockSpec } from '@lessonquest/contracts';

export type ScienceValidationFindingCode =
  'OBJECTIVE_NOT_COVERED' | 'SIMULATION_NO_OBSERVABLE_CHANGE';

export interface ScienceValidationFinding {
  readonly code: ScienceValidationFindingCode;
  readonly severity: 'ERROR';
  readonly blockId: string | null;
}

export interface ScienceValidationReport {
  readonly policyVersion: 'science-validator-1';
  readonly verdict: 'PASS' | 'FAIL';
  readonly findings: readonly ScienceValidationFinding[];
}

export function validateScienceSpec(input: ScienceBlockSpec): ScienceValidationReport {
  const specification = scienceBlockSpecSchema.parse(input);
  const findings: ScienceValidationFinding[] = [];
  const coveredObjectives = new Set(
    specification.blocks.flatMap(({ objectiveIds }) => objectiveIds),
  );

  if (specification.learningObjectives.some(({ id }) => !coveredObjectives.has(id))) {
    findings.push({ code: 'OBJECTIVE_NOT_COVERED', severity: 'ERROR', blockId: null });
  }

  const simulation = specification.blocks.find(({ kind }) => kind === 'SIMULATION');
  if (simulation?.kind === 'SIMULATION' && simulation.parameters.forceN === 0) {
    findings.push({
      code: 'SIMULATION_NO_OBSERVABLE_CHANGE',
      severity: 'ERROR',
      blockId: simulation.id,
    });
  }

  return Object.freeze({
    policyVersion: 'science-validator-1',
    verdict: findings.length === 0 ? 'PASS' : 'FAIL',
    findings: Object.freeze(findings.map((finding) => Object.freeze(finding))),
  });
}
