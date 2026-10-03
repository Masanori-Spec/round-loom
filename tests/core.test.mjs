import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeInput, parseJSON } from "../src/schema.mjs";
import { solve, preflight } from "../src/solver.mjs";
import { validatePlan, auditPlan, verifyDocument } from "../src/validate.mjs";
import { exportsFor, csvCell } from "../src/export.mjs";
const base = JSON.parse(
  await readFile(new URL("../fixtures/workshop.json", import.meta.url), "utf8"),
);
const clone = (x) => structuredClone(x);
const solvePlan = (input) => {
  const result = solve(input);
  assert.equal(result.status, "best-found");
  assert.equal(validatePlan(input, result.plan.rounds).valid, true);
  return result.plan;
};
const goldenTables = [
  [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ],
  [
    [1, 4, 7],
    [2, 5, 8],
    [3, 6, 9],
  ],
  [
    [1, 5, 9],
    [2, 6, 7],
    [3, 4, 8],
  ],
  [
    [1, 6, 8],
    [2, 4, 9],
    [3, 5, 7],
  ],
];
const golden = goldenTables.map((tables, i) => ({
  number: i + 1,
  frozen: false,
  attendees: [...base.participants],
  tables: tables.map((t) => t.map((p) => `P0${p}`)),
}));
test("golden audit: 9 people, 3 tables, 4 rounds, 36 unique pairs", () => {
  const audit = auditPlan(base, golden);
  assert.equal(audit.uniquePairs, 36);
  assert.equal(audit.repeatEncounters, 0);
  assert.equal(audit.totalPairEncounters, 36);
  assert.equal(audit.possiblePairs, 36);
  assert.equal(audit.repeatLowerBound, 0);
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 9; j++)
      assert.equal(audit.matrix[i][j], i === j ? 0 : 1);
});
test("search is deterministic for identical seed and work budget", () => {
  const a = solvePlan(base),
    b = solvePlan(base);
  assert.deepEqual(a, b);
  assert.ok(a.search.workUsed <= base.workBudget);
  assert.ok(a.audit.repeatEncounters <= 8);
});
test("does not mutate input", () => {
  const input = clone(base),
    before = clone(input);
  solve(input);
  assert.deepEqual(input, before);
});
test("independent validation rejects duplicate and missing attendees", () => {
  for (const kind of ["duplicate", "omit"]) {
    const rounds = clone(golden);
    if (kind === "duplicate") rounds[0].tables[0][0] = "P02";
    else rounds[0].tables[0].pop();
    assert.equal(validatePlan(base, rounds).valid, false);
  }
});
test("independent validation rejects wrong count, capacity, keep apart and flags", () => {
  assert.equal(validatePlan(base, golden.slice(1)).valid, false);
  assert.equal(validatePlan({ ...base, maxPerTable: 2 }, golden).valid, false);
  assert.equal(
    validatePlan({ ...base, keepApart: [["P01", "P02"]] }, golden).valid,
    false,
  );
  const rounds = clone(golden);
  rounds[0].frozen = true;
  assert.equal(validatePlan(base, rounds).valid, false);
});
test("odd counts and non-divisible sizes remain balanced", () => {
  for (const n of [5, 7, 11, 13, 23]) {
    const input = {
      ...base,
      participants: Array.from({ length: n }, (_, i) => `A${i}`),
      tableCount: n === 5 ? 2 : 3,
      maxPerTable: 12,
      workBudget: 2000,
    };
    const p = solvePlan(input);
    for (const r of p.rounds)
      assert.ok(
        Math.max(...r.tables.map((t) => t.length)) -
          Math.min(...r.tables.map((t) => t.length)) <=
          1,
      );
  }
});
test("boundary: 4 participants / 2 tables and 24 / 6 tables / 6 rounds", () => {
  for (const [n, t, r] of [
    [4, 2, 1],
    [24, 6, 6],
  ]) {
    solvePlan({
      ...base,
      participants: Array.from({ length: n }, (_, i) => `A${i}`),
      tableCount: t,
      roundCount: r,
      maxPerTable: 4,
      workBudget: 3000,
    });
  }
});
test("keep apart enforced for every future round", () => {
  const input = {
    ...base,
    keepApart: [
      ["P01", "P02"],
      ["P03", "P04"],
    ],
  };
  const p = solvePlan(input);
  for (const r of p.rounds)
    for (const [a, b] of input.keepApart)
      assert.ok(!r.tables.some((t) => t.includes(a) && t.includes(b)));
});
test("freeze first 2; absent from 3; history stays byte-for-byte unchanged", () => {
  const historical = golden
    .slice(0, 2)
    .map(({ attendees, tables }) => ({ attendees, tables }));
  const input = {
    ...base,
    frozenRounds: historical,
    absences: [{ participant: "P09", fromRound: 3 }],
    keepApart: [["P01", "P02"]],
  };
  const before = JSON.stringify(input.frozenRounds);
  const p = solvePlan(input);
  assert.equal(
    JSON.stringify(
      p.rounds
        .slice(0, 2)
        .map(({ attendees, tables }) => ({ attendees, tables })),
    ),
    before,
  );
  assert.ok(
    p.rounds
      .slice(2)
      .every(
        (r) => !r.attendees.includes("P09") && !r.tables.flat().includes("P09"),
      ),
  );
  assert.ok(p.audit.matrix[0][1] > 0);
});
test("historical capacity and apart conditions are authoritative, future only", () => {
  const input = {
    ...base,
    roundCount: 2,
    maxPerTable: 1,
    keepApart: [["P01", "P02"]],
    frozenRounds: golden
      .slice(0, 2)
      .map(({ attendees, tables }) => ({ attendees, tables })),
  };
  const p = solvePlan(input);
  assert.equal(p.search.workUsed, 0);
  assert.equal(p.rounds[0].tables[0].length, 3);
});
test("reject future absences that try to rewrite history", () => {
  assert.throws(() =>
    normalizeInput({
      ...base,
      frozenRounds: golden
        .slice(0, 2)
        .map(({ attendees, tables }) => ({ attendees, tables })),
      absences: [{ participant: "P01", fromRound: 2 }],
    }),
  );
});
test("proven contradictions are separate from exhausted budget", () => {
  assert.equal(solve({ ...base, maxPerTable: 2 }).status, "contradiction");
  assert.equal(
    solve({
      ...base,
      tableCount: 6,
      absences: base.participants
        .slice(0, 5)
        .map((participant) => ({ participant, fromRound: 1 })),
    }).status,
    "contradiction",
  );
  const pairs = [];
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++)
      pairs.push([base.participants[i], base.participants[j]]);
  assert.equal(solve({ ...base, keepApart: pairs }).status, "contradiction");
  const exhausted = solve({ ...base, workBudget: 1 });
  assert.equal(exhausted.status, "budget-exhausted");
  assert.equal(exhausted.workUsed, 1);
  assert.match(exhausted.reasons[0], /not a proof/);
});
test("resource caps and malformed input rejected", () => {
  for (const patch of [
    { participants: ["A", "A", "B", "C"] },
    { tableCount: 7 },
    { roundCount: 7 },
    { workBudget: 250001 },
    { seed: -1 },
    { participants: Array.from({ length: 25 }, (_, i) => `P${i}`) },
    { keepApart: [["P01", "P01"]] },
    { keepApart: [["P01", "WHO"]] },
    {
      keepApart: [
        ["P01", "P02"],
        ["P02", "P01"],
      ],
    },
    {
      absences: [
        { participant: "P01", fromRound: 2 },
        { participant: "P01", fromRound: 3 },
      ],
    },
    { unexpected: true },
    { roundCount: NaN },
  ])
    assert.throws(() => normalizeInput({ ...base, ...patch }));
  assert.throws(() => parseJSON("nope"));
  assert.throws(() => parseJSON(" ".repeat(262145)));
});
test("corrupt imports do not trust audit values or freeze edits", () => {
  const p = solvePlan(base);
  p.audit.uniquePairs = 999;
  assert.notEqual(verifyDocument(p).audit.uniquePairs, 999);
  p.rounds[0].tables[0][0] = "UNKNOWN";
  assert.throws(() => verifyDocument(p));
  const valid = solvePlan(base);
  valid.search.workUsed = 9999999;
  assert.throws(() => verifyDocument(valid));
  assert.throws(() => verifyDocument({ kind: "wrong" }));
});
test("frozen attendance mismatch and altered history rejected", () => {
  const input = {
    ...base,
    frozenRounds: golden
      .slice(0, 1)
      .map(({ attendees, tables }) => ({ attendees, tables })),
  };
  const p = solvePlan(input);
  [p.rounds[0].tables[0], p.rounds[0].tables[1]] = [
    p.rounds[0].tables[1],
    p.rounds[0].tables[0],
  ];
  assert.equal(validatePlan(input, p.rounds).valid, false);
});
test("safe CSV neutralizes formulas and quotes; print escapes markup", () => {
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell("  +X"), '"\'  +X"');
  assert.equal(csvCell('a"b'), '"a""b"');
  const p = solvePlan({
    ...base,
    participants: ["<script>alert(1)</script>", "=SUM(1)", "-evil", "@cmd"],
    tableCount: 2,
    roundCount: 1,
    maxPerTable: 2,
  });
  const x = exportsFor(p);
  assert.ok(x.printHTML.includes("&lt;script&gt;"));
  assert.ok(!x.printHTML.includes("<script>"));
  assert.ok(x.tablesCSV.includes("'=SUM(1)"));
  assert.ok(x.tablesCSV.startsWith("\uFEFF"));
  assert.deepEqual(JSON.parse(x.json).audit, p.audit);
});
test("audit counts repeat encounters beyond first, not number of repeated pairs", () => {
  const input = { ...base, roundCount: 3 };
  const rounds = Array.from({ length: 3 }, (_, i) => ({
    ...clone(golden[0]),
    number: i + 1,
  }));
  const a = auditPlan(input, rounds);
  assert.equal(a.totalPairEncounters, 27);
  assert.equal(a.uniquePairs, 9);
  assert.equal(a.repeatEncounters, 18);
  assert.equal(a.maxPairCount, 3);
});
test("conservative lower bound holds for all encountered attendance patterns", () => {
  for (let seed = 0; seed < 20; seed++) {
    const p = solvePlan({
      ...base,
      seed,
      roundCount: 6,
      absences: [{ participant: "P09", fromRound: 4 }],
      workBudget: 1500,
    });
    assert.ok(p.audit.repeatEncounters >= p.audit.repeatLowerBound);
    assert.equal(
      p.audit.matrix.flat().reduce((s, n) => s + n, 0),
      p.audit.totalPairEncounters * 2,
    );
  }
});
test("all frozen history can have smaller attendance than future roster", () => {
  const input = {
    ...base,
    roundCount: 1,
    tableCount: 2,
    frozenRounds: [
      {
        attendees: ["P01", "P02", "P03", "P04"],
        tables: [
          ["P01", "P02"],
          ["P03", "P04"],
        ],
      },
    ],
  };
  assert.equal(solvePlan(input).audit.uniquePairs, 2);
});
