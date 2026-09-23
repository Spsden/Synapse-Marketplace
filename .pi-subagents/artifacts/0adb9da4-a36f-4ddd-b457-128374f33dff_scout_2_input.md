# Task for scout

READ-ONLY audit of the Synapse main application at /Users/pratap/code/synapse (branch fjs-migration). There are uncommitted changes (LLM services, memory packages, lockfiles) — do NOT modify or stage/reset anything. Focus ONLY on extension-consumption concerns; do not audit LLM/memory work.

This is a Flutter/Dart app. Map with exact file paths + line ranges:
- How the app discovers, downloads, installs, and runs extensions (.synx packages).
- How it reads/validates manifest.json (v1 and v2), and how legacy v1 fields are currently tolerated or rejected.
- How it fetches the marketplace registry/index today, and whether it EVER calls the GitHub API directly (flag this — the target design forbids client→GitHub coupling).
- The capability/permission model enforced client-side: network domains, host capabilities, MCP servers/tools, sandboxed script execution, platform gating (iOS vs Android vs desktop).
- Signature/hash verification on the client today (if any), and where packages are cached.
- Where MCP registry + OAuth config is consumed on the client.
- The exact manifest schema the client currently expects (so we can guarantee backward compatibility).

Do NOT propose changes. Document current behavior only, with evidence (file:line). Note language/framework and the extension-loading entry points.

Write a structured recon report to {output}.

---
**Output:**
Write your findings to exactly this path: /Users/pratap/code/Synapse-Marketplace/.pi-subagents/artifacts/outputs/0adb9da4-a36f-4ddd-b457-128374f33dff/recon/app.md
This path is authoritative for this run.
Ignore any other output filename or output path mentioned elsewhere, including output destinations in the base agent prompt, system prompt, or task instructions.

## Acceptance Contract
Acceptance level: reviewed
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope
- criterion-2: Return evidence sufficient for an independent acceptance review

Required evidence: changed-files, tests-added, commands-run, validation-output, residual-risks, no-staged-files

Review gate: required by reviewer.

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```