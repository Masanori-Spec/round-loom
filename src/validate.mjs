// Deliberately independent of the search algorithm and its scoring helpers.
import {
  normalizeInput,
  attendeesFor,
  InputError,
  isDenseArray,
} from "./schema.mjs";
export function validatePlan(inputRaw, rounds) {
  let input;
  try {
    input = normalizeInput(inputRaw);
  } catch (e) {
    return { valid: false, errors: [e.message] };
  }
  const errors = [];
  if (
    !Array.isArray(rounds) ||
    rounds.length !== input.roundCount ||
    !isDenseArray(rounds)
  )
    return { valid: false, errors: ["Round count mismatch"] };
  rounds.forEach((r, i) => {
    const tag = `Round ${i + 1}`;
    if (!r || typeof r !== "object" || Array.isArray(r)) {
      errors.push(`${tag}: malformed round`);
      return;
    }
    if (r.number !== i + 1 || r.frozen !== i < input.frozenRounds.length)
      errors.push(`${tag}: number or frozen flag mismatch`);
    const hist = input.frozenRounds[i];
    const expected = hist ? hist.attendees : attendeesFor(input, i + 1);
    if (
      !Array.isArray(r.attendees) ||
      r.attendees.length !== expected.length ||
      !isDenseArray(r.attendees) ||
      new Set(r.attendees).size !== r.attendees.length ||
      r.attendees.some((p) => !expected.includes(p))
    )
      errors.push(`${tag}: attendance mismatch`);
    if (
      !Array.isArray(r.tables) ||
      r.tables.length !== input.tableCount ||
      !isDenseArray(r.tables) ||
      r.tables.some(
        (t) => !Array.isArray(t) || t.length > 24 || !isDenseArray(t),
      )
    ) {
      errors.push(`${tag}: table shape mismatch`);
      return;
    }
    const flat = r.tables.flat();
    if (
      flat.length !== expected.length ||
      new Set(flat).size !== flat.length ||
      flat.some((p) => !expected.includes(p))
    )
      errors.push(`${tag}: missing, duplicate, or unexpected participant`);
    const sizes = r.tables.map((t) => t.length);
    if (
      sizes.some((n) => n === 0) ||
      Math.max(...sizes) - Math.min(...sizes) > 1
    )
      errors.push(`${tag}: tables must be nonempty and balanced`);
    if (hist) {
      if (
        JSON.stringify(r.tables) !== JSON.stringify(hist.tables) ||
        JSON.stringify(r.attendees) !== JSON.stringify(hist.attendees)
      )
        errors.push(`${tag}: frozen history changed`);
    } else {
      if (sizes.some((n) => n > input.maxPerTable))
        errors.push(`${tag}: capacity exceeded`);
      for (const [a, b] of input.keepApart)
        if (r.tables.some((t) => t.includes(a) && t.includes(b)))
          errors.push(`${tag}: keep-apart violated`);
    }
  });
  return { valid: errors.length === 0, errors };
}
export function auditPlan(inputRaw, rounds) {
  const input = normalizeInput(inputRaw),
    check = validatePlan(input, rounds);
  if (!check.valid)
    throw new InputError(check.errors.join("; "), "invalid-plan");
  const n = input.participants.length,
    matrix = Array.from({ length: n }, () => Array(n).fill(0)),
    index = new Map(input.participants.map((p, i) => [p, i]));
  let totalPairEncounters = 0;
  for (const r of rounds)
    for (const t of r.tables)
      for (let a = 0; a < t.length; a++)
        for (let b = a + 1; b < t.length; b++) {
          const i = index.get(t[a]),
            j = index.get(t[b]);
          matrix[i][j]++;
          matrix[j][i]++;
          totalPairEncounters++;
        }
  let uniquePairs = 0,
    maxPairCount = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (matrix[i][j]) uniquePairs++;
      maxPairCount = Math.max(maxPairCount, matrix[i][j]);
    }
  const repeatEncounters = totalPairEncounters - uniquePairs;
  // A deliberately conservative pigeonhole bound. Attendance need not be constant:
  // all encounters use this fixed roster, so at most n(n-1)/2 different pairs exist.
  // Constraints and absences can make this bound loose; it does not prove a plan optimal.
  const possiblePairs = (n * (n - 1)) / 2,
    repeatLowerBound = Math.max(0, totalPairEncounters - possiblePairs);
  return {
    totalPairEncounters,
    uniquePairs,
    repeatEncounters,
    maxPairCount,
    possiblePairs,
    repeatLowerBound,
    lowerBoundScope:
      "All rounds including frozen history; fixed roster; unordered pairs; every pair counted at most once per round. Capacity, keep-apart, and absences can make this conservative bound loose.",
    matrix,
    perParticipant: input.participants.map((participant, i) => ({
      participant,
      uniquePeople: matrix[i].filter((x) => x > 0).length,
      repeatEncounters: matrix[i].reduce(
        (sum, x) => sum + Math.max(0, x - 1),
        0,
      ),
    })),
  };
}
export function verifyDocument(raw) {
  if (!raw || raw.schemaVersion !== 1 || raw.kind !== "round-loom-plan")
    throw new InputError("Not a Round Loom plan", "invalid-plan");
  const input = normalizeInput(raw.input);
  const check = validatePlan(input, raw.rounds);
  if (!check.valid)
    throw new InputError(check.errors.join("; "), "invalid-plan");
  if (
    !raw.search ||
    !Number.isSafeInteger(raw.search.workUsed) ||
    raw.search.workUsed < 0 ||
    raw.search.workUsed > input.workBudget ||
    raw.search.seed !== input.seed ||
    raw.search.workBudget !== input.workBudget ||
    raw.search.status !== "best-found"
  )
    throw new InputError("Invalid search metadata", "invalid-plan");
  // Never trust imported audit metrics; recompute independently.
  return {
    schemaVersion: 1,
    kind: "round-loom-plan",
    input,
    rounds: raw.rounds.map((r) => ({
      number: r.number,
      frozen: r.frozen,
      attendees: [...r.attendees],
      tables: r.tables.map((t) => [...t]),
    })),
    search: {
      seed: input.seed,
      workBudget: input.workBudget,
      workUsed: raw.search.workUsed,
      status: "best-found",
    },
    audit: auditPlan(input, raw.rounds),
  };
}
