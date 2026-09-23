# Task for researcher

Research with primary-source citations the hybrid GitHub + backend extension-marketplace architecture we are adopting for Synapse, modeled on Raycast and WinGet. Keep it implementation-oriented — we need concrete schema/practice details to design our own system.

Cover each of these with source URLs + short quotes where useful, and note confidence + gaps:
1. Raycast extension store: where source lives, the review/PR flow, manifest schema shape, the permissions/capability model, and the human-readable PERMISSION REPORT format Raycast shows on install.
2. WinGet: how manifests are GitHub-sourced (winget-pkgs repo), PR submission + bot/automated review, the hierarchical manifest YAML, validation pipelines, how the REST source/index relates to the GitHub manifests, and fields for compatibility/architecture/min-version/revocation.
3. Open VSX / VS Code marketplace for comparison (GitHub-sourced extensions, .vsix packaging, signing, registry index).
4. Deterministic archive creation: how to make zip builds reproducible (stable entry ordering, normalized timestamps/mode, fixed compression), with concrete tooling/options.
5. Whole-package signing + provenance: Sigstore/cosign/gitsign, in-toto/SLSA provenance, signing-provider interface patterns, keyless vs KMS, what gets signed (archive hash) and how to express a trust model where 'a package hash is NOT publisher authentication' (sign the hash with a publisher/CI identity + a provenance attestation binding source commit → artifact).
6. Signed registry-index formats: how a signed registry.json / manifest list carrying hashes, signatures, signing key id, compatibility, and a revocation list is structured and served over a CDN; snapshot vs delta models.
7. Capability-diff / permission-report generation: how to compute the diff between a new and a published version's declared capabilities and render a human-readable report.
8. Security pitfalls to avoid: pull_request_target abuse, executing untrusted fork code with secrets, symlink/path traversal (zip-slip), duplicate zip entries, oversized archives, and how trusted post-merge publishing workflows stay isolated from PR code.

Write the brief to {output}.

---
Update progress at: /Users/pratap/code/Synapse-Marketplace/.pi-subagents/artifacts/progress/0adb9da4-a36f-4ddd-b457-128374f33dff/progress.md

---
**Output:**
Write your findings to exactly this path: /Users/pratap/code/Synapse-Marketplace/.pi-subagents/artifacts/outputs/0adb9da4-a36f-4ddd-b457-128374f33dff/recon/research.md
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