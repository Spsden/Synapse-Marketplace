# Synapse Marketplace — Backend Recon Report

Branch: `codex/mcp-registry-control-plane` (clean working tree, only untracked `.pi-subagents/`).
Mode: READ-ONLY audit. No files modified.

---

## 1. Repo Overview

| Aspect | Value | Evidence |
|---|---|---|
| Language | TypeScript (Node 20) | `Dockerfile:1` (`node:20-alpine`); `package.json` |
| Framework | NestJS 10 | `package.json` deps `@nestjs/* ^10.3.0`; `src/app.module.ts` |
| Package manager | npm (`package-lock.json`); `npm ci` in Docker | `Dockerfile:8`, `Dockerfile:18` |
| Data layer | Supabase (Postgres via `@supabase/supabase-js ^2.39.3`) — no TypeORM/Prisma at runtime | `src/config/supabase.config.ts`; every repository `createClient(...)` |
| Storage | Supabase Storage REST (single provider only — **no R2, no local**) | `src/storage/storage.module.ts`; `src/storage/supabase-storage.service.ts` |
| Auth | **Static bearer-token guards** (no Supabase Auth, no JWT users, no sessions) | `src/common/guards/marketplace-api-token.guard.ts` |
| Frontend | Separate Vite + React app under `web/` (consumes the API; not part of backend lifecycle) | `web/package.json`, `web/src/api/client.ts` |
| Docs | Swagger at `/api-docs` | `src/app.module.ts:46-70` |
| API prefix | `api/v1` | `src/main.ts:47`, `.env.example:3` |

**Key correction to the task brief's assumptions:** There is only **one** storage provider today (Supabase Storage). Cloudflare R2 and local-filesystem providers do **not** exist in the codebase (`src/storage/storage.module.ts:12-22`). There are **no Supabase Edge Functions** in this repo (all logic lives in the NestJS process). There is **no static `registry.json`** file served — the MCP registry is assembled dynamically from the `mcp_registry_entries` table (`src/mcp-registry/mcp-registry.service.ts:20-35`).

---

## 2. Architecture Summary

The app is a single NestJS process. Modules (`src/app.module.ts:33-45`):

- `ConfigModule` (global), `AppConfigModule` — typed config via `registerAs` (`src/config/app.config.ts`, `src/config/supabase.config.ts`)
- `ThrottlerModule` — 100 req/60s global (`src/app.module.ts:36-41`)
- `HealthModule` — Terminus liveness/readiness, DB ping (`src/health/health.controller.ts`)
- `VaultModule` — AES-256-GCM encryption (`src/vault/vault.service.ts`)
- `StorageModule` — **global**; binds the `StorageService` abstract to `SupabaseStorageService` (`src/storage/storage.module.ts:11-22`)
- `PluginsModule` — store + review + repositories (`src/plugins/plugins.module.ts`)
- `DeveloperModule` — submission entrypoint (`src/developer/developer.module.ts`)
- `AdminModule` — review/flag/delete (`src/admin/admin.controller.ts`)
- `OAuthModule` — credentials vault + callback passthrough (`src/oauth/oauth.module.ts`)
- `McpRegistryModule` — reviewed MCP runtime registry control plane

Each repository instantiates its **own** `SupabaseClient` with the service-role key (`persistSession:false`) — e.g. `src/plugins/plugins.repository.ts:23-29`. There is no shared client/transaction boundary across modules.

Data-flow shape: `Controller → Service → Repository(supabase-js) → Postgres` and `Service → StorageService → Supabase Storage REST`.

---

## 3. End-to-end submission → review → storage → publication → download

### 3a. `.synx` package submission flow

