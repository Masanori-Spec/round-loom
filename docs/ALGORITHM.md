# Algorithm and assurance boundaries

## Constraint precheck

Before search, each future round is checked for fewer attendees than nonempty tables and for total capacity. A bounded clique search (at most 10,000 state expansions per future round) may find tableCount+1 mutually keep-apart participants. Finding that clique proves the constraints contradictory. Failure to find it says nothing about feasibility. This precheck does not decide general graph coloring or all balanced partition infeasibility.

## Construction

A uint32 seed initializes a deterministic PRNG. Each construction begins with exact copies of the frozen prefix. For each future round:

1. Derive attendance from the fixed roster and absence starts
2. Shuffle balanced target table sizes
3. Seed-shuffle participant order, then prioritize participants with more keep-apart constraints
4. Backtrack over table placements ordered by earlier encounter count and seeded tie-breaks
5. Reject full tables and keep-apart violations; skip equivalent empty tables of equal size
6. Count each attempted placement, even one rejected by a hard rule

The work budget and per-round cap ensure bounded search, not exact optimization. A construction that cannot complete a round is discarded. Each complete candidate is independently validated, scored, and retained if better than the incumbent. The solver may use the full work budget, or stop early after a zero-repeat candidate.

## Objective

Lexicographic: (total pair encounters beyond the first, maximum pair encounter count). It does not optimize movement distance, number of table changes, perceived fairness, station coverage, or the worst participant's unique-contact count. Those per-person counts are reported for human review.

## Independent validator

`validate.mjs` imports schema parsing but never imports the search or search scoring helpers. It traverses complete output rounds and independently checks round order, frozen flags, attendance sets, once-only assignment, table count, balance, future capacity, future keep-apart rules, and exact frozen-prefix equality. Metrics come from a fresh roster-indexed symmetric matrix.

The 9-person, 3-table, 4-round golden fixture is an audit oracle with all 36 unordered pairs meeting exactly once. The solver is not required to find the same arrangement, and a golden audit pass alone does not establish search quality.

## Conservative lower bound

For a fixed roster of n labels, at most n(n−1)/2 unique unordered pairs exist. With E total pair encounters, repeated encounters equal E minus unique pairs, hence at least max(0,E−n(n−1)/2). All historical and future rounds are included, attendance is once per round, and no external labels are admitted. Changes in attendance and keep-apart rules may reduce the usable pair universe and make this bound loose. No “optimal” badge is inferred from search termination.

## Complexity and caps

The participant cap is 24, table cap 6, and round cap 6. Pair storage is O(n²). Input files are capped at 256 KiB. Search placement work is capped at 250,000; contradiction search is separately bounded; validating/scoring each completed construction is bounded by the small roster and rounds. Cancellation in the browser terminates the worker, discards the output, and ignores stale message IDs.
