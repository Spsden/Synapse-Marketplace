Read-only audit complete. The recon report is written to the authoritative output path. No repository files were modified (only the two pre-existing uncommitted lockfiles remain, untouched).

## Summary of findings

**CLI** (`cli/`): commander-based, bin `synapse`/`synx`, four commands — `package`, `validate`, `info`, `init`. All validation is hand-rolled in `cli/src/commands/validate.ts`; the JSON Schema is editor-only (no ajv at runtime).

**`.synx` format**: ZIP (archiver, zlib level 9) with `manifest.json` + `plugin.js` (required) and optional `icon.png`/`README.md`/`LICENSE` — **fixed filename set, no directory/glob support**. Integrity = `sha256-<plugin.js>` stored as `security.contentHash`. **No package-level signature; not deterministic** (no fixed timestamps/entry sort/canonical JSON).

**Manifest v2 schema** captured verbatim in §4 (the only schema — v1 was hard-deleted in commit `f08d104`). Key construct: `actions[].requirements[]` is a `oneOf` of connection/mcp/host/network, with the `mcp`↔`security.permissions` cross-check enforced.

**Validation gaps flagged**: I/O schemas free-form & never structurally checked; `host.capability`, `network.domains`, `platforms` declared but not enforced; MCP `serverId`/tools unresolved (registry's job); validator's `id` regex diverges from the schema's.

**Host contract**: plugin is plain JS in a shared QuickJS/flutter_js sandbox; registers handlers on the global `synapse`; talks to host via JSON `sendMessage`/`_bridge.resolve`. Reference host (`flutter_example`) **lags the v2 surface** — doesn't handle connection/config/system/mcp messages.

**Agent Skills**: none exist (no SKILL.md, synapse.skill.json, references/, scripts/, assets/ handling).

**Capability intersection**: declared in manifest v2 + described one-way in `docs/MANIFEST_V2.md`, but the actual intersection engine lives in the Marketplace registry + runtime host — **not in this repo**.

**Tooling**: npm; tsup (SDK) / tsc (CLI); ad-hoc `node vm` test harnesses (no jest/vitest); **no lint, license/dep analysis, or secret scanning**.