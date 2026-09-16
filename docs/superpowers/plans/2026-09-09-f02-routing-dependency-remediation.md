# F02 routing test dependency remediation

2026-09-09. The corrected routing candidate passes check573 and live4, but the required complete dependency audit fails for @vercel/routing-utils6.5.0 → path-to-regexp6.1.0 (GHSA-9wv6-86v2-598j). Preserve `.verification/f02-live-remediation-audit-all.log` as RED evidence. This development dependency is used only by the actual Vercel rewrite regression and disposable browser harness.

1. Add a scoped root pnpm override `@vercel/routing-utils@6.5.0>path-to-regexp: 6.3.0` in pnpm-workspace.yaml and regenerate the lockfile with the repository's pinned pnpm. This patches only the affected test-tool dependency, preserving its v6 interface and all unrelated dependency resolutions. Do not use a global override or suppress the audit.
2. Verify the resolved version, run the actual-config routing tests (positive route matrix and negative query cases), full check, live browser suite, production and complete audits. Reuse unaffected PostgreSQL/integration/E2E/demo/preview evidence from the parent unit; the fresh independent reviewer still runs relevant independent checks. Scan release browser artifacts for server/credential/test-only modules and verify the Node-only export boundary.
3. Update the verification record and freeze the complete implementation manifest again. The active fresh reviewer has not issued a final score and has not edited production code; inform them of this exact dependency change before they resume their independent checks. No commit, merge, push or deployment before their fresh score86+ with no critical blocker.

The upstream advisory explicitly lists6.3.0 as patched. Compatibility is verified by the real converter tests, not assumed from semver alone. No production code, database, credentials, remote service or paid resource changes are involved. Containment is to keep the existing deployment unchanged if verification fails; never release the vulnerable candidate or bypass a required audit.

Sources checked2026-09-09: [upstream advisory](https://github.com/pillarjs/path-to-regexp/security/advisories/GHSA-9wv6-86v2-598j) and [pnpm dependency overrides](https://pnpm.io/settings#overrides).
