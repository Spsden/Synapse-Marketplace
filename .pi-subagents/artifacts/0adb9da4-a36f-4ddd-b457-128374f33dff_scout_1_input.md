# Task for scout

READ-ONLY audit of the Synapse SDK + packaging CLI at /Users/pratap/code/Synapse-SDK (branch feature/mcp-support; there are uncommitted lockfile changes — do NOT touch any uncommitted file, do not run git checkout/reset/add/commit). Do not modify anything.

Map with exact file paths + line ranges:
- The CLI: existing commands, entry points, how the package is structured.
- Current .synx package format: archive structure, manifest.json schema in FULL (both v1 and v2 if both exist — capture every field), how plugin.js + assets are bundled, any hashing/signing today.
- Manifest validation logic that exists today, if any: action IDs, trigger uniqueness, I/O schemas, named connections, MCP server/tool declarations, host capabilities, network domains, platform identifiers.
- The FJS/QuickJS host contract: what plugin.js must export, the sandbox, the capabilities model, how plugin code is executed.
- Any Agent Skill support: SKILL.md parsing, synapse.skill.json, references/, scripts/, assets/ handling.
- Build/packaging path and whether it is deterministic today (entry ordering, timestamps, compression) — or not.
- Capability intersection model: how session capabilities, skill-declared requirements, user grants, and platform availability are (or should be) intersected.
- Tooling for tests, linting, type checking, dependency/license analysis, secret scanning (if any).

Capture language/toolchain/package manager/test framework + run commands. Capture the manifest v2 schema verbatim if present. Flag backward-compatibility constraints for existing .synx packages.

Write a structured recon report to {output}.

---
**Output:**
Write your findings to exactly this path: /Users/pratap/code/Synapse-Marketplace/.pi-subagents/artifacts/outputs/0adb9da4-a36f-4ddd-b457-128374f33dff/recon/sdk.md
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