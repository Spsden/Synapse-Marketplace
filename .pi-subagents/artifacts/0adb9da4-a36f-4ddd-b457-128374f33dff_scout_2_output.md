# Recon: Synapse Main App — Extension Consumption (READ-ONLY)

**Repo:** `/Users/pratap/code/synapse` · **Branch:** `fjs-migration` · **Language:** Flutter / Dart (SDK ≥3.5.0, Flutter ≥3.24.0)
**Scope:** Extension (.synx) discovery/download/install/run, manifest schema & validation, marketplace fetching, GitHub-coupling check, capability/permission model, signature/hash verification & caching, MCP registry/OAuth consumption. LLM & memory work **excluded** per instructions. No files were modified or staged.

---

## 1. Language, framework & JS runtime

- **Host app:** Flutter/Dart (`pubspec.yaml:1` — `name: synapse`). Targets iOS, Android, macOS, Windows, Linux.
- **Plugin execution engine:** Plugins are **JavaScript** run inside a host-controlled sandbox. The current branch (`fjs-migration`) runs them on **FJS** (a Rust + QuickJS binding), NOT the legacy `flutter_js`. Evidence:
  - `packages/synapse_bridge/lib/src/synapse_host.dart:289-321` — `init()` calls `LibFjs.init()`, creates a `JsEngine` with minimal builtins (`JsBuiltinOptions(console: true)`), explicitly **without** built-in `fetch` so all I/O is bridged.
  - `packages/synapse_bridge/pubspec.yaml:13` — `fjs: any` (hosted pub dependency, transitive; resolved in `pubspec.lock`).
  - `pubspec.yaml:34` still declares `flutter_js: ^0.8.1` but it is no longer used by the active `SynapseHost`. The commented-out isolate host (`lib/services/plugin/synapse_host_isolate.dart`) is dead code.
  - SDK asset: `assets/js/synapse.global.js` (loaded once via `rootBundle`, `plugin_executor.dart:246`).

---

## 2. Discovery, download, install (entry points)

**Marketplace "store" path (primary):**
- DTO + remote data source: `lib/data/data_sources/remote/plugin_store_remote_data_source.dart`
  - `fetchPlugins` → `GET {SYNAPSE_MARKETPLACE}api/v1/store/plugins?pageSize=20&page=0` (lines 31-66)
  - `fetchPluginDetail` → `GET {baseUrl}/store/plugins/{packageId}` (lines 68-91)
  - `downloadSynxPackage(downloadUrl)` → raw `GET` returning `Uint8List` (lines 93-112)
  - Base URL ctor: `PluginStoreRemoteDataSourceImpl` line 24 — `dotenv.get("SYNAPSE_MARKETPLACE") + "api/v1"`.
- Store repository w/ integrity check: `lib/data/repositories/plugin_store_repository_impl.dart`
  - `installPlugin(packageId)` (lines 53-72): fetch detail → `downloadPluginPackage` → `PluginRepository.installFromBytes`.
  - `downloadPluginPackage` (lines 74-95): rejects expired signed URL (`detail.isExpired`), then **sha256-verifies the downloaded bytes against `detail.checksumSha256`** and throws `PluginIntegrityException` on mismatch.
- BLoC orchestration: `lib/presentation/blocs/plugin/plugin_bloc.dart` — events `LoadStorePlugins`, `LoadStorePluginDetail`, `InstallFromStore` (handlers at lines 271-302, 304-345, 409-440). UI trigger in `lib/presentation/screens/abilities/plugin_detail_screen.dart:245` (`InstallFromStore(detail.packageId)`).

