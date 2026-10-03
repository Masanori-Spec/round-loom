# Verification report

Date: 2026-10-03. Source commit [`c31ab9a1c6b6cf3d0254b029364526ac9ced96f3`](https://github.com/Masanori-Spec/round-loom/commit/c31ab9a1c6b6cf3d0254b029364526ac9ced96f3). This report separates local checks, independent source review, hosted CI, and visual artifact review. No production deployment or real-world usability validation is implied.

## Hosted CI: passed

[GitHub Actions run 37141006704](https://github.com/Masanori-Spec/round-loom/actions/runs/37141006704) completed successfully for the exact commit above:

- Four unit jobs: Node 22 and 24 × UTC and Asia/Tokyo, each passing 30 unit/CLI/review tests
- Browser job: 13 scenarios passed with `sandbox: true`
- Browser report: zero page errors and zero external requests during the tested flows

The saved [job and artifact metadata](evidence/initial-ci-proof.json) and [browser results](evidence/browser-results.json) provide machine-readable evidence. The official artifact `round-loom-browser-evidence`, ID `11280341899`, was downloaded, and its archive SHA-256 matched GitHub's recorded digest: `5c4d9bf66a9e9b413589e1f3f1c83f21cdbb192b6cf6483cf77c57f88e9aa104`. Individual preserved-file hashes, sizes, and scope are in [provenance.json](evidence/provenance.json).

### Browser scenarios passed

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

### Visual review

The [desktop screenshot](screenshots/desktop.png) and [390 px mobile screenshot](screenshots/mobile.png) were inspected. Text and controls were readable with no clipping observed; the mobile scenario also asserted no document-width overflow. Both A4 pages of the [print PDF](evidence/print.pdf) were rendered and reviewed: table rounds and personal route cards were readable, and P09's absence in rounds 3–4 was visible. These observations cover the preserved synthetic examples, not every device, locale, printer, or input.

A cosmetic localization limitation remains: changing language leaves an existing status notice in the language in which it was produced; route destinations and table labels retain English. This is visible in the mobile evidence and has not been concealed or reported as fixed.

## Local checks: passed

- Node 24.19.0 `npm run check`: 30 unit/CLI/review tests, zero failures
- Syntax checks for 17 JavaScript modules; deterministic static build; all 9 built local import references verified
- Golden auditor fixture: 9 participants, 3 tables, 4 rounds, 36 unique unordered pairs, zero repeats
- Search determinism, input immutability, roster bounds, odd counts, balance, capacities, and keep-apart
- Exact first-two-round preservation when P09 becomes absent from round 3
- Historical capacity and keep-apart not retroactively applied; attempts to rewrite attendance history rejected
- Corrupt imports, missing/duplicate labels, sparse arrays, invalid metadata, and oversized or nonregular CLI inputs rejected
- Imported audit metrics recomputed; opaque metadata discarded
- Contradiction classification separate from budget exhaustion
- HTML escaping, formula-safe CSV, complete CLI exports, and no-overwrite behavior

## Initial local browser attempt: blocked

Before the hosted CI run, sandbox-enabled Chromium failed at startup in the local workspace because of socket/ptrace restrictions. It ran zero browser scenarios and was never treated as a pass. The sandbox was not disabled. See [the separate historical record](LOCAL_BROWSER_HISTORY.md). The successful hosted run above supplies the previously missing browser evidence.

## Independent source review

An independent reviewer checked all 1,088 keep-apart graphs on 4/5 people, 100 seeded cases over 4–24 labels, and all 256 four-person absence-onset patterns. Findings prompted repairs to sparse-array validation, canonical import projection, and bounded regular-file CLI reads. Regressions cover every repair. The oracle does not use solver/scorer helpers. See [the source-review report](INDEPENDENT_REVIEW.md).

## Scope and maintenance

The screenshots and hosted results refer to the named source commit. This documentation-and-evidence follow-through changes no runtime, algorithm, or test code; it does not claim a later commit has passed before its own checks finish. Facilitator usability, customer demand, commercial value, and novelty remain unvalidated.

The browser job uses Ubuntu 22.04 as a temporary sandbox-compatible baseline. Its announced retirement is April 17, 2027. Migrate to a supported runner and rerun the full suite before then.
