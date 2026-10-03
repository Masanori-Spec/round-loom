# Schema v1

A solver input is an object with exactly these recognized fields. Unknown fields are rejected.

```json
{
  "schemaVersion": 1,
  "participants": ["P01", "P02", "P03", "P04"],
  "tableCount": 2,
  "roundCount": 3,
  "maxPerTable": 2,
  "keepApart": [["P01", "P02"]],
  "absences": [{"participant": "P04", "fromRound": 3}],
  "frozenRounds": [],
  "seed": 42,
  "workBudget": 20000
}
```

`schemaVersion`, `participants`, `tableCount`, and `roundCount` are required. Defaults: maxPerTable 24, keepApart [], absences [], frozenRounds [], seed 1, workBudget 20000. Bounds: roster 4–24, tableCount 2–6, roundCount 1–6, maxPerTable 1–24, seed uint32, workBudget 1–250000. Integers only.

Keep-apart pairs contain two distinct known labels. Duplicate unordered pairs are rejected. Each absence names one known label and the first absent round; it applies through the last round. A participant may appear in at most one absence record. `fromRound` must exceed the frozen-prefix length and cannot exceed `roundCount`.

Each frozen round is `{ "attendees": [...], "tables": [[...], [...]] }`. It has exactly tableCount nonempty tables, their sizes differ by at most one, each attendee appears once, and there are no non-attendees. Historical attendees may be a subset of the roster. Frozen attendees and table arrays retain exact order through search; retrospective absences and keep-apart changes are not applied. Uniform capacity affects future rounds only. Frozen history is user-authored data, not cryptographically attested truth.

## Plan document

```json
{
  "schemaVersion": 1,
  "kind": "round-loom-plan",
  "input": { "schemaVersion": 1, "participants": ["..."], "tableCount": 2, "roundCount": 1 },
  "rounds": [
    {"number": 1, "frozen": false, "attendees": ["..."], "tables": [["..."], ["..."]]}
  ],
  "search": {"seed": 1, "workBudget": 20000, "workUsed": 10, "status": "best-found"},
  "audit": {"...": "recomputed on import; never trusted"}
}
```

This abbreviated plan is illustrative, not a valid fixture. Real emitted documents include the complete normalized input and all audit fields. Search metadata is validated for internal range consistency but is not authenticated. Import does not prove that the supplied seed/budget actually generated a third-party plan. The verifier proves only the structural constraints and recomputed encounter metrics. Unknown plan, round, and search metadata are not retained in the canonical verified output. Direct JavaScript API calls also reject sparse arrays.

## History handoff

To freeze k rounds, copy their attendees and tables into `input.frozenRounds`, maintaining order. Retain every historical label in the roster. Move any ongoing absence whose original start is now historical to `k+1`; remove future absence settings if every round is frozen. The UI does this adjustment when freezing. Do not silently rewrite history to satisfy new constraints.