**Install entry points (`PluginRepository`):** `lib/core/domain/repositories/plugin_repository.dart`
- `installFromSynx(filePath)`, `installFromUrl(url)`, `installFromBytes(bytes)`, `uninstallPlugin`, `setPluginEnabled`, `getAllPlugins`, `getEnabledPlugins`, `getPlugin`, `refreshPlugins`.
- Impl: `lib/data/repositories/plugin_repository_impl.dart`
  - `_installPackage` (lines 96-145): `package.validate()` → `package.extractTo(<docs>/plugins/<id>)` → writes manifest/plugin.js/icon/readme to disk → stores metadata JSON in SQLite via DAO `upsertPlugin`, sets `scriptPath`, `isEnabled=true`.
  - `_getPluginDirectory` (lines 187-190): `getApplicationDocumentsDirectory()/plugins/<id>`.
  - `refreshPlugins` (lines 55-60) is now a **no-op** — SQLite is the source of truth (no filesystem scan).

**Package parse/extract (the .synx reader):** `packages/synapse_bridge/lib/src/synx_package.dart`
- `.synx` = ZIP. Required entries: `manifest.json`, `plugin.js`. Optional: `icon.png`, `README.md`.
- `SynxPackage.fromBytes` (lines 60-150): decode ZIP, find files, `jsonDecode` manifest, call `validateManifestV2Contract`, read script, optionally verify `security.contentHash` of the script against `sha256-${sha256(script)}`.
- `validate()` (lines 206-262): checks id/name/version/script non-empty, ≥1 action, version is semver `\d+\.\d+\.\d+`. **ID reverse-domain regex is commented out (TODO).** `minSynapseVersion` is **parsed but not enforced**.

---

## 3. Manifest schema the client expects (manifest v2) — backward-compat surface

**Hard contract gate:** `packages/synapse_bridge/lib/src/plugin_entity.dart` → `validateManifestV2Contract` (lines 252-271):
```dart
void validateManifestV2Contract(Map<String, dynamic> manifest) {
  if (manifest['manifestVersion'] != 2) {
    throw const FormatException('manifestVersion must be 2');          // ← v1 rejected
  }
  final legacyFields = ['triggers', 'inputSchema', 'auth', 'mcpServers']
      .where(manifest.containsKey).toList();
  if (legacyFields.isNotEmpty) {
    throw FormatException('Manifest v1 fields are not supported: ${legacyFields.join(', ')}');
  }
  final actions = manifest['actions'];
  if (actions is! List || actions.isEmpty) {
    throw const FormatException('actions must contain at least one action');
  }
}
```
This gate is invoked from **two** places: `SynxPackage.fromBytes` (synx_package.dart:84-88) and `PluginManifestParser.loadFromDirectory` (plugin_entity.dart:151). The row→entity converter (`plugin_repository_impl.dart:158-167`) **re-checks** `manifestVersion == 2` and rejects rows with no actions.

**⚠ Legacy v1 handling = NONE (hard reject).** No v1→v2 migration/tolerance exists. Notably the in-repo sample `com.synapse.google-keep-1.0.0.synx` ships a **v1 manifest** (top-level `triggers`, `inputSchema`, `auth`, no `manifestVersion`) — it would be **rejected** by the current parser. (Evidence: extracted manifest has `id`, `security.allowedDomains`, top-level `auth`/`triggers`/`inputSchema`; no `manifestVersion` field, no `actions`.)