1. **HTTP entrypoint.** `POST /api/v1/dev/plugins/submit` (multipart, `FileInterceptor('file')`), guarded by `MarketplaceDeveloperGuard`. `src/developer/developer.controller.ts:39-83`.
2. **Developer service.** `DeveloperService.submitPluginSynx(file, packageId)` validates presence of file + packageId, then:
   - extracts the `.synx` ZIP via `SynxPackageService.extractPackage` (`src/storage/synx-package.service.ts:34-115`) — requires `manifest.json` + `plugin.js`, optional `icon.*`/`README.md`, **rejects legacy manifest v1 fields** (`triggers/inputSchema/auth/mcpServers`), requires `manifestVersion===2` and ≥1 action, zip-slip guard (`synx-package.service.ts:60-108`).
   - asserts `manifest.id === packageId` (`developer.service.ts:80-85`).
   - if icon present: `storageService.calculateChecksum` → `uploadIcon` to `icons` bucket (`developer.service.ts:88-94`).
   - **uploads the artifact to TEMP storage** via `storageService.uploadArtifact(...)` → returns `{storagePath, bucket: temp_uploads, tempPath, fileSizeBytes, checksumSha256}` (`developer.service.ts:97-103`; `src/storage/supabase-storage.service.ts:48-89`).
   - calls `PluginsService.submitPlugin(...)` (`developer.service.ts:106-124`).
   - on any failure: compensating cleanup deletes icon + temp artifact (`developer.service.ts:138-187`).
3. **Plugin service.** `PluginsService.submitPlugin` (`src/plugins/plugins.service.ts:127-178`):
   - `findByPackageId`; if none → create plugin row with `status=SUBMITTED`.
   - if exists → reject duplicate `(pluginId, version)` via `VersionConflictException`.
   - create `plugin_versions` row with `status=SUBMITTED`, storing `storagePath`, `storageBucket=temp_uploads`, `tempStoragePath`, `fileSizeBytes`, `checksumSha256`, full `manifest` JSONB.
   - if plugin was `SUBMITTED` → promote to `PENDING_REVIEW`.

> **Important:** at submission the artifact lives in `temp_uploads` and `plugin_versions.storage_bucket` is the temp bucket; `storagePath` is the *eventual* permanent path (`{packageId}/v{version}/plugin.synx`) while `tempStoragePath` is the actual temp location. See `supabase-storage.service.ts:71-78`.

### 3b. Review / approval state machine

- **Plugin status** enum: `SUBMITTED → PENDING_REVIEW → PUBLISHED | REJECTED` (also `DELETED` in the TS enum, but `DELETED` is **not** in the DB enum `plugin_status` — see Open Questions). `src/common/enums/plugin-status.enum.ts`; DB enum `supabase/migrations/001_initial_schema.sql:8`.
- **Version status** enum: `SUBMITTED, PENDING_REVIEW, PUBLISHED, REJECTED, FLAGGED`. `src/common/enums/version-status.enum.ts`; DB enum `001_initial_schema.sql:9`.
- **Review decision** enum: `PUBLISH | REJECT`. `version-status.enum.ts` (ReviewDecision).
- **Transition validator:** `PluginReviewService.isValidTransition` — only `SUBMITTED`/`PENDING_REVIEW` may be acted on; `PUBLISHED/REJECTED/FLAGGED` are terminal (`src/plugins/plugin-review.service.ts:144-160`).
- **Review queue:** `GET /api/v1/admin/review-queue` → versions `IN (SUBMITTED, PENDING_REVIEW)` ordered by `created_at` (`plugin-versions.repository.ts:67-77`).
- **Decision endpoint:** `PATCH /api/v1/admin/plugins/:versionId/verify` with `ReviewDecisionRequestDto {decision, rejectionReason?, reviewedBy}` (`src/admin/admin.controller.ts:50-67`; DTO `src/common/dto/review-decision-request.dto.ts`).
- **Automated safety check:** `performAutomatedSafetyCheck` is a **placeholder that always returns true** (`plugin-review.service.ts:126-143`). No static analysis runs today.
- **PUBLISH path** (`PluginReviewService.handlePublishDecision`, `plugin-review.service.ts:178-216`):
  1. `storageService.moveArtifact(tempStoragePath, packageId, version)` → downloads from temp, re-uploads to `plugins` bucket, deletes temp (`supabase-storage.service.ts:139-176`).
  2. update version: `storagePath`, `storageBucket='plugins'`, `tempStoragePath=null`.
  3. set version `status=PUBLISHED`, `reviewedAt`, `reviewedBy`, `publishedAt`.
  4. set plugin `latestVersionId`, `status=PUBLISHED`.
