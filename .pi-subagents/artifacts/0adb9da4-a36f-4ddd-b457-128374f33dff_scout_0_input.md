# Task for scout

READ-ONLY audit of the Synapse Marketplace backend at /Users/pratap/code/Synapse-Marketplace (branch codex/mcp-registry-control-plane, currently clean). Do not modify any files.

Map the COMPLETE current extension lifecycle in this repo with exact file paths + line ranges as evidence:
- Package submission flow: how a .synx package is submitted/uploaded today end to end.
- Review/approval state machine: where it lives (DB tables, services, API/edge routes), states and transitions.
- The StorageService abstraction: its interface/type, all current providers (Supabase Storage / Cloudflare R2 / local), how artifacts are written and read, and the CURRENT upload + download path that must be preserved during migration.
- Database schema inventory: every table related to extensions, manifests, versions, publishers, the MCP registry, OAuth config, analytics, ratings, downloads/installs. Capture column names + types.
- The current registry/index/manifest model served to clients (any registry.json or equivalent).
- Supabase usage: auth, RLS policies, storage, edge functions, triggers.
- API surface (REST/RPC/edge) for discovery, search, download, install, MCP registry.
- Any signing/hashing that exists today (and what is NOT signed).
- MCP registry + OAuth configuration handling.
- Publisher authentication/identity.

Also capture: tech stack, language, framework, package manager, how to run + test locally (commands), env/secrets shape (do NOT print secret values).

Write a structured recon report to {output} with sections: Repo Overview; Architecture Summary; End-to-end submission→review→storage→publication→download flow as a numbered sequence with file refs; DB schema inventory; StorageService contract; MCP/OAuth; a preliminary keep/adapt/deprecate classification; local run/test commands; Backward-compatibility must-haves; Open questions. Be evidence-backed with file:line refs throughout.

---
**Output:**
Write your findings to exactly this path: /Users/pratap/code/Synapse-Marketplace/.pi-subagents/artifacts/outputs/0adb9da4-a36f-4ddd-b457-128374f33dff/recon/marketplace.md
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