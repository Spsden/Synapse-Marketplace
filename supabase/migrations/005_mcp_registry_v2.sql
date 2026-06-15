-- Versioned MCP catalog fields.
--
-- The existing v1 columns remain in place so older desktop builds can continue
-- to consume registry snapshots while v2 clients use deployments and artifacts.

ALTER TABLE mcp_registry_entries
    ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS upstream JSONB,
    ADD COLUMN IF NOT EXISTS upstream_hash VARCHAR(128),
    ADD COLUMN IF NOT EXISTS auth_profiles JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS artifacts JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS deployments JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS capability_catalog JSONB NOT NULL DEFAULT '{}'::JSONB,
    ADD COLUMN IF NOT EXISTS cloud_certification JSONB;

ALTER TABLE mcp_registry_submissions
    ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS upstream JSONB,
    ADD COLUMN IF NOT EXISTS upstream_hash VARCHAR(128),
    ADD COLUMN IF NOT EXISTS auth_profiles JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS artifacts JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS deployments JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS capability_catalog JSONB NOT NULL DEFAULT '{}'::JSONB,
    ADD COLUMN IF NOT EXISTS cloud_certification JSONB;

CREATE INDEX IF NOT EXISTS idx_mcp_registry_entries_schema_version
    ON mcp_registry_entries(schema_version);

CREATE INDEX IF NOT EXISTS idx_mcp_registry_entries_deployments
    ON mcp_registry_entries USING GIN(deployments);

CREATE INDEX IF NOT EXISTS idx_mcp_registry_entries_artifacts
    ON mcp_registry_entries USING GIN(artifacts);