- **REJECT path** (`handleRejectDecision`, `plugin-review.service.ts:218-251`): delete temp artifact, set `status=REJECTED`, `rejectionReason`; if it was latest, re-point to next published version or null + `REJECTED`.
- **FLAG:** `POST /api/v1/admin/plugins/:versionId/flag?reason=&flaggedBy=` → `status=FLAGGED`, `is_flagged=true`; clears `latestVersionId` and sets plugin `REJECTED` if it was current (`plugin-review.service.ts:101-124`; `admin.controller.ts:78-91`). Unflag clears `is_flagged` only (does **not** restore status).
- **DELETE:** `DELETE /api/v1/admin/plugins/:packageId` — hard delete: removes all version artifacts + icon from storage, deletes version + plugin rows (`plugins.service.ts:226-296`).

### 3c. Storage path conventions (must preserve)

- Artifact permanent path: `{packageId}/v{version}/plugin.synx` (`src/storage/storage.service.ts:90-96`, `getArtifactPath`).
- Temp path: `temp_{epoch}/{permanent-path}` (`supabase-storage.service.ts:74`).
- Icon path: `{iconKey}{ext}` where `iconKey` = SHA-256 of icon bytes (`supabase-storage.service.ts:179-216`).
- Buckets: `plugins` (private), `icons` (public), `temp_uploads` (private) (`supabase.config.ts:21-23`).

### 3d. Download path (current, must preserve)

There is **no direct file-serving endpoint**. Downloads are delivered as **time-limited signed URLs** generated per request:

1. Client calls `GET /api/v1/store/plugins/:packageId[?appVersion=]` (`src/plugins/store.controller.ts:43-62`).
2. `PluginsService.getPluginByPackageId` resolves a published + app-version-compatible version via RPC `find_latest_compatible_version` (`plugins.service.ts:74-111`; SQL `001_initial_schema.sql:118-159`).
3. `toPluginDetailResponse` calls `storageService.getSignedUrl(storagePath, storageBucket)` → Supabase REST `POST /storage/v1/object/sign/{bucket}/{path}` with anon key (`supabase-storage.service.ts:91-137`). Response embeds `downloadUrl` + `expiresAt` (default 3600s, `.env` `SIGNED_URL_TTL_SECONDS`).
4. Download count incremented asynchronously via RPC `increment_download_count` (`plugin-versions.repository.ts:233-235`).
5. **Known bug (dev comment):** when `storageBucket` is the literal `plugins` bucket, the sign URL can double the path segment (`plugins/plugins/...`). See inline comment at `supabase-storage.service.ts:101-110` — relevant to any storage migration.
6. There is also a SUBMITTED-state quirk: `toPluginDetailResponse` swaps in `tempStoragePath` when `version.status === 'SUBMITTED'` (string compare) — `plugins.service.ts:321-325`.

### 3e. MCP registry publication flow (parallel control plane)

Developer submits (`POST /dev/mcp/servers/submit`) or imports an official server.json (`POST /dev/mcp/servers/import-official`) → `mcp_registry_submissions` row `status=SUBMITTED` (unique open submission per server_id enforced by partial unique index, `004_mcp_registry.sql:96-98`). Admin reviews (`PATCH /admin/mcp/submissions/:id/review`); on `PUBLISH` the submission is merged into `mcp_registry_entries` (create-or-update) and marked `APPROVED` (`mcp-registry.service.ts:108-176`). Public read via `GET /mcp/registry`, `/mcp/servers`, `/mcp/servers/:serverId`.

---

## 4. Database Schema Inventory

All migrations in `supabase/migrations/`. Column types as declared.

