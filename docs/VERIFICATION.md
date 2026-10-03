# Verification report

Date: 2026-10-03. Implementation after independent source review, local workspace only. No public repository, deployment, or CI execution is asserted.

## Passed

- Node 24.19.0 `npm run check`: 30 unit/CLI/review tests, zero failures
- Syntax checks for 17 JavaScript modules; static build and all 9 built local import references verified
- Deterministic source-to-dist static build
- Golden auditor fixture: 9 participants, 3 tables, 4 rounds, 36 unique unordered pairs, zero repeats
- Search determinism and input immutability
- 4–24 participant boundaries, odd counts, balanced tables, capacities and keep-apart
- Exact first-two-round preservation when P09 becomes absent from round 3
- Historical capacity/keep-apart not retroactively applied
- Absence attempts to rewrite history rejected
- Missing/duplicate labels, corrupted imports, resource caps, invalid metadata rejected
- Recomputed audit rather than trusting imported metrics
- Contradiction classification separate from budget exhaustion
- HTML escaping, formula-safe CSV, complete CLI exports and no-overwrite behavior

## Blocked, not passed

Sandbox-enabled Chromium failed before any browser scenario ran with `socket() failed: Operation not permitted` and ptrace restrictions in this container. The sandbox remained enabled. `tests/browser/artifacts/results.json` records `status: blocked`, `stage: browser-launch`, and `testsRun: 0`.

No screenshots, visual inspection, print rendering, mobile-layout checks, or browser-download successes are asserted. The following 13 browser scenarios are implemented but unexecuted locally:

1. Japanese/English interface and keyboard skip link
2. Generated JSON and independent audit
3. Deterministic repeated generation
4. Freeze two, future absence, exact history preservation
5. CSV/JSON/HTML downloads, absent personal route, print view
6. Changed-input invalidation and cancellation
7. Malformed import and repeat import recovery
8. Oversize and corrupted assignment imports
9. Contradiction versus budget exhaustion messages
10. Hostile labels and formula-safe exports
11. Imported comma-label constraints through UI round-trip
12. 390 px mobile layout and Japanese toggle
13. Reload clears transient state; no external requests or browser errors

## CI configuration, not CI evidence

`.github/workflows/ci.yml` runs the unit suite on Node 22/24 × UTC/Asia/Tokyo and browser scenarios on sandboxed Chromium on Ubuntu 22.04. The runner baseline is temporary; Ubuntu 22.04 retirement is April 17, 2027. Before retirement, migrate to a supported runner where sandboxed Chromium actually works and rerun the full suite. A workflow file is not evidence of a successful run.

## Independent review and outstanding verification

An independent source reviewer exhaustively checked 1,088 keep-apart graphs on 4/5 people and 100 seeded cases over 4–24 labels, plus all 256 four-person absence-onset patterns. Review found and prompted fixes for sparse JavaScript arrays at API boundaries, opaque metadata retention on plan imports, and nonregular/unbounded CLI reads. Regressions cover all fixes. These tests are separate from the solver and independently count encounters.

An actual sandboxed browser pass remains required before calling the UI fully verified. Real facilitator usability and demand tests have not been performed.
