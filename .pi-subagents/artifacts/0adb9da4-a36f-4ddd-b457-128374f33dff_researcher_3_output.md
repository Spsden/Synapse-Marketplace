# Research: Hybrid GitHub + Backend Extension-Marketplace Architecture (Raycast + WinGet model)

> Goal: implementation-oriented recon for Synapse's hybrid marketplace — a **GitHub monorepo as the source of truth for manifests/PR review**, a **backend that compiles reviewed PRs into a signed, CDN-served registry index**, with **deterministic archive builds**, **whole-package signing + provenance**, and a **capability-diff permission report**. Confidence per section. All claims are primary-sourced; gaps noted at the end.

---

## Summary

The two reference systems converge on a clear pattern: **WinGet** keeps every package manifest as hierarchical YAML in a public GitHub repo (`microsoft/winget-pkgs`), gates every change behind a one-package-per-PR rule, runs an Azure DevOps validation pipeline that must pass before an auto-merge label is applied, and compiles those manifests into a queryable REST/MSIX index. **Raycast** uses an open monorepo + PR review model but notably has **no manifest-declared capability model and no install-time permission report** — it relies on mandatory code review, open-source transparency, and macOS's OS-level (TCC) permission prompts; a declarative sandbox/permission system has been explicitly requested but not built. For Synapse, the high-leverage primitives are: deterministic zip archives (normalized timestamps/order/permissions), Sigstore keyless signing of the archive hash plus an in-toto/SLSA provenance attestation binding the source commit → artifact, a TUF-style signed registry index (snapshot + timestamp roles, optional delta) carrying hashes/signatures/compatibility/revocation, and a self-computed capability-diff report rendered from declared manifest fields.

---

## 1. Raycast extension store

**Confidence: High** on architecture/review flow; **High but counter-intuitive** on the permission model (Raycast does *not* do what the task assumes).