### 4a. `plugins` — `001_initial_schema.sql:18-43`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| package_id | VARCHAR(255) | UNIQUE |
| name | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| author | VARCHAR(255) | NOT NULL — **de-facto publisher identity (plain string)** |
| icon_key | VARCHAR(500) | |
| status | `plugin_status` enum | default `'SUBMITTED'` |
| latest_version_id | UUID | (no FK declared in migration — see Open Questions) |
| category | VARCHAR(100) | |
| tags | VARCHAR(500) | |
| source_url | VARCHAR(500) | |
| total_downloads | BIGINT | default 0 |
| rating_average | DECIMAL(3,2) | **unused by any code** |
| rating_count | INTEGER | default 0 — **unused by any code** |
| featured | BOOLEAN | default FALSE |
| verified | BOOLEAN | default FALSE |
| created_at / updated_at | TIMESTAMPTZ | trigger-updated |
| first_published_at / last_updated_at | TIMESTAMPTZ | |
| is_deleted / deleted_at | BOOLEAN / TIMESTAMPTZ | soft-delete columns exist but code hard-deletes |
| version | BIGINT | optimistic lock (not enforced by repository) |

### 4b. `plugin_versions` — `001_initial_schema.sql:85-115`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| plugin_id | UUID | FK → plugins(id) ON DELETE CASCADE |
| version | VARCHAR(50) | UNIQUE(plugin_id, version) |
| storage_path | VARCHAR(500) | permanent path |
| storage_bucket | VARCHAR(100) | |
| temp_storage_path | VARCHAR(500) | pre-publish location |
| file_size_bytes | BIGINT | |
| checksum_sha256 | CHAR(64) | SHA-256 hex |
| manifest | JSONB | NOT NULL — full v2 manifest |
| min_app_version | VARCHAR(20) | NOT NULL |
| release_notes | TEXT | |
| status | `version_status` enum | default `'SUBMITTED'` |
| rejection_reason | TEXT | |
| reviewed_by | VARCHAR(255) | |
| created_at / reviewed_at / published_at | TIMESTAMPTZ | |
| download_count | BIGINT | default 0 |
| is_flagged | BOOLEAN | default FALSE |
| flag_reason | TEXT | |

### 4c. `plugin_downloads` (analytics) — `001_initial_schema.sql:178-189`
id UUID PK; plugin_id UUID FK; version_id UUID FK; downloaded_at TIMESTAMPTZ; app_version VARCHAR(50); platform VARCHAR(50); country_code CHAR(2); date_partition DATE.
> **Note:** No application code inserts into this table — downloads are only counted via `increment_download_count` on `plugin_versions`. The granular analytics table is currently orphaned.

### 4d. `admin_audit_log` (governance) — `001_initial_schema.sql:196-206`
id, admin_id VARCHAR, action VARCHAR, entity_type VARCHAR, entity_id UUID, entity_version VARCHAR, old_status/new_status VARCHAR, reason TEXT, metadata JSONB, created_at.
> **Note:** **No application code writes audit rows.** Governance table exists but is unused.

### 4e. `plugin_oauth_clients` — `002_oauth_system.sql:23-44` (+ `003` drops `redirect_url`, `006` adds `package_id`, drops `plugin_id`)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| package_id | VARCHAR(255) | NOT NULL (after 006; unique w/ provider) |
| provider | VARCHAR(50) | NOT NULL |
| client_id | TEXT | NOT NULL |
| client_secret_encrypted | TEXT | AES-256-GCM (VaultService) |
| scopes | TEXT[] | default '{}' |
| owner_developer_id | VARCHAR(255) | NOT NULL |
| metadata | JSONB | incl. `scope_mode` |
| is_active | BOOLEAN | default TRUE (soft delete) |
| created_at / updated_at | TIMESTAMPTZ | |

