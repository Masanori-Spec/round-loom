import { solve } from "./src/solver.mjs";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ id: data.id, result: solve(data.input) });
  } catch (e) {
    self.postMessage({ id: data.id, error: e.message });
  }
};
