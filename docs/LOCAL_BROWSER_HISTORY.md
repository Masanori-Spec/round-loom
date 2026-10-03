# Initial local browser attempt

Date: 2026-10-03. This historical record describes the initial cloud-workspace attempt only.

Sandbox-enabled Chromium failed before any scenario ran with `socket() failed: Operation not permitted` and ptrace restrictions. The recorded state was `blocked`, stage `browser-launch`, `testsRun: 0`, `sandbox: true`. The sandbox was not disabled, and no screenshots, print rendering, mobile checks, or browser downloads were claimed from this attempt.

The full local log remains a development artifact excluded from the distribution archive. No browser execution was retried locally during documentation follow-through.

A later, separate [hosted CI run](https://github.com/Masanori-Spec/round-loom/actions/runs/37141006704) passed all 13 scenarios with the sandbox enabled. See [current verification evidence](VERIFICATION.md). That successful run supplies the missing evidence; it does not change the status of this local attempt.