### 4f. `mcp_registry_entries` — `004_mcp_registry.sql:22-43` (+ v2 cols in `005_mcp_registry_v2.sql:6-22`)
server_id VARCHAR(100) UNIQUE; display_name; description; current_version; maintainer_name/kind; trust_level; documentation_url; source/auth/tools/runtime_targets/platforms/desktop/cloud/capabilities (JSONB); **v2 additions:** schema_version INT default 1; upstream JSONB; upstream_hash VARCHAR(128); auth_profiles JSONB[]; artifacts JSONB[]; deployments JSONB[]; capability_catalog JSONB; cloud_certification JSONB; created_by/updated_by VARCHAR; created_at/updated_at/published_at; version BIGINT.

### 4g. `mcp_registry_submissions` — `004_mcp_registry.sql:73-99` (+ v2 cols in `005`)
Same definition shape as entries plus: target_entry_id UUID (FK→entries, ON DELETE SET NULL); change_type enum (NEW/UPDATE); submission_notes; created_by VARCHAR NOT NULL; status `mcp_registry_submission_status` (SUBMITTED/PENDING_REVIEW/APPROVED/REJECTED); reviewed_by; review_notes; reviewed_at. **Partial unique index** guarantees one open submission per server_id (`004:96-98`).

### 4h. Enums
- `plugin_status`: SUBMITTED, PENDING_REVIEW, PUBLISHED, REJECTED (`001:8`) — **no DELETED** in DB.
- `version_status`: SUBMITTED, PENDING_REVIEW, PUBLISHED, REJECTED, FLAGGED (`001:9`).
- `mcp_registry_submission_status`: SUBMITTED, PENDING_REVIEW, APPROVED, REJECTED (`004:8`).
- `mcp_registry_change_type`: NEW, UPDATE (`004:15`).

### 4i. SQL functions / triggers
- `update_updated_at_column()` + per-table `BEFORE UPDATE` triggers (plugins, plugin_versions, oauth_clients, mcp entries, mcp submissions).
- `find_latest_compatible_version(p_plugin_id, p_app_version)` — returns newest PUBLISHED version with `min_app_version <= app_version` (`001:118-159`); called via RPC.
- `increment_download_count(p_version_id)` — RPC (`001:161-167`).

---

## 5. StorageService Contract

There are **two competing abstractions** in the tree:

1. **`StorageService` (abstract class, ACTIVE)** — `src/storage/storage.service.ts`. This is the one wired into the DI container (`storage.module.ts:14-18`) and used by all services. Methods:
   - `uploadArtifact(buffer, contentType, packageId, version) → Promise<ArtifactUploadResult {storagePath, bucket, fileSizeBytes, checksumSha256, contentType, tempPath}>`
   - `getSignedUrl(storagePath, bucket) → Promise<SignedUrlResult {signedUrl, expiresAt}>`
   - `moveArtifact(sourcePath, packageId, version) → Promise<{storagePath}>`
   - `deleteArtifact(storagePath, bucket) → Promise<void>`
   - `calculateChecksum(buffer) → Promise<string>` (hex SHA-256)
   - `uploadIcon(iconData, iconName, iconKey) → Promise<string>`
   - concrete `getArtifactPath(packageId, version)` → `{packageId}/v{version}/plugin.synx`
2. **`IStorageService` (interface, UNUSED)** — `src/common/interfaces/storage-service.interface.ts`. A different signature set (`uploadArtifact(file, filename, bucket)`, `uploadFromStream`, etc.). **Not referenced by any provider or consumer** — appears to be an abandoned/planned abstraction. Migration risk: do not assume it is the contract.

**Only implementation:** `SupabaseStorageService extends StorageService` (`src/storage/supabase-storage.service.ts`).
- Upload path: temp bucket first (`temp_{epoch}/...`), returned as `tempPath`; permanent move happens at PUBLISH via download→re-upload→delete (`supabase-storage.service.ts:48-176`).
- Signed URL: Supabase REST `POST /storage/v1/object/sign/{bucket}/{path}` with **anon key** + `apiKey` header; TTL from config (`supabase-storage.service.ts:91-137`).
- Client built with **service-role key** for upload/move/delete (`supabase-storage.service.ts:42-46`).
- `SupabaseUrls` helper builds storage REST URLs (`src/config/supabase.config.ts:35-66`).
- Checksums: SHA-256 of the buffer, stored in `plugin_versions.checksum_sha256` (integrity only — **not a content-trust signature**).