**Full v2 manifest schema (as parsed/produced by the client), from `synx_package.dart` `_manifestJson` (lines 265-291) + `plugin_entity.dart`:**
```jsonc
{
  "manifestVersion": 2,                      // REQUIRED, must equal 2
  "id": "com.author.plugin",                // REQUIRED string
  "name": "Display Name",                   // REQUIRED string
  "version": "1.0.0",                       // semver REQUIRED (validated)
  "description": "...", "author": "...",    // optional, default ""
  "authorUrl": "...", "homepage": "...",    // optional
  "license": "...",                         // optional
  "minSynapseVersion": "1.0.0",             // optional, parsed, NOT enforced
  "security": {                             // optional, defaults below
    "allowedDomains": ["api.example.com"],  // parsed; ⚠ enforcement currently disabled (see §5)
    "permissions": ["network","launch"],    // default ["network"] (package) / ["network","launch"] (entity)
    "contentHash": "sha256-<hex>",          // optional; script hash verified if present
    "allowedApps": ["Calendar","Reminders"] // optional; AppleScript target allowlist
  },
  "connections": [                          // manifest v2 named connections
    { "alias":"str","provider":"str","type":"oauth2|api_key|mcp_oauth|none",
      "scopes":["..."], "optional": false }
  ],
  "actions": [                              // REQUIRED, ≥1
    { "id":"str", "description":"...", "triggers":["note"],
      "inputSchema": { /* JSON schema */ }, "outputSchema": { /* JSON schema */ },
      "requirements": [                     // action-scoped capability contracts
        { "kind":"mcp|oauth|...", "alias":"...", "serverId":"...",
          "allow":{"tools":["..."]}, "capability":"...", "domains":["..."], "optional":false }
      ],
      "platforms": ["ios","android","macos","windows","linux"] }
  ],
  "categories": ["..."], "keywords": ["..."]
}
```
- `PluginConnectionConfig` (plugin_entity.dart:6-35), `PluginActionConfig` (79-121), `PluginActionRequirement` (37-77), `McpServerConfig` (124-152).
- `manifestVersion`, `id`, `name`, `version`, `security`, `connections`, `actions`, `categories`, `keywords` round-trip through `SynxPackage.toBytes`/`extractTo` and the SQLite `securityJson` blob (which additionally stores `manifestVersion`, `connections`, `actions`).

---

## 4. Marketplace registry/index fetching & GitHub-coupling flag

- **Index source:** the Synapse **Marketplace API** (`SYNAPSE_MARKETPLACE` env + `/api/v1/store/plugins...`). Env: `.env.example` → `SYNAPSE_MARKETPLACE=` (empty in template), plus `MCP_CLOUD_GATEWAY_URL/TOKEN`, `OAUTH_INTERNAL_SERVICE_TOKEN`, `MCP_RUNTIME_*`.
- **🚩 GitHub direct-coupling check: NEGATIVE (good).** Grep for `api.github.com` / `raw.githubusercontent` / `githubusercontent` across `lib` and `packages` returns **no** client→GitHub API calls for the store/registry/index. The only `github` references are:
  1. OAuth provider definitions (`packages/synapse_bridge/lib/src/auth_service.dart:92-113` — `OAuth2Provider.github(...)` factory, endpoints `github.com/login/oauth/*`), and
  2. a connected-apps settings screen (`lib/presentation/screens/settings/connected_apps_screen.dart:294,323`).
  No client-side dependency on the GitHub API for discovery/index/manifest data. **This satisfies the target "no client→GitHub coupling" design.**

---

## 5. Capability / permission model (client-enforced)

**Permission flags** — `PluginSecurityConfig` (`packages/synapse_bridge/lib/src/synapse_host.dart:60-90`): each is `permissions.contains(<token>)`:
`network`, `launch`, `ui`, `storage`, `applescript`, `calendar`, `reminders`, `mcp`.

**Network domains** — `synapse_host.dart:90-97`:
```dart
bool isDomainAllowed(String host) {
  return true;                       // ⚠⚠ WHITELIST DISABLED — allow-all
  // if (allowedDomains.isEmpty) return true;
  // return allowedDomains.any((domain) => host == domain || host.endsWith('.$domain'));
}
```
`allowedDomains` is parsed from the manifest and passed into the host (`plugin_executor.dart:329-333`), and `isDomainAllowed` is *called* in `_handleFetch` (synapse_host.dart ~490-500) before any HTTP request — **but it always returns `true`**. The effective network gate is only the `network` permission flag (`canMakeNetworkCalls`), default-present. **The per-domain allowlist is currently a no-op.** (The dead isolate host `synapse_host_isolate.dart:147-158` shows the *intended* enforcement that was bypassed.)

**Host capabilities (sync, all bridged through `sendMessage`→`fjs.bridge_call`):** handled in `SynapseHost._handleBridgeMessage` (synapse_host.dart:323-489). Permission checks:
- `fetch`/`network_request` → `canMakeNetworkCalls` + (disabled) domain check + connection/provider auth (`_handleFetch`, lines ~470-595).
- `system_runAppleScript` → `canRunAppleScript` (synapse_host.dart ~720-760).
- `system_calendar_*` → `canAccessCalendar` (synapse_host.dart ~790-870).
- `mcp_callTool` → `canUseMcp` (synapse_host.dart ~880-925).
- UI show/toast/confirm, storage get/set/delete/clear, config get/set, upload, auth_*, connection_* — bridged via callbacks (no discrete permission flag beyond the above).

