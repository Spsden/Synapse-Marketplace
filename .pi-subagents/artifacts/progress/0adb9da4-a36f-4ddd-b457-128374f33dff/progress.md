# Progress — Recon: hybrid GitHub + backend marketplace architecture

Status: COMPLETE — writing final brief.

Research covered (all 8 requested areas, primary sources fetched):
1. Raycast extension store — security doc + "how API/extensions work" blog + GitHub issues #101/#200 (manifest/permission model). Note: Raycast has NO manifest-declared capability model or install-time PERMISSION REPORT today — relies on code review + OS TCC. Flagged as correction.
2. WinGet — winget-pkgs repo README, manifest schema v1.12 README, installer.md (full field list), version.md, validation pipeline YAML, copilot-instructions, REST source repo.
3. Open VSX / VS Code — publishing wiki, signing PR #673 / issue #543, vsce OIDC, VS Marketplace repo signing.
4. Deterministic zip — reproducible-builds.org archives/stable-inputs, repro-zipfile, deterministic-zip, strip-nondeterminism.
5. Signing/provenance — cosign sign-blob (keyless/KMS), gitsign, SLSA provenance v1.1, in-toto attestations, actions/attest-build-provenance.
6. Signed registry index — TUF spec (roles/snapshot/timestamp), TAP-16 delta snapshots, PEP 740, Cargo sparse index.
7. Capability-diff — design synthesis grounded in WinGet fields + Raycast non-model.
8. Security pitfalls — pull_request_target pwn-request (GitHub Security Lab), zip-slip (Snyk + CVEs), Disguises duplicate-entry, trusted publishing isolation (npm/PyPI OIDC).

Output: writing to artifacts/outputs/.../recon/research.md