**What is NOT signed:** `.synx` packages carry no asymmetric/cryptographic signature; there is no publisher key, no detached signature, no verification on download. "Signed URLs" = time-limited download URLs, not authenticity signatures. Icon de-dup keys are SHA-256 of icon bytes.

---

## 6. MCP Registry + OAuth

### 6a. MCP registry (`src/mcp-registry/`)
- Public: `GET /mcp/registry` (snapshot `{version:'2', updatedAt, servers[]}`), `/mcp/servers`, `/mcp/servers/:serverId` (`mcp-registry.controller.ts`). **Snapshot is built dynamically** from `mcp_registry_entries` — no static file.
- Developer: `POST /dev/mcp/servers/submit`, `POST /dev/mcp/servers/import-official` (`mcp-registry-developer.controller.ts`).
- Admin: `GET /admin/mcp/review-queue`, `PATCH /admin/mcp/submissions/:id/review` (`mcp-registry-admin.controller.ts`).
- Schema v2 validation: requires ≥1 deployment; only `node` artifacts; deployment kinds limited to `remote-http|node-stdio|synapse-cloud-node`; HTTPS-only remotes; artifactId cross-references enforced (`mcp-registry.service.ts:253-343`).
- Official importer (`official-mcp-server-importer.ts`): converts upstream `server.json` (remotes + npm stdio packages) into a v2 submission; rejects Python/unresolved commands; computes `upstreamHash = sha256-{hash of canonical doc}`; supports certified Synapse-Cloud-Node deployments.
- `upstreamHash` (SHA-256 of the upstream document) is the closest thing to provenance — still not a package signature.

### 6b. OAuth credentials vault (`src/oauth/`, `src/vault/`)
- `plugin_oauth_clients` stores per-`(package_id, provider)` client credentials; secret encrypted with AES-256-GCM via `VaultService` (`vault.service.ts`). Key derived via PBKDF2 (100k iters, fixed salt `synapse-vault-salt-v1`) from `VAULT_ENCRYPTION_KEY` (`vault.service.ts:198-216`).
- 11 supported providers (`oauth-provider.enum.ts`); per-provider max-scope allowlists (`oauth-clients.repository.ts:23-46`); `scope_mode` ∈ required|optional|forbidden.
- Redirect URLs are **platform-controlled, not stored** (migration `003_remove_redirect_url.sql`): HTTPS-only providers (notion, slack) use `${SERVER_URL}/api/v1/oauth/callback/{provider}`; others use `synapse://oauth/{provider}` (`oauth-redirect.service.ts`).
- `OAuthCallbackController` is a stateless passthrough that redirects to the `synapse://` deep link (`oauth-callback.controller.ts`).
- **Security gap (dev-only):** developer authorization/ownership checks are **commented out** in `oauth.controller.ts` (see `submitCredentials`, `update`, `disable`, `listByDeveloper` — all marked "TEMPORARY (dev-only): bypass developer authorization checks"). Only the internal `fetchForOAuth` endpoint enforces the internal service token. This must be re-enabled before any production use.

---

