-- 007_plugin_source_provenance.sql
--
-- Records where an ingested plugin version came from so the reviewed artifact
-- can be traced back to an immutable source revision.
--
-- Ingest builds the .synx from a pinned commit and stores the resulting digest,
-- so `checksum_sha256` is the authoritative record of the reviewed bytes and
-- these columns record the exact source those bytes were built from.
--
-- Safe to re-run.

ALTER TABLE plugin_versions
    ADD COLUMN IF NOT EXISTS source_provider    VARCHAR(50),
    ADD COLUMN IF NOT EXISTS source_repository  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_commit_sha  CHAR(40),
    ADD COLUMN IF NOT EXISTS source_path        VARCHAR(500),
    ADD COLUMN IF NOT EXISTS source_blob_shas   JSONB,
    ADD COLUMN IF NOT EXISTS upstream           JSONB;

COMMENT ON COLUMN plugin_versions.source_provider IS 'Source host for an ingested version, e.g. github';
COMMENT ON COLUMN plugin_versions.source_repository IS 'Source repository in owner/name form';
COMMENT ON COLUMN plugin_versions.source_commit_sha IS 'Pinned commit the artifact was built from';
COMMENT ON COLUMN plugin_versions.source_path IS 'Directory within the repository, e.g. plugins/notion';
COMMENT ON COLUMN plugin_versions.source_blob_shas IS 'Per-file git blob SHAs used for the build (path -> sha)';
COMMENT ON COLUMN plugin_versions.upstream IS 'Raw upstream manifest as committed, retained for provenance';

-- An ingested version is identified by its source revision; this keeps
-- "same commit, same plugin" lookups cheap during re-ingest.
CREATE INDEX IF NOT EXISTS idx_plugin_versions_source_commit
    ON plugin_versions (source_commit_sha)
    WHERE source_commit_sha IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_versions_source_revision
    ON plugin_versions (source_repository, source_path, source_commit_sha)
    WHERE source_commit_sha IS NOT NULL;