1. **Source lives in an open GitHub monorepo; store content is built from reviewed PRs.** "For developers to get their extension into the store and share it with others, we piggyback on GitHub's infrastructure – an open monorepository and pull request workflow for reviews. When someone creates the pull request, we run a couple of automated checks with manifest checking, linting, asset checks for the store, and so on." ([How the Raycast API and extensions work](https://www.raycast.com/blog/how-raycast-api-extensions-work)). Repo: [`raycast/extensions`](https://github.com/raycast/extensions) (CONTRIBUTING points to [Create Your First Extension](https://developers.raycast.com/basics/create-your-first-extension) + [Community](https://manual.raycast.com/community-guidelines)/[Extension guidelines](https://manual.raycast.com/extensions)).

2. **CI checks the manifest against a schema, validates assets, and builds/types.** "Before an extension gets merged into the public repository, members from Raycast and the community collaboratively review extensions… After the code review, the Continuous Integration system performs a set of validations to make sure that manifest conforms to the defined schema, required assets have the correct format, the author is valid, and no build and type errors are present." The built extension is then "archived and uploaded to the Raycast Store." ([Security | Raycast API](https://developers.raycast.com/information/security)).

3. **The manifest is a `package.json` with per-command entries** (commands carry `mode`, `arguments`, `icon`, etc.) and a `preferences` array for user-configurable inputs; the API package version (an npm dependency) is the compatibility signal. Raycast intentionally does **not** use SemVer for distribution: "only publish one latest version… developers don't need to specify a version in their extension… The only version that developers really need to care about is the API version." ([How the Raycast API and extensions work](https://www.raycast.com/blog/how-raycast-api-extensions-work)). *Note: the canonical package.json field reference page moved; treat the developer docs as authoritative and version pin the API `@raycast/api` dependency.*

4. **CRITICAL CORRECTION — Raycast has no manifest-declared capability model and no install-time PERMISSION REPORT.** "Extensions are **not further sandboxed** as far as policies for file I/O, networking, or other features of the Node runtime are concerned… By default and similar to other macOS apps, accessing special directories… first requires users to give **permissions** to Raycast (parent process) via the **macOS Security & Preferences** pane." ([Security | Raycast API](https://developers.raycast.com/information/security)). The sandbox was *considered and rejected*: "we considered sandboxing but rejected it… Not only does development become more complicated; you also need to show and explain permissions to users. At some point they're likely to ignore these… Preferably, a rogue extension doesn't get installed on an end user's machine at all… So far we've been following an approach that needs *all* extensions to be reviewed and open source." They also maintain a VS Code-style "kill list" of flagged extensions that get auto-uninstalled. ([How the Raycast API and extensions work](https://www.raycast.com/blog/how-raycast-api-extensions-work)).

5. **A declarative permission/capability system is an open, explicitly-requested feature — not something that exists.** Issue #101 ("[API Feature Request] Permissions") and Issue #200 ("[API Feature Request] Extension sandboxing and permissions system") both ask for exactly what the task describes: "Extensions could then declare the permissions they require via the `package.json` manifest file" and be sandboxed by default (no fs/network/clipboard/exec). These are **requests**, not shipped behavior. ([raycast/extensions #101](https://github.com/raycast/extensions/issues/101), [raycast/extensions #200](https://github.com/raycast/extensions/issues/200)).
   > **Implication for Synapse:** do *not* copy a "Raycast PERMISSION REPORT" — it doesn't exist. The honest Raycast lesson is the *opposite* trade-off (review-heavy, no sandbox). If Synapse wants a declarative capability report (the task's goal), it is designing something Raycast deliberately deferred. Build it from scratch using the WinGet/TUF primitives below.

---

## 2. WinGet (winget-pkgs)

**Confidence: High** — schemas and pipeline fetched verbatim.

6. **GitHub repo is the source of truth; manifests are hierarchical YAML, one version per PR.** "Only one package version (one multi-file manifest set) may be submitted per PR." A multi-file manifest set = one **version** file + one **defaultLocale** + one **installer** + optional **locale** files. Folder layout is content-addressed by identifier: `manifests/<first-letter>/<publisher>/<package>/<version>/<publisher>.<package>.<manifestFile>.yaml` (e.g. `manifests/m/Microsoft/WindowsTerminal/1.9.1942/…`). ([winget-pkgs README](https://github.com/microsoft/winget-pkgs/blob/master/doc/README.md), [Authoring.md](https://github.com/microsoft/winget-pkgs/blob/master/doc/Authoring.md), [schema 1.12 README](https://github.com/microsoft/winget-pkgs/blob/master/doc/manifest/schema/1.12.0/README.md)).

7. **The PR template enforces CLA + single-package-per-PR + "checked for duplicates".** ([.github/PULL_REQUEST_TEMPLATE.md](https://github.com/microsoft/winget-pkgs/blob/master/.github/PULL_REQUEST_TEMPLATE.md)). Local pre-check: `winget validate --manifest <path>` then `winget install --manifest <path>` in a Windows Sandbox ([Submit your manifest — Microsoft Learn](https://learn.microsoft.com/en-us/windows/package-manager/package/repository)).

8. **Automated Azure DevOps validation pipeline gates every PR; labels drive auto-merge.** "After you submit a pull request… an automated process [runs] a series of checks." The pipeline runs **file validation, URL scanning, SmartScreen reputation checks, manifest policy checks, installation verification, and installer metadata validation**. "PRs are auto-merged when the `Validation-Completed` label is applied (squash merge). Contributors must sign the Microsoft CLA." ([.github/copilot-instructions.md](https://github.com/microsoft/winget-pkgs/blob/master/.github/copilot-instructions.md), [DevOpsPipelineDefinitions/validation-pipeline.yaml](https://github.com/microsoft/winget-pkgs/blob/master/DevOpsPipelineDefinitions/validation-pipeline.yaml), [ValidationFailureGuide.md](https://github.com/microsoft/winget-pkgs/blob/master/doc/ValidationFailureGuide.md)). Pipeline vars expose `WinGetSvc.PullRequestNumber` / `WinGetSvc.OperationId` so each validation run is traceable to a PR.

9. **Concrete schema fields for compatibility / architecture / min-version** (v1.12.0 `installer.yaml`, fetched in full). The fields Synapse should mirror:
   - **Versioning/identity:** `PackageIdentifier` (`Publisher.Package`, case-sensitive, must match folder path), `PackageVersion`, `DefaultLocale` (BCP-47), `Channel`. ([version.md](https://github.com/microsoft/winget-pkgs/blob/master/doc/manifest/schema/1.12.0/version.md))
   - **Compatibility/min-version:** `Platform` (`Windows.Desktop`/`Windows.Universal`), `MinimumOSVersion`, `Scope` (`user`/`machine`), `ElevationRequirement` (`elevationRequired`/`elevatesSelf`/`elevationProhibited`), `UnsupportedOSArchitectures`.
   - **Architecture:** `Architecture` ∈ {`x86`, `x64`, `arm`, `arm64`, `neutral`} (one installer node per architecture; root values are inherited by all `Installers:` entries unless overridden).
   - **Integrity:** `InstallerSha256` (required; "compared with the calculated hash… after it has been downloaded"), `SignatureSha256` (SHA-256 of the MSIX `AppxSignature.p7x`; **MSIX installers must be signed** to enter the repo), per-file `InstallationMetadata.Files[].FileSha256`.
   - **Capabilities model (only for MSIX apps):** `Capabilities` and `RestrictedCapabilities` carry the MSIX [app-capability declarations](https://docs.microsoft.com/windows/uwp/packaging/app-capability-declarations).
   - **Dependencies:** `Dependencies.{PackageDependencies, WindowsFeatures, WindowsLibraries}` (ExternalDependencies "Not implemented").
   - **ARP correlation:** `AppsAndFeaturesEntries[]` (`DisplayName`, `DisplayVersion`, `Publisher`, `ProductCode`, `UpgradeCode`, `InstallerType`) to match installed packages back to manifests.
   - **Markets/revocation-adjacent:** `Markets`/`ExcludedMarkets` (geo allow/deny), `DownloadCommandProhibited`, `UpgradeBehavior: deny` (stops self-upgrade). ([installer.md](https://github.com/microsoft/winget-pkgs/blob/master/doc/manifest/schema/1.12.0/installer.md))
   > Minimal real example: `PackageIdentifier: Microsoft.WindowsTerminal / PackageVersion: 1.9.1942.0 / Installers: [{Architecture: x64, InstallerType: msix, InstallerUrl: <url>, InstallerSha256: 578D…28D5, SignatureSha256: 889A…0659}]`.

10. **REST source / index is a compiled artifact derived from the GitHub manifests, not the manifests themselves.** The community repo is the authoring/source layer; clients query a separate **REST source** (reference impl [`microsoft/winget-cli-restsource`](https://github.com/microsoft/winget-cli-restsource), Azure-hosted, CosmosDB-backed) or a compressed **`source.msix` index** (e.g. `https://winget.azureedge.net/cache/source.msix`). The client does API-contract version negotiation, builds a local cache, and can fall back to the MSIX index if the REST API is offline. ([Repository REST API #118](https://github.com/microsoft/winget-cli/issues/118), [REST Client and Package Sources — DeepWiki](https://deepwiki.com/microsoft/winget-cli/3.3-rest-client-and-package-sources)). **Revocation/compat note:** WinGet has no explicit "revocation list" field — removal is *deletion* of a manifest from the repo (the compiled index simply omits it on next rebuild); a "kill list" lives client-side (e.g. blocked package IDs). The `ManifestVersion` + `ManifestType` keys are how validation selects rule sets.

---

## 3. Open VSX / VS Code Marketplace (comparison)

**Confidence: High.**

11. **`.vsix` is a signed ZIP of the extension + a `package.json` manifest + an `[Content_Types].xml`.** Packaged via `vsce package` (or `ovsx` for Open VSX). `vsce publish --oidc` publishes from GitHub Actions **without a stored PAT** via a trusted-publishing policy + OIDC token. ([microsoft/vscode-vsce](https://github.com/microsoft/vscode-vsce/), [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)). `vsce generate-manifest` / `vsce publish --packagePath --manifestPath --signaturePath` support split manifest+signature publishing ([vsce #993](https://github.com/microsoft/vscode-vsce/issues/993)).

12. **Open VSX added repository-level extension signing.** PR #673 (issue #543) implements: generate a signature when a `.vsix` is published; serve it via the REST API (`files.download`); migrate existing packages to carry a signature; **mirror signatures**; and **verify the signature when mirroring** to prevent tampering. ([openvsx #673](https://github.com/eclipse/openvsx/pull/673), [openvsx #543](https://github.com/eclipse/openvsx/issues/543)). Publishing requires an Eclipse account + signed Publisher Agreement; recommended path is CI/CD via the [`EclipseFdn/publish-extensions`](https://github.com/open-vsx/publish-extensions/blob/master/docs/direct_publish_setup.md) GitHub Actions template.

13. **The VS Code Marketplace itself enforces repository signature verification at install.** "Marketplace repository signs all VS Code extensions when they're published. By default, the repository signature verification is enforced at install time, which checks the integrity and source of the extension package." Also: secret-scanning to block extensions containing leaked secrets. ([Security and Trust in VS Marketplace](https://developer.microsoft.com/blog/security-and-trust-in-visual-studio-marketplace)). VSIX signing best practice: add a digital signature so "if the contents of the VSIX are modified without updating the signature, the installer… warns the user of an invalid package signature." ([Signing VSIX Packages — MS Learn](https://learn.microsoft.com/en-us/visualstudio/extensibility/signing-vsix-packages?view=vs-2022)).
   > **Synapse takeaway:** VSIX is the proof that "store signs every package at publish time + client verifies at install" is the industry default. Replicate it: backend signs the deterministic archive hash, clients verify before unpack.

---

## 4. Deterministic archive creation

**Confidence: High** — these are the canonical reproducible-builds rules; tooling listed concretely.

14. **A deterministic zip needs four fixes: stable entry order, fixed/normalized mtimes, normalized file mode + ownership, and stripped non-deterministic "extra" fields.** Metadata that breaks reproducibility by default: "file last modification time… but file ordering, users, groups, numeric ids, and permissions can also be of concern." ([Archive metadata — reproducible-builds.org](https://reproducible-builds.org/docs/archives/)).

    - **Order:** sort entries locale-independently ("`--sort=name`… locale independent manner"; sort in `LC_ALL=C`). "Most filesystems do not guarantee that listing files… always results in the same order." ([Stable order for inputs](https://reproducible-builds.org/docs/stable-inputs/)).
    - **Timestamps:** clamp to `SOURCE_DATE_EPOCH`. `find build -print0 | xargs -0r touch --no-dereference --date="@${SOURCE_DATE_EPOCH}"` then zip; or clamp only newer files. For zip the minimum legal DOS time is **1980-01-01 00:00:00**. ([Archive metadata](https://reproducible-builds.org/docs/archives/), [reproducible_zip](https://pypi.org/project/reproducible_zip/)).
    - **Permissions/owner:** use deterministic modes (avoid `umask` drift) and `0`/`0` ownership.
    - **Zip "extra" fields:** "When creating `.zip` files, it is recommended to use the `--no-extra` / `-X` argument to not save these fields" (they store extra mtimes, xattrs, uid/gid). Extract with `TZ=UTC`. ([Archive metadata](https://reproducible-builds.org/docs/archives/)).

15. **Concrete tooling (pick one):**
    - **Python:** [`repro-zipfile`](https://github.com/drivendataorg/repro-zipfile) — "a tiny, zero-dependency replacement for `zipfile.ZipFile`… sorts all directories and files (directories first), timestamp set to 1980-01-01, fixed 0644/0755 modes, deterministic." ([reproducible_zip](https://pypi.org/project/reproducible_zip/)).
    - **Node/Go (npm/binary):** [`deterministic-zip`](https://www.npmjs.com/package/deterministic-zip) / [`timo-reymann/deterministic-zip`](https://github.com/timo-reymann/deterministic-zip) — "removes all metadata… immutable… supports `SOURCE_DATE_EPOCH`." Also [`deterministic-zip-ts`](https://www.npmjs.com/package/deterministic-zip-ts).
    - **Post-processing normalizer:** Debian [`strip-nondeterminism`](https://manpages.debian.org/testing/strip-nondeterminism/strip-nondeterminism.1p.en.html) — "strip bits of nondeterministic information, such as timestamps, from files" with a `zip`/`jar`/`gzip`/`ar` normalizer and `-T/--timestamp`. Useful if your build tool can't be made deterministic.
    - **git-based source export:** `git archive` is *not* guaranteed deterministic (uses commit time, internal gzip varies); prefer `git archive --format=tar TAG | gzip -6 -n`. ([Archive metadata](https://reproducible-builds.org/docs/archives/)).
    > **Synapse recipe:** build in a fixed `TZ=UTC`, pin `SOURCE_DATE_EPOCH=<commit-timestamp>`, use `repro-zipfile` (Python) or `deterministic-zip` (Node) with `-X`-equivalent metadata stripping, stable sorted entry order, and `0644`/`0755` modes. Then the archive SHA-256 is a reliable integrity anchor for signing (§5).

---

## 5. Whole-package signing + provenance

**Confidence: High.** Core principle for the trust model the task asks about.

16. **"A package hash is integrity, not authentication."** A hash proves bytes haven't changed; it says nothing about *who* produced them. WinGet encodes this distinction directly: `InstallerSha256` = integrity (compared post-download), `SignatureSha256` = the MSIX's embedded signature = authenticity, and MSIX packages **must be signed** to be admitted. ([installer.md](https://github.com/microsoft/winget-pkgs/blob/master/doc/manifest/schema/1.12.0/installer.md)). The fix to the trust gap is: **sign the hash (or the archive) with a verifiable identity, and attach a provenance attestation binding source-commit → artifact.**

17. **Cosign signs blobs/archives; keyless (OIDC) vs KMS are the two provider modes.**
    - **Keyless:** "associates identities, rather than keys, with an artifact signature. Fulcio issues short-lived certificates binding an ephemeral key to an OpenID Connect identity. Signing events are logged in Rekor, a signature transparency log." `cosign sign-blob <file> --bundle bundle.sigstore.json`. The bundle holds signature + certificate + transparency-log inclusion proof. ([Cosign Signing Overview](https://docs.sigstore.dev/cosign/signing/overview/), [Signing Blobs](https://docs.sigstore.dev/cosign/signing/signing_with_blobs/)).
    - **KMS / self-managed key:** `cosign sign-blob --key <path|kms-uri>`. "cosign supports AWS KMS, GCP KMS, Azure Key Vault, HashiCorp Vault, OpenBao, OVHcloud KMS, Kubernetes Secrets." ([Key Management Overview](https://docs.sigstore.dev/cosign/key_management/overview/), [cosign_sign-blob.md](https://github.com/sigstore/cosign/blob/main/doc/cosign_sign-blob.md)).
    - **CI automation:** add `--yes` to skip prompts in pipelines. ([Signing Blobs](https://docs.sigstore.dev/cosign/signing/signing_with_blobs/)).

18. **Gitsign applies the same keyless/OIDC model to git commits/tags** (Fulcio + Rekor), so source commits themselves carry a verifiable identity. Verify against `certificate-identity` + `certificate-oidc-issuer` (GitHub = `https://github.com/login/oauth`, etc.). Optional `matchCommitter` checks the Fulcio SAN against `user.email`. ([sigstore/gitsign](https://github.com/sigstore/gitsign), [OIDC Verification Cheat Sheet](https://docs.sigstore.dev/quickstart/verification-cheat-sheet/), [gitsign.md](https://github.com/sigstore/docs/blob/main/content/en/cosign/signing/gitsign.md)).

19. **Provenance = in-toto/SLSA attestation binding the subject (archive digest) to a build predicate.** "Attestations bind some subject (a named artifact along with its digest) to a SLSA build provenance predicate using the in-toto format. A verifiable signature is generated… using a short-lived Sigstore-issued signing certificate." SLSA provenance v1.1 records `buildDefinition` (source: `repository.uri` + `revision`, build parameters) and `runDetails` (builder id, timestamp) so a verifier can confirm "where, when, and how something was produced." ([actions/attest-build-provenance](https://github.com/actions/attest-build-provenance), [SLSA Provenance v1.1](https://slsa.dev/spec/v1.1/provenance), [SLSA Attestation Model](https://slsa.dev/spec/v1.2/attestation-model), [cosign attest](https://github.com/sigstore/cosign/blob/main/doc/cosign_attest.md)). Cosign's bundle spec ([BUNDLE_SPEC.md](https://github.com/sigstore/cosign/blob/main/specs/BUNDLE_SPEC.md)) keeps these portable/interoperable.
    > **Synapse signing interface (recommended):** define a `signing-provider` abstraction with two implementations — **(a) keyless (default, GitHub-OIDC in CI):** `cosign sign-blob --yes --bundle <pkg>.sigstore.json <deterministic-archive>`; **(b) KMS (enterprise/air-gapped):** `--key aws-kms://…|gcpkms://…|azurekms://…`. Always also emit `actions/attest-build-provenance` (or `cosign attest --predicate provenance.json --type slsaprovenance`) so the **source commit SHA → archive SHA-256** binding is independently verifiable. The "publisher identity" a client trusts is then the **OIDC identity in the Fulcio cert** (e.g. `repo:org/synapse-extensions` + workflow ref), **not** the hash itself.

---

## 6. Signed registry-index formats

**Confidence: High** (TUF is the canonical design; PEP 740 + sparse indexes are real-world variants).

20. **TUF is the reference model: a tree of signed metadata with four roles, each with an expiration, where *metadata* (not the artifacts) is signed.**
    - **targets** role signs metadata describing target files (their hashes + lengths).
    - **snapshot** role signs a file listing the latest version of *all* targets metadata (top-level + delegated).
    - **timestamp** role signs a small file pointing to the current snapshot — downloaded every update cycle, so it carries the trusted "current state."
    - **root** role cross-signs the keys/thresholds for all other roles.
    - All signed metadata "always include an expiration date… clients can refuse to accept metadata older than" what they already hold. ([Roles and metadata | TUF](https://theupdateframework.io/docs/metadata/), [TUF Specification](https://theupdateframework.github.io/specification/latest/), [TUF Security](https://theupdateframework.io/security/)).

21. **Snapshot vs delta.** The snapshot file grows with the number of targets and is downloaded every cycle — "snapshot metadata for repositories with a high number of targets… can become prohibitively large." **TAP-16** proposes **deltas** to reduce snapshot size without weakening security; the alternative widely-deployed "delta" pattern is a **sparse index** — per-package endpoints returning line-delimited JSON, one line per version in semver-descending order, CDN-fronted (Cargo's `index.crates.io/<shard>/<name>`; the Mochi research index shape: `{"v":"1.2.5","r":"<ts>","b3":"<blake3>","s2":"<sha256>","y":false,"c":["fs.read"],"d":{...},"t":[...]}`). ([TAP-16](https://github.com/theupdateframework/taps/blob/master/tap16.md), [sparse index shape](https://mochi-lang.dev/docs/research/0057/registry-index)).

22. **Real-world attestation-on-index: PEP 740 (PyPI).** Adds upload/download of digital attestations and "Trusted Publishing metadata" surfaced via the simple HTML/JSON APIs as provenance objects — i.e. attestations live *alongside* the per-version index entries rather than only in a separate transparency log. ([PEP 740](https://peps.python.org/pep-0740/)). A catalog-tree pattern (static signed JSON over GET-only paths, e.g. `catalog.json` + `catalog.json.sig` Ed25519) is a minimal viable shape ([example catalog API](https://rave.maccrab.com/docs/catalog-api/), [StreamKit minisign-signed `index.json`](https://streamkit.dev/guides/publishing-plugins/), [voli-registry signed SQLite snapshot](https://github.com/Topurrra/voli-registry)).
    > **Synapse registry index (recommended shape), served over CDN:**
    > ```jsonc
    > // /index/snapshot.json  (TUF snapshot role; signed by snapshot key)
    > {
    >   "schema": 1,
    >   "expires": "2026-12-31T00:00:00Z",
    >   "generated_at": "2026-05-20T12:00:00Z",
    >   "packages": {
    >     "com.synapse.foo": {
    >       "latest": "1.2.5",
    >       "versions": {
    >         "1.2.5": {
    >           "archive": "pkg/foo/1.2.5/foo-1.2.5.zip",
    >           "sha256": "e2d1…",
    >           "sigstore_bundle": "pkg/foo/1.2.5/foo-1.2.5.zip.sigstore.json",
    >           "provenance": "pkg/foo/1.2.5/foo-1.2.5.json.intoto",
    >           "signing_key_id": "fulcio-oidc:repo:org/synapse-extensions:ref:refs/heads/main",
    >           "compat": { "min_platform": "1.0", "architectures": ["x64","arm64"] },
    >           "capabilities": ["fs.read","net.fetch","clipboard.write"],
    >           "revoked": false,            // revocation flag, OR appear in revocations[]
    >           "published_at": "2026-05-20T12:00:00Z"
    >         }
    >       }
    >     }
    >   },
    >   "revocations": []                  // explicit revocation list (ids/versions)
    > }
    > // /index/timestamp.json (tiny, signed by timestamp key) → { "snapshot": "<sha256>", "expires": ... }
    > ```
    > **Snapshot model** = one big signed `snapshot.json` (simplest; fine at small scale). **Delta model** = per-package shard endpoints (`/index/pkgs/<id>.json`, each signed by the targets role) + a small signed `snapshot.json` listing shard hashes + a signed `timestamp.json` (TAP-16). Prefer delta once package count makes the full snapshot large. Revocation = flip `revoked` *and* emit a `revocations[]` entry with a reason; clients reject revoked versions and honor the timestamp expiry to bound replay.

---

## 7. Capability-diff / permission-report generation

**Confidence: Medium-High.** No single off-the-shelf standard does exactly this; the approach below is a synthesis grounded in the WinGet field model (§2) and the OS-permission list Raycast exposes (§1).

23. **Treat the manifest as a normalized, versioned capability set; the diff is set arithmetic across axes.** Map Synapse manifest fields to capability axes (mirror WinGet's vocabulary): `permissions`/`capabilities` (fs/net/clipboard/exec/process — the set Raycast *should* have declared per issue #200), `dependencies` (like `Dependencies.PackageDependencies`), `scope`/`elevation` (like `Scope`/`ElevationRequirement`), `compat` (`MinimumOSVersion`-equivalent `min_platform`, `architectures`, `UnsupportedOSArchitectures`), and `markets`. ([raycast/extensions #200](https://github.com/raycast/extensions/issues/200), [installer.md](https://github.com/microsoft/winget-pkgs/blob/master/doc/manifest/schema/1.12.0/installer.md)).

24. **Algorithm:** (1) parse old (published) and new (PR) manifests into canonical normalized maps; (2) for each axis compute **added** / **removed** / **changed**; (3) classify each delta as **escalation** (wider access — new permission, broader scope, lower `min_platform`, new dependency, new architecture) vs **narrowing**; (4) gate escalation behind stricter review and surface it in the PR and at install. This is the *capability-diff* that replaces the (non-existent) Raycast PERMISSION REPORT.

25. **Human-readable PERMISSION REPORT (rendered at install + in the PR).** Group by severity, surface only deltas on update (full list on first install). Recommended layout:
    ```
    PERMISSION REPORT — com.synapse.foo  1.2.4 → 1.2.5
    ▲ New access requested (review required):
        + net.fetch            (network: outbound HTTP)
        + fs.read:/Documents   (filesystem: read user Documents)
    ▼ Narrowed:
        - clipboard.write
    = Unchanged: exec (denied), scope:user, min_platform 1.0
    Dependencies: + @synapse/db@^2 (was none)
    Compatibility: min_platform 1.0 (unchanged) · arch x64,arm64 (+arm64)
    Signature: verified (Fulcio OIDC repo:org/synapse-extensions) · provenance commit a1b2c3d → sha256 e2d1…
    ```
    Sources informing the *fields* (not the report format, which is Synapse-original): WinGet capability/scope/min-version fields ([installer.md](https://github.com/microsoft/winget-pkgs/blob/master/doc/manifest/schema/1.12.0/installer.md)); the requested permission list ([raycast/extensions #200](https://github.com/raycast/extensions/issues/200)); browser-style install prompts as the UX precedent (the install-time "this extension can access…" pattern Raycast explicitly avoided but Synapse is choosing to adopt).

---

## 8. Security pitfalls to avoid

**Confidence: High.**

26. **`pull_request_target` + checkout of fork code = "pwn request" (secret exfiltration + repo write).** "`pull_request_target`… run with the base repository's `GITHUB_TOKEN`, secrets, and default-branch cache access. Checking out the head of an unreviewed pull request from a fork… typically lets attacker-controlled code execute with the workflow's full privileges." The same applies to `workflow_run`. ([Safer pull_request_target defaults — GitHub Changelog](https://github.blog/changelog/2026-06-18-safer-pull_request_target-defaults-for-github-actions-checkout/), [CodeQL: untrusted checkout in privileged context](https://codeql.github.com/codeql-query-help/actions/actions-untrusted-checkout-critical/), [GitHub Security Lab: preventing pwn requests](https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/), [GitHub Docs: secure use](https://docs.github.com/en/actions/reference/security/secure-use)). *Mitigation:* **validate/review PRs in an unprivileged `pull_request`-triggered workflow** (no secrets, read-only `GITHUB_TOKEN`); **publish only from a trusted post-merge `push`/`workflow_dispatch` job** that runs on reviewed, merged code. Never `checkout` fork `head` into a privileged context; never `run: npm ci && npm run build` fork code with secrets present.

27. **Zip-Slip (path traversal) on extraction.** "Inside ZIP archives, each packed file is stored with a fully qualified name, which allows special characters such as slashes and dots" — an entry like `../../etc/cron.d/x` escapes the dest dir. CWE-22 (path traversal). *Mitigation:* canonicalize each entry name, reject any whose normalized path leaves the target root; never prefix-join unvalidated names. ([Zip Path Traversal — Android/Google](https://developer.android.com/privacy-and-security/risks/zip-path-traversal), [Zip Slip — Snyk](https://security.snyk.io/research/zip-slip-vulnerability)). Also **symlink following** (CWE-61): reject/clear symlinks whose target escapes the root — a live class of CVEs (e.g. extract-zip CVE-2026-56876, the `zip` rust crate CVE-2025-29787). ([NVD CVE-2026-56876](https://nvd.nist.gov/vuln/detail/CVE-2026-56876), [NVD CVE-2025-29787](https://nvd.nist.gov/vuln/detail/CVE-2025-29787)).

28. **Duplicate / "schizophrenic" zip entries.** A single zip can contain two entries with the same path; different extractors (and different scanners) may pick different ones (first vs last), enabling a "social engineering" attack where QA/reviewer sees a benign file and production gets a malicious one. *Mitigation:* reject archives with duplicate entry paths at validation; define a canonical "which entry wins" rule and enforce it in the publisher, not just the client. ([Disguises: Zip Past Path Traversal](https://blog.isec.pl/disguises-zip-past-path-traversal/)).

29. **Oversized archives / decompression bombs.** Bound both compressed and uncompressed size; enforce a **compression ratio** limit; use streaming extraction with a hard byte budget so a 42KB zip can't expand to terabytes. (Standard zip-bomb mitigation; treat as a required validation gate alongside §28.)

30. **Trusted-publishing isolation (the correct shape for Synapse's publish step).** "Trusted Publishing authenticates… using GitHub Actions OIDC… replace a stored secret with a short-lived proof of identity… GitHub Actions mints a short-lived OIDC token on each publish, and [the registry] checks it against the pre-registered Trusted Publisher conditions (GitHub org, repository, workflow filename, environment name)." Critical property: "_Generally speaking_, 'third party' events **cannot** request an OIDC token" — i.e. fork PRs can't mint publish credentials. ([npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/), [PyPI trusted-publishers security model](https://docs.pypi.org/trusted-publishers/security-model/), [npm OIDC hardened publishing](https://codenote.net/en/posts/npm-trusted-publishing-oidc-staged-hardened-release/)). *Synapse application:* register the **merged-code publish workflow** (org + repo + workflow file + environment) as the sole trusted publisher; give the PR-validation workflow **no secrets and no OIDC publish permission**. This keeps untrusted PR code fully isolated from the publish/identity path. ([OWASP GitHub Actions Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/GitHub_Actions_Security_Cheat_Sheet.html), [PyPI Trusted Publishing Common Pitfalls](https://safeguard.sh/resources/blog/pypi-trusted-publishing-common-pitfalls)).

---

## Sources

**Kept (primary / authoritative):**
- [Security | Raycast API](https://developers.raycast.com/information/security) — authoritative on Raycast's non-sandboxed, OS-permission model + CI pipeline.
- [How the Raycast API and extensions work (Raycast Blog)](https://www.raycast.com/blog/how-raycast-api-extensions-work) — monorepo+PR flow, sandbox rejection rationale, kill list, versioning model.
- [raycast/extensions #101](https://github.com/raycast/extensions/issues/101) & [#200](https://github.com/raycast/extensions/issues/200) — proof the declarative permission model is *requested, not built*.
- [winget-pkgs README](https://github.com/microsoft/winget-pkgs/blob/master/doc/README.md), [Authoring.md](https://github.com/microsoft/winget-pkgs/blob/master/doc/Authoring.md), [schema 1.12 README](https://github.com/microsoft/winget-pkgs/blob/master/doc/manifest/schema/1.12.0/README.md), [version.md](https://github.com/microsoft/winget-pkgs/blob/master/doc/manifest/schema/1.12.0/version.md), [installer.md](https://github.com/microsoft/winget-pkgs/blob/master/doc/manifest/schema/1.12.0/installer.md) — full field-level manifest schema.
- [copilot-instructions.md](https://github.com/microsoft/winget-pkgs/blob/master/.github/copilot-instructions.md), [validation-pipeline.yaml](https://github.com/microsoft/winget-pkgs/blob/master/DevOpsPipelineDefinitions/validation-pipeline.yaml), [ValidationFailureGuide.md](https://github.com/microsoft/winget-pkgs/blob/master/doc/ValidationFailureGuide.md), [PR template](https://github.com/microsoft/winget-pkgs/blob/master/.github/PULL_REQUEST_TEMPLATE.md), [Submit manifest — MS Learn](https://learn.microsoft.com/en-us/windows/package-manager/package/repository) — PR/validation/auto-merge pipeline.
- [winget-cli-restsource](https://github.com/microsoft/winget-cli-restsource), [REST API #118](https://github.com/microsoft/winget-cli/issues/118), [REST Client — DeepWiki](https://deepwiki.com/microsoft/winget-cli/3.3-rest-client-and-package-sources) — index vs GitHub-manifest separation.
- [vscode-vsce](https://github.com/microsoft/vscode-vsce/), [VS Code Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension), [vsce #993](https://github.com/microsoft/vscode-vsce/issues/993) — .vsix + OIDC/manifest+signature.
- [openvsx #673](https://github.com/eclipse/openvsx/pull/673), [openvsx #543](https://github.com/eclipse/openvsx/issues/543), [Publishing-Extensions wiki](https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions) — repository-level signing + mirroring verification.
- [Security and Trust in VS Marketplace](https://developer.microsoft.com/blog/security-and-trust-in-visual-studio-marketplace), [Signing VSIX — MS Learn](https://learn.microsoft.com/en-us/visualstudio/extensibility/signing-vsix-packages?view=vs-2022) — install-time signature verification default.
- [reproducible-builds.org: archives](https://reproducible-builds.org/docs/archives/), [stable-inputs](https://reproducible-builds.org/docs/stable-inputs/), [Debian TimestampsInZip](https://wiki.debian.org/ReproducibleBuilds/TimestampsInZip), [strip-nondeterminism](https://manpages.debian.org/testing/strip-nondeterminism/strip-nondeterminism.1p.en.html) — deterministic-zip rules.
- [repro-zipfile](https://github.com/drivendataorg/repro-zipfile), [reproducible_zip](https://pypi.org/project/reproducible_zip/), [deterministic-zip (npm)](https://www.npmjs.com/package/deterministic-zip), [timo-reymann/deterministic-zip](https://github.com/timo-reymann/deterministic-zip) — concrete tooling.
- [Cosign Signing Overview](https://docs.sigstore.dev/cosign/signing/overview/), [Signing Blobs](https://docs.sigstore.dev/cosign/signing/signing_with_blobs/), [Key Mgmt](https://docs.sigstore.dev/cosign/key_management/overview/), [cosign_sign-blob](https://github.com/sigstore/cosign/blob/main/doc/cosign_sign-blob.md), [cosign_attest](https://github.com/sigstore/cosign/blob/main/doc/cosign_attest.md), [BUNDLE_SPEC](https://github.com/sigstore/cosign/blob/main/specs/BUNDLE_SPEC.md) — keyless/KMS signing + attestations.
- [sigstore/gitsign](https://github.com/sigstore/gitsign), [gitsign.md](https://github.com/sigstore/docs/blob/main/content/en/cosign/signing/gitsign.md), [OIDC verification cheat sheet](https://docs.sigstore.dev/quickstart/verification-cheat-sheet/) — keyless git signing.
- [actions/attest-build-provenance](https://github.com/actions/attest-build-provenance), [SLSA Provenance v1.1](https://slsa.dev/spec/v1.1/provenance), [SLSA attestation model](https://slsa.dev/spec/v1.2/attestation-model) — provenance binding.
- [TUF spec](https://theupdateframework.github.io/specification/latest/), [TUF roles/metadata](https://theupdateframework.io/docs/metadata/), [TUF security](https://theupdateframework.io/security/), [TAP-16 delta snapshots](https://github.com/theupdateframework/taps/blob/master/tap16.md), [PEP 740](https://peps.python.org/pep-0740/), [sparse index shape](https://mochi-lang.dev/docs/research/0057/registry-index), [catalog API example](https://rave.maccrab.com/docs/catalog-api/), [StreamKit publishing](https://streamkit.dev/guides/publishing-plugins/), [voli-registry](https://github.com/Topurrra/voli-registry) — signed index formats & snapshot/delta.
- [GitHub Changelog: safer pull_request_target](https://github.blog/changelog/2026-06-18-safer-pull_request_target-defaults-for-github-actions-checkout/), [CodeQL untrusted checkout](https://codeql.github.com/codeql-query-help/actions/actions-untrusted-checkout-critical/), [GitHub Security Lab pwn requests](https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/), [OWASP GH Actions CS](https://cheatsheetseries.owasp.org/cheatsheets/GitHub_Actions_Security_Cheat_Sheet.html), [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use) — CI/CD pitfalls.
- [Zip Slip — Snyk](https://security.snyk.io/research/zip-slip-vulnerability), [Zip path traversal — Google](https://developer.android.com/privacy-and-security/risks/zip-path-traversal), [CVE-2026-56876](https://nvd.nist.gov/vuln/detail/CVE-2026-56876), [CVE-2025-29787](https://nvd.nist.gov/vuln/detail/CVE-2025-29787), [Disguises: duplicate entries](https://blog.isec.pl/disguises-zip-past-path-traversal/) — extraction pitfalls.
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/), [PyPI trusted-publishers security model](https://docs.pypi.org/trusted-publishers/security-model/), [PyPI pitfalls](https://safeguard.sh/resources/blog/pypi-trusted-publishing-common-pitfalls) — publish isolation.

**Dropped:**
- APIs.io Open VSX OpenAPI listing — aggregator, not authoritative; superseded by the openvsx repo/wiki.
- The `x07lang`/`logos-co`/`nika-spec`/`MTHDS` registry specs — niche third-party specs used only as corroboration for index-shape ideas; not cited as primary authority.

## Gaps
- **Raycast `package.json` canonical field reference:** the docs page `developers.raycast.com/basics/package-json` 404'd (docs restructured); exact current `commands`/`preferences` field list should be re-pulled from the live developer docs or `raycast/extensions` sample manifests before implementing a Raycast-compatible manifest. The model (package.json + npm `@raycast/api` dep + PR review) is well-confirmed.
- **WinGet explicit revocation list field:** none exists — removal is repo deletion + client-side blocklist. Synapse's `revoked`/`revocations[]` design (§22) is a Synapse addition, not a WinGet field.
- **"PERMISSION REPORT" format:** there is no industry-standard format; the layout in §25 is a Synapse-original synthesis. No prior art to cite beyond the field sources.
- **WinGet REST source internal index format / exact signing of `source.msix`:** fetched at architecture level, not byte-format; if Synapse wants to mirror it exactly, the [`winget-cli-restsource`](https://github.com/microsoft/winget-cli-restsource) API contract docs need a deeper read.
- Search-provider availability during this run was constrained (Exa rate-limited; Brave/Tavily/OpenAI/Gemini keys absent), so some corroborating queries were run via direct fetch of authoritative URLs rather than search. Primary-source quality is unaffected; only discovery breadth was limited.

## Next steps (recommended)
1. Decide the **capability vocabulary** for Synapse manifests (adopt the `permissions`/`capabilities`/`scope`/`compat` axes in §7) — this is the contract every other piece (diff, report, index) depends on.
2. Prototype the **deterministic-archive → cosign keyless sign-blob → SLSA attestation → signed snapshot.json** pipeline end-to-end on a sample package.
3. Implement the **capability-diff** renderer and wire it into both the PR-validation (unprivileged) workflow and the install-time UI.
4. Lock the publish path to **OIDC trusted publishing from the post-merge workflow only** (§8 #30) before opening the repo to external contributors.