## 7. API Surface (REST only — no GraphQL, no RPC-over-HTTP beyond Supabase RPCs)

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | `/api/v1/health`, `/health/readiness`, `/health/liveness` | none | probes |
| GET | `/api/v1/store/plugins` | none (public) | list/search/category/paginate |
| GET | `/api/v1/store/plugins/:packageId` | none | detail + signed download URL |
| GET | `/api/v1/store/plugins/:packageId/versions` | none | version history |
| GET | `/api/v1/store/versions/:versionId` | none | single version |
| GET | `/api/v1/store/plugins/:packageId/statistics` | none | counts |
| POST | `/api/v1/dev/plugins/submit` | Developer | .synx upload |
| POST | `/api/v1/dev/mcp/servers/submit` | Developer | MCP submission |
| POST | `/api/v1/dev/mcp/servers/import-official` | Developer | official server.json import |
| GET | `/api/v1/admin/review-queue` | Admin | plugin version queue |
| PATCH | `/api/v1/admin/plugins/:versionId/verify` | Admin | PUBLISH/REJECT |
| POST | `/api/v1/admin/plugins/:versionId/flag` | Admin | flag |
| DELETE | `/api/v1/admin/plugins/:versionId/flag` | Admin | unflag |
| DELETE | `/api/v1/admin/plugins/:packageId` | Admin | hard delete |
| GET | `/api/v1/admin/mcp/review-queue` | Admin | MCP queue |
| PATCH | `/api/v1/admin/mcp/submissions/:id/review` | Admin | MCP approve/reject |
| GET | `/api/v1/mcp/registry` `/servers` `/servers/:serverId` | none | public registry |
| POST/GET/PUT/DELETE | `/api/v1/oauth/credentials...` | mixed (see §6b) | vault |
| GET | `/api/v1/oauth/callback/:provider` | none | deep-link passthrough |

**Discovery/search:** in-memory filter on `plugins` via `.or(name.ilike,description.ilike)` (`plugins.repository.ts:74-84`); a GIN full-text index exists on the column (`001:48-51`) but is **not used** by the query path. No dedicated `/install` endpoint — installation is client-side after fetching the signed URL.

---

## 8. Preliminary Keep / Adapt / Deprecate

**Keep (core, stable):**
- The `StorageService` abstract + `getArtifactPath` convention + temp→permanent two-phase model (preserve path shape `{packageId}/v{version}/plugin.synx` and the `temp_uploads`→`plugins` promotion).
- Review state machine + transition validator (`plugin-review.service.ts:144-160`).
- `SynxPackageService` extraction/validation (manifest v2 enforcement, zip-slip guard).
- VaultService AES-256-GCM encryption contract.
- MCP registry submission→approval→entry merge flow + partial-unique-open-submission invariant.

**Adapt (during migration):**
- **StorageService** is the single seam to add R2/local providers behind — implement new providers extending `StorageService` and swap via `storage.module.ts:14-18`. The active interface is the abstract **class** in `storage.service.ts`, not `IStorageService`.
- `getSignedUrl` path-doubling bug (`supabase-storage.service.ts:101-110`) — fix during provider abstraction.
- `performAutomatedSafetyCheck` placeholder — replace with real static analysis before scaling review.
- OAuth developer auth checks (re-enable commented-out guards in `oauth.controller.ts`).
- `find_latest_compatible_version` RPC + semver handling is Supabase-coupled — port if leaving Supabase.

**Deprecate / unused (safe to ignore or remove):**
- `IStorageService` interface (`src/common/interfaces/storage-service.interface.ts`) — unused.
- `plugin_downloads` analytics table — no writers.
- `admin_audit_log` table — no writers.
- `plugins.rating_average` / `rating_count` — no ratings subsystem exists.
- `plugins.featured/verified/total_downloads/first_published_at/last_updated_at/is_deleted` — columns exist, not maintained by code (hard delete used instead of `is_deleted`).
- Commented-out `submitPluginWithStorage` in `plugins.service.ts:180-225`.
- `extractPackageFromFile` sync wrapper in `synx-package.service.ts` (unused by controllers).

---

## 9. Local Run / Test Commands

```bash
# Backend (NestJS)
npm install
cp .env.example .env            # then fill Supabase + token + vault key
npm run start:dev               # hot reload; serves :3000/api/v1 + Swagger at /api-docs
npm run build && npm run start:prod

# Both API + frontend concurrently
./start.sh                       # launches `npm run start:dev` and (cd web && npm run dev)

# Frontend (Vite + React) — separate package
cd web && npm install && npm run dev

# Tests / lint
npm test                         # jest (spec + e2e-spec), rootDir=.
npm run test:watch
npm run test:cov
npm run lint                     # eslint --fix

# Container
docker compose up --build        # exposes :3000, healthcheck hits /api/v1/store/plugins
```

