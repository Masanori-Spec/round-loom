# Independent verification

Date: 2026-10-03. Scope: source, algorithm, validation, import/export, CLI, and build review in the cloud workspace. The original source review did not include a browser, deployment, or public CI run. Subsequent CI evidence is recorded at the end of this document.

## Result

The reviewed core has no remaining blocking finding from this review. `npm run check` passed: syntax checks for 17 JavaScript modules, 30 tests with no skips or failures, the static build, and resolution of all 9 built local module references. At that stage, browser execution and visual review were still outstanding.

## Independent oracles

- Enumerated all 1,088 undirected keep-apart graphs on 4 and 5 participants. An independently implemented balanced-partition enumerator determines whether a valid two-table assignment exists. Every feasible graph produced a valid plan; no infeasible graph produced a plan. Non-clique failures remain budget exhaustion rather than false impossibility claims
- Independently checked 100 seeded plans across 4–24 participants, 2–6 tables, and 6 rounds, including frozen history, later absences, keep-apart pairs, and varied capacity. Checked attendance and once-only membership, balance, capacity, history equality, encounter totals, unique/repeated pairs, maximum pair count, every matrix cell, deterministic reruns, and input immutability
- Enumerated all 256 absence-onset patterns for four participants and three rounds. Verified exact attendance or a genuine shortage of attendees for nonempty tables
- Corrupted round counts, flags, attendance, table shapes, labels, duplicate assignments, and balance. Validated rejection independently of the solver
- Confirmed imported metrics are recomputed, imported unknown metadata is discarded, and JSON roundtrips preserve punctuation, non-ASCII labels, and labels resembling special property names
- Checked hostile markup remains escaped in print HTML and CSV quoting preserves comma/quote labels. The existing suite also verifies formula neutralization

These tests are in `tests/review.test.mjs` and `tests/review-cli.test.mjs`. The oracle does not import solver helpers or scorer implementations.

## Findings repaired and retested

1. Sparse JavaScript arrays could bypass traversal in the exported validator. Dense-array checks now reject holes at every input and output boundary; explicit regressions cover nested history, attendance, pairs, absences, and tables. Serialized JSON cannot express array holes, so the original defect affected direct API callers
2. Verified imported rounds previously retained unrecognized metadata. Canonical projection now returns only known round fields and copied attendee/table arrays
3. CLI size checks alone did not bound reads from special files or a growing regular file. Nonblocking open, regular-file verification, bounded reads, and guaranteed handle cleanup now protect the boundary. Tests verify the exact 256 KiB limit, over-limit rejection, directory/FIFO/device rejection without hanging, and symlink-to-regular-file support

## Resource observations

A 24-person, six-round run with 32-code-unit labels and the maximum 250,000-placement budget returned a valid plan in approximately 3.1 seconds on this workspace. Its JSON export was 35,787 bytes. A two-table odd-cycle keep-apart case consumed the same placement budget and truthfully returned `budget-exhausted`, in approximately 0.45 seconds. These are observations, not portable performance guarantees.

The lower-bound formula is conservative for the fixed roster and includes historical encounters. No optimality guarantee, comprehensive infeasibility proof, or authenticity proof for user-authored historical/search metadata is implied.

## Outstanding at source-review time

The 13 authored browser scenarios did not run locally because sandboxed Chromium launch was blocked. This review did not disable the sandbox or substitute an unsandboxed run. Actual browser results, screenshots, mobile overflow checks, print rendering, downloads, and cancellation/import UI races remained to be verified in sandboxed CI at that stage. Real facilitator usability, demand, and novelty are unvalidated.

## Subsequent CI evidence

After this source review, [hosted CI run 37141006704](https://github.com/Masanori-Spec/round-loom/actions/runs/37141006704) passed all four unit matrix jobs and all 13 browser scenarios with the sandbox enabled at source commit `c31ab9a1c6b6cf3d0254b029364526ac9ced96f3`. Desktop, mobile, and both print pages were then visually reviewed. The original local block above remains historical. See [the current verification report](VERIFICATION.md) for exact artifact provenance and the remaining cosmetic localization limitation. Real facilitator usability, demand, and novelty remain unvalidated.