**MCP servers/tools** — allowlist **derived** from action `requirements` where `kind=='mcp'`:
- `deriveMcpServerConfigs(actions)` (plugin_entity.dart:273-295): for each mcp requirement with both `alias`+`serverId`, accumulates `tools` into a `McpServerConfig` keyed by alias.
- Runtime enforcement in `PluginExecutor._setupHostCallbacks` → `onMcpCallTool` (plugin_executor.dart ~619-695): rejects undeclared server (`UNDECLARED_SERVER`) and tools not in the per-server allowlist (`TOOL_NOT_ALLOWED`) before calling `McpService`. Also resolves an optional connection auth context.
- Host-level precheck `canUseMcp` (synapse_host.dart ~885) gates the bridge message.

**Sandboxed script execution** — each plugin runs in an **isolated QuickJS runtime** via FJS; the `PluginExecutor` maintains a **per-plugin host pool** (`Map<String,SynapseHost> _hostCache`, plugin_executor.dart:30) — one isolated engine per plugin, preserving isolation. The SDK + plugin script are eval'd into that engine; dispatch waits ≤30s for the `finished` message (`SynapseHost.dispatch`, synapse_host.dart ~540-575). Builtins are minimal; no native `fetch`/`XMLHttpRequest` is exposed, forcing all I/O through the bridged (and permission-checked) channels.

**AppleScript hardening (macOS):** `lib/services/platform/system_bridge_service.dart`
- Platform gate: AppleScript is **macOS only** (line 117). Shortcuts iOS/macOS (line 23). Android Intents Android-only (line 54). Calendar iOS/macOS (line 189+).
- `runAppleScript` (lines 115-145): blocks dangerous patterns (`do shell script`, `system events`, `keystroke`, `key code`, `run script`) via `_dangerousPatterns` (lines 106-112); validates `tell application "X"` targets against `allowedApps` (empty list = no restriction) via `_validateAppleScriptTargets` (lines 147-167). Timeout enforced.

**Platform gating summary:** enforced at the `SystemBridgeService` (native capability) layer and at MCP-runtime selection (see §7). The manifest `actions[].platforms` array is **parsed but NOT enforced** at execution time (no client check skips an action by platform). AppleScript/Calendar naturally no-op off their platform via the bridge; on other platforms those callbacks return errors.

**minAppVersion / minSynapseVersion:** parsed (`plugin_store_dtos.dart:73,129`; `synx_package.dart:28`) but **never compared against the running app version** — no client-side version-gating at install.

---

## 6. Signature / hash verification & caching

**Verification present (integrity only, NOT asymmetric signature):**
1. **Package bytes sha256** — `PluginStoreRepositoryImpl.downloadPluginPackage` (`plugin_store_repository_impl.dart:82-91`) compares `sha256(bytes)` to `PluginDetailDto.checksumSha256` (from marketplace `/store/plugins/{id}`). Mismatch → `PluginIntegrityException`.
2. **Script content hash** — `SynxPackage.fromBytes` (synx_package.dart:91-101) verifies `security.contentHash == 'sha256-'+sha256(script)` if `contentHash` is declared in the manifest. Same check on directory load in `PluginManifestParser.loadFromDirectory` (plugin_entity.dart:188-196, using `scriptHash`).

**🚩 No code signing / signature verification** — grep for `signature`/`publicKey`/`verifySign`/`sigstore`/`codeSign` returns no verification logic (only an unrelated `dispose()` comment). Integrity rests entirely on the marketplace-supplied sha256 and the optional manifest-declared script hash.