**Required env (names; values redacted):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `SIGNED_URL_TTL_SECONDS`, `MAX_UPLOAD_SIZE_MB`, `STORAGE_PLUGINS_BUCKET`, `STORAGE_ICONS_BUCKET`, `STORAGE_TEMP_UPLOADS_BUCKET`, `VAULT_ENCRYPTION_KEY` (AES key, `openssl rand -base64 32`), `SERVER_URL`, `OAUTH_CALLBACK_BASE_URL`, `OAUTH_INTERNAL_SERVICE_TOKEN`, `OAUTH_DEVELOPER_API_TOKEN`, `SYNAPSE_MARKETPLACE_TOKEN`. Web: `VITE_API_BASE_URL`, `VITE_MARKETPLACE_TOKEN`.

**DB bootstrap:** run `supabase/migrations/001…006` in order in the Supabase SQL editor (no migration runner config in repo). Buckets `plugins` (private), `icons` (public), `temp_uploads` (private) must be created in Supabase Storage dashboard (`001_initial_schema.sql:247-259`).

---

## 10. Backward-Compatibility Must-Haves

1. **Storage path scheme:** keep `{packageId}/v{version}/plugin.synx` and icon `{sha256}{ext}` — existing rows reference these.
2. **Two-phase temp→permanent promotion** semantics (`storage_bucket` flips from `temp_uploads`→`plugins`, `tempStoragePath`→null at PUBLISH) — any new provider must reproduce this.
3. **Signed URL response contract** (`{signedUrl, expiresAt}`) consumed by `PluginDetailResponse.downloadUrl/expiresAt` and the web client — preserve shape/timing.
4. **Manifest v2 contract** (`manifestVersion===2`, ≥1 action, no v1 legacy fields) — `synx-package.service.ts:36-72`; do not relax silently.
5. **`getArtifactPath`** exact format — referenced in `uploadArtifact`, `moveArtifact`, and `plugin_versions.storage_path` rows.
6. **Review state transitions** (`isValidTransition`) and the `PENDING_REVIEW`-only gate — preserve to avoid invalid state changes.
7. **MCP partial unique index** (one open submission per `server_id`) and create-or-update-on-approve merge into `mcp_registry_entries`.
8. **Vault ciphertext format** `base64(iv).base64(authTag).base64(ciphertext)` + PBKDF2 key derivation — changing `VAULT_ENCRYPTION_KEY` derivation or format invalidates stored secrets.
9. **OAuth redirect-URL policy** (platform-controlled; `003_remove_redirect_url.sql` dropped the column) — do not reintroduce developer-supplied redirect URLs.
10. **Service-role-key DB access model + RLS policies** — public SELECT on published rows; service_role full access. Keep if staying on Supabase; replicate equivalent authorization if migrating.

---

## 11. Open Questions (for the supervisor / next agent)

- **No publisher identity model.** Identity today is a free-text `author` string (`plugins.author`) and `owner_developer_id`/`createdBy` strings — no accounts, no auth on Supabase. Is a real publisher/identity system in scope?
- **`DELETED` status mismatch:** TS enum `PluginStatus.DELETED` exists (`plugin-status.enum.ts`) but the DB enum lacks it (`001:8`). Hard delete is used instead. Intended?
- **`plugins.latest_version_id` has no FK** in the migration (`001:30`) despite README implying one; no DB-level referential guarantee.
- **`plugin_downloads` + `admin_audit_log`** are unwired — intended to be populated later, or dead schema?
- **Ratings columns** (`rating_average`, `rating_count`) have no backing subsystem — feature planned?
- **`getSignedUrl` path-doubling** (`supabase-storage.service.ts:101-110`) — confirm whether this is a latent production bug to fix during migration.
- **OAuth dev bypass:** developer auth guards are commented out — confirm these must be re-enabled (and what the production developer identity source should be).
- **Storage multi-provider:** only Supabase exists today; confirm R2/local are migration targets (not current state).
