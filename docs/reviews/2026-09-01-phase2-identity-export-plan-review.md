# Phase 2 identity export readiness plan review

Date: 2026-09-01

Plan: `docs/superpowers/plans/2026-09-01-phase2-identity-export.md`

Spec: `docs/superpowers/specs/2026-09-01-phase2-identity-export-design.md`

## Decision

**PASS — 98/100. No critical blocker remains. Implementation is authorized only within the reviewed synthetic, side-effect-free scope.**

## Rubric

| Category                               |      Score | Evidence                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements and scope coverage        |      25/25 | Goal/global constraints and the acceptance trace cover versioned read-only export, explicit account/organization mapping, redacted deterministic readiness, synthetic fixtures and every explicit deferral. Tasks 1–4 include documentation, independent review and delivery.                                                |
| Architecture and interface quality     |      19/20 | The file map separates strict contracts, canonical JSON and reconciliation; Tasks 1–2 define exact public functions/report fields, complete finding codes, stable ordering and error behavior. The only retained uncertainty is the later real WordQuest exporter shape, deliberately outside this versioned synthetic unit. |
| Security, privacy and tenant safety    |      20/20 | Global constraints and Tasks 1–2 forbid real data/I/O/runtime coupling, automatic identity/org matching and privilege import; they require strict bounds, exact identifiers, `MASTER` blocking, raw-ID fingerprinting, safe errors and complete collision/missing-mapping cases. No tenant or credential blocker remains.    |
| Test and verification quality          |      20/20 | Tasks 1–3 specify observed RED points, all 13 semantic findings, structural/injection cases, exact checksum determinism, report/error redaction, dependency/runtime containment, full workspace/integration/E2E/browser suites, audit and emitted-asset inspection.                                                          |
| Execution readiness and recoverability |      14/15 | File responsibilities, function signatures, ordered actions, exact commands, hash freeze, independent gate, CI/main/Vercel workflow and revert-only recovery are concrete. Exact final checksum literals and test counts necessarily come from RED/GREEN implementation and will be recorded in verification evidence.       |
| **Total**                              | **98/100** | **Strictly greater than 85; gate passes.**                                                                                                                                                                                                                                                                                   |

## Critical-blocker check

- Authorization/tenant ambiguity: none. Legacy organization keys never authorize, `MASTER` blocks and ambiguous mappings fail closed.
- Secrets/real student data: none. The scope accepts synthetic caller-owned values only and has no Firebase/filesystem/network/database boundary.
- Irreversible data operation: none. No schema, persistence, exporter, CLI or migration is added.
- Reference mutation: none. WordQuest remains untouched; no code/data is copied.
- Unverifiable acceptance: none. Focused, full, containment, independent and release evidence is enumerated.
- Missing authority: none for this synthetic repository unit. Any real-data or schema work is explicitly deferred and requires a later gate/approval.

## Authorization boundary

This score authorizes Tasks 1–4 exactly as written. It does not authorize Firebase access, a real export, a database identity column/table, membership writes, a migration dry run, backup/restore operations or use of real account/student identifiers.

## Revision 1 — workspace lock entry

The initial package scaffold proved that pnpm requires a lockfile importer for the new workspace package even though it adds no external dependency. The plan now permits exactly the `packages/data-transition` importer linking `@lessonquest/contracts` through `workspace:*` and continues to forbid any external dependency/version change. This is a narrower, verifiable form of the original contracts-only dependency rule. The architecture, security boundary, verification commands, total **98/100** score and PASS decision remain unchanged.

## Revision 2 — dedicated transition contract subpath

The planned emitted-asset check correctly caught the transition format and `PRIVILEGED_ROLE_REQUIRES_REVIEW` marker in normal, demo and preview web bundles. Inspection traced this to re-exporting the transition schemas from the existing contracts root barrel. The plan now requires a dedicated `@lessonquest/contracts/data-transition` subpath, forbids the transition export from the runtime barrel, adds a focused containment regression and requires clean rebuilt JS/source maps in every web mode.

This revision strengthens the original isolation requirement and keeps the public transition API explicit. It adds no dependency, behavior, persistence or authority surface. The rubric remains **98/100 PASS** with no critical blocker: architecture/runtime isolation is more precise, the failing asset evidence is reproducible, and the verification now proves the corrective boundary before independent review.