**Caching / persistence:**
- **No on-disk download cache.** `.synx` bytes are downloaded, verified, parsed, then **extracted** to `<ApplicationDocuments>/plugins/<id>/` (plugin.js, manifest.json, icon, README). The raw archive is not retained.
- **Metadata persisted in SQLite** — `InstalledPluginsTable` (`installed_plugins_table.dart`): `id` (PK), `name`, `version`, `description`, `author`, `icon`, `triggersJson`, `inputSchemaJson`, `securityJson` (carries manifestVersion + connections + actions + security), `authJson` (nullable), `scriptPath`, `isEnabled`, `installedAt`, `lastUsedAt`. DAO: `lib/data/data_sources/local/database/daos/local_database_dao.dart`.
- **In-memory host pool** (per-plugin `SynapseHost`) cached for the app session; cleared on uninstall / `clearAllHosts` (plugin_executor.dart:705-725). SDK JS cached once per process (`_cachedSdk`).

---

## 7. MCP registry + OAuth config consumption (client)

**DI wiring:** `lib/injection_container.dart:177-218`
- Desktop (`AppPlatform.isDesktop`): registers `DesktopMcpRuntimeController` + `McpService.desktop(runtimeController: ...)`.
- Mobile: if `MCP_CLOUD_GATEWAY_URL` set → `McpService.remote(baseUrl, bearerToken=OAUTH... or MCP_CLOUD_GATEWAY_TOKEN)`; else MCP disabled (warning logged). `PluginExecutor` gets `mcpService` only if registered.

**Desktop MCP runtime** — `lib/services/mcp/desktop_mcp_runtime_controller.dart`:
- Spawns a **local Node process** (the `synapse-mcp-plane` repo) on `127.0.0.1:4777` (env overridable `MCP_MANAGER_HOST/PORT`). Runtime located via `MCP_RUNTIME_WORKDIR` (defaults `../synapse-mcp-plane` or `./synapse-mcp-plane`), runner `dev/desktop-runtime-runner.mjs` (lines ~485-507). Passes env `MCP_REGISTRY_URL` / `MCP_REGISTRY_CACHE_PATH` / `MCP_REGISTRY_PATH` (local fallback `dev/registry.desktop.json`, lines ~525-552).
- Health-monitors `GET /health`; up to 5 automatic restarts then terminal-failed (lines ~415-455). macOS Debug/Profile run **without App Sandbox** to launch the external Node binary; Release stays sandboxed (see `docs/PLUGIN_RUNTIME_V2.md`).

**MCP tool calls** — `lib/services/mcp/mcp_service.dart`:
- `callTool` POSTs `{pluginId, serverName, toolName, arguments, routingPolicy, timeoutMs, platform, declaredServers, authContext}` to `{baseUrl}/call` (lines 56-122). `platform` is `desktop` vs `mobile` (plugin_executor.dart ~683-686).
- **Remote grant exchange (mobile):** before a remote tool call, exchanges the local connection credential at `POST {baseUrl}/connections/grants` → returns a cloud `grantId`; the tool call carries only that grant ID. Grant cached by `sha256(pluginId:provider:grantId:token)` (lines 153-200). **Desktop** sends the access token in the authContext directly.
- `getConnectionDescriptor(serverId)` → `GET {baseUrl}/servers/{serverId}`; extracts `authProfiles[type=mcp-oauth]` (→ `provider`) and `deployments[kind=remote-http]` (→ `remoteUrl`) (lines 124-152). Used by `mcp_oauth` connection connect flow (plugin_executor.dart ~528-556).

**OAuth config (marketplace vault):** `lib/services/auth/oauth_provider_registry.dart` — `MarketplaceOAuthProviderRegistry.resolveProvider`:
- `GET {SYNAPSE_MARKETPLACE}api/v1/oauth/credentials/{pluginId}/{provider}` (Bearer `OAUTH_INTERNAL_SERVICE_TOKEN` if set) (lines 31-50).
- Returns `OAuth2Provider` from `{client_id, client_secret, redirect_url, scopes, scope_mode, metadata:{authorizationUrl, token_url, additional_parameters, prefer_webview}}` (lines 64-110).
- Enforces **https-only** endpoints in release mode (`_isValidOAuthEndpoint`, lines 112-119). Scope policy (`scope_mode` ∈ required|optional|forbidden) narrows plugin-requested scopes to server-approved (lines 122-200). Used in `onAuthRequest` / `onConnectionConnect` (plugin_executor.dart ~466-483, ~566-588).

