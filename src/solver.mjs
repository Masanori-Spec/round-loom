import { normalizeInput, attendeesFor } from "./schema.mjs";
import { validatePlan, auditPlan } from "./validate.mjs";
function random(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(a, rng) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    let j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pairKey = (a, b) => JSON.stringify(a < b ? [a, b] : [b, a]);
export function preflight(inputRaw) {
  const input = normalizeInput(inputRaw),
    reasons = [];
  for (let r = input.frozenRounds.length + 1; r <= input.roundCount; r++) {
    const people = attendeesFor(input, r);
    if (people.length < input.tableCount)
      reasons.push(`Round ${r}: fewer attendees than nonempty tables`);
    if (people.length > input.tableCount * input.maxPerTable)
      reasons.push(`Round ${r}: insufficient capacity`);
    // A found clique of tableCount+1 is a proof, while a failed search is not.
    const apart = new Set(input.keepApart.map((p) => pairKey(...p)));
    let visits = 0,
      found = false;
    function clique(chosen, candidates) {
      if (chosen.length > input.tableCount) {
        found = true;
        return;
      }
      if (
        ++visits > 10000 ||
        chosen.length + candidates.length <= input.tableCount
      )
        return;
      for (let i = 0; i < candidates.length && !found; i++) {
        const p = candidates[i];
        clique(
          [...chosen, p],
          candidates.slice(i + 1).filter((q) => apart.has(pairKey(p, q))),
        );
      }
    }
    clique([], people);
    if (found)
      reasons.push(`Round ${r}: a keep-apart clique needs more tables`);
  }
  return { input, contradictions: reasons };
}
export function solve(inputRaw) {
  const { input, contradictions } = preflight(inputRaw);
  if (contradictions.length)
    return { status: "contradiction", reasons: contradictions, workUsed: 0 };
  const rng = random(input.seed),
    apart = new Set(input.keepApart.map((p) => pairKey(...p)));
  let workUsed = 0,
    best = null,
    bestScore = [Infinity, Infinity];
  const history = input.frozenRounds.map((r, i) => ({
    number: i + 1,
    frozen: true,
    attendees: [...r.attendees],
    tables: r.tables.map((t) => [...t]),
  }));
  const scoreCounts = (rounds) => {
    const counts = new Map();
    for (const r of rounds)
      for (const t of r.tables)
        for (let i = 0; i < t.length; i++)
          for (let j = i + 1; j < t.length; j++) {
            let k = pairKey(t[i], t[j]);
            counts.set(k, (counts.get(k) ?? 0) + 1);
          }
    return counts;
  };
  const updateBest = (rounds) => {
    const checked = validatePlan(input, rounds);
    if (!checked.valid)
      throw Error(`Internal validation failed: ${checked.errors.join("; ")}`);
    const counts = scoreCounts(rounds);
    const score = [
      Array.from(counts.values()).reduce((s, n) => s + Math.max(0, n - 1), 0),
      Math.max(0, ...counts.values()),
    ];
    if (
      score[0] < bestScore[0] ||
      (score[0] === bestScore[0] && score[1] < bestScore[1])
    ) {
      best = structuredClone(rounds);
      bestScore = score;
    }
  };
  if (history.length === input.roundCount) updateBest(history);
  while (workUsed < input.workBudget && history.length < input.roundCount) {
    const rounds = structuredClone(history),
      counts = scoreCounts(rounds);
    let complete = true;
    for (let r = history.length + 1; r <= input.roundCount; r++) {
      const people = attendeesFor(input, r),
        sizes = shuffle(
          Array.from(
            { length: input.tableCount },
            (_, i) =>
              Math.floor(people.length / input.tableCount) +
              (i < people.length % input.tableCount ? 1 : 0),
          ),
          rng,
        );
      const order = shuffle(people, rng).sort(
        (a, b) =>
          input.keepApart.filter((p) => p.includes(b)).length -
          input.keepApart.filter((p) => p.includes(a)).length,
      );
      const tables = Array.from({ length: input.tableCount }, () => []);
      const stopAt = Math.min(input.workBudget, workUsed + 3000);
      function assign(i) {
        if (i === order.length) return true;
        const p = order[i];
        const choices = tables
          .map((t, j) => ({
            j,
            cost: t.reduce((s, q) => s + (counts.get(pairKey(p, q)) ?? 0), 0),
            tie: rng(),
          }))
          .sort((a, b) => a.cost - b.cost || a.tie - b.tie);
        const equivalent = new Set();
        for (const { j } of choices) {
          if (workUsed >= stopAt) return false;
          workUsed++;
          const t = tables[j];
          if (t.length >= sizes[j] || t.some((q) => apart.has(pairKey(p, q))))
            continue;
          const symmetry = t.length === 0 ? `empty-${sizes[j]}` : null;
          if (symmetry && equivalent.has(symmetry)) continue;
          if (symmetry) equivalent.add(symmetry);
          t.push(p);
          if (assign(i + 1)) return true;
          t.pop();
        }
        return false;
      }
      if (!assign(0)) {
        complete = false;
        break;
      }
      const round = { number: r, frozen: false, attendees: people, tables };
      rounds.push(round);
      for (const t of tables)
        for (let i = 0; i < t.length; i++)
          for (let j = i + 1; j < t.length; j++) {
            const k = pairKey(t[i], t[j]);
            counts.set(k, (counts.get(k) ?? 0) + 1);
          }
    }
    if (complete) {
      updateBest(rounds);
      if (bestScore[0] === 0) break;
    }
  }
  if (!best)
    return {
      status: "budget-exhausted",
      reasons: [
        "No valid full plan found within this work budget. This is not a proof of impossibility.",
      ],
      workUsed,
    };
  const plan = {
    schemaVersion: 1,
    kind: "round-loom-plan",
    input,
    rounds: best,
    search: {
      seed: input.seed,
      workBudget: input.workBudget,
      workUsed,
      status: "best-found",
    },
    audit: auditPlan(input, best),
  };
  return { status: "best-found", plan };
}