**Connection vault model** (docs/PLUGIN_RUNTIME_V2.md + plugin_executor.dart): credentials stored once per provider; per-plugin access is a **grant** keyed by `pluginId` + connection `alias`. `api_key` connections prompt in native UI, store in secure vault, never exposed to JS.

---

## 8. Architecture: how it connects

```
PluginBloc (UI events) ──► PluginStoreRepository ──► PluginStoreRemoteDataSource ──HTTP──► Marketplace API (SYNAPSE_MARKETPLACE/api/v1)
        │                      │  (sha256 verify bytes)        (store/plugins, oauth/credentials)
        │                      ▼
        │               PluginRepository ──► SQLite (installed_plugins) + <docs>/plugins/<id>/*.js
        │              (SynxPackage.fromBytes → validateManifestV2Contract → extract)
        ▼
   PluginExecutor.execute(pluginId,intent,params)
        │  • load SDK asset (cached)  • get/create per-plugin SynapseHost (FJS/QuickJS)
        │  • loadPlugin(securityConfig) + loadPluginScript(plugin.js)  • dispatch(intent)
        │  • wires callbacks: auth/config (services) + UI/system/MCP (callbacks)
        ▼
   SynapseHost (packages/synapse_bridge) — JS↔Dart bridge via fjs.bridge_call
        │  permission-gated handlers: fetch(network+domains⚠), mcp(mcp perm+allowlist),
        │  applescript/calendar(platform+perm), storage/ui/config/upload/auth/connections
        ▼
   AuthService / ConfigService / SystemBridgeService / McpService / OAuthProviderRegistry
        McpService.desktop (local Node synapse-mcp-plane:4777) | McpService.remote (MCP_CLOUD_GATEWAY_URL)
```

---

## 9. Key risks / open questions (documented, not remediated)

1. **🚩 Domain allowlist disabled** (`synapse_host.dart:90-97` always `true`). `allowedDomains` is collected & passed but never enforced. Any plugin with the `network` permission can reach any host.
2. **🚩 No v1 backward compatibility.** `validateManifestV2Contract` hard-rejects `manifestVersion != 2` and legacy fields `triggers/inputSchema/auth/mcpServers`. The committed sample `.synx` is v1 and would fail. If v1 plugins must be tolerated, this is a breaking gap.
3. **No code-signature verification.** Only marketplace sha256 + optional manifest script hash. No publisher-identity / asymmetric signature. Trust is fully delegated to the marketplace serving the correct checksum.
4. **`minAppVersion`/`minSynapseVersion`/`actions[].platforms` parsed but not enforced** at install or dispatch.
5. **Plugin ID format regex commented out** (`synx_package.dart` validate() TODO) — ID format is unvalidated.
6. **Download URL is a marketplace-signed Supabase Storage URL** with `expiresAt`; expiry is checked (`plugin_store_dtos.dart:139`). No client-side package archive cache, so reinstall re-downloads.
7. **`flutter_js` dep still in app `pubspec.yaml:34`** (unused by active host) — dead dependency on the fjs-migration branch.

---

## Start Here
Open **`packages/synapse_bridge/lib/src/synapse_host.dart`** (the bridge + `PluginSecurityConfig` + the disabled `isDomainAllowed` at line 90) together with **`packages/synapse_bridge/lib/src/plugin_entity.dart`** (`validateManifestV2Contract` at line 252, `deriveMcpServerConfigs` at 273) — these two define the client's manifest contract, the capability gate, and the network/domain enforcement that any backward-compat or hardening change must touch. Then `lib/data/repositories/plugin_store_repository_impl.dart` (checksum verify) and `lib/services/plugin/plugin_executor.dart` (host pool + all capability callbacks).
