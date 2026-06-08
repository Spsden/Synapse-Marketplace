-- Synapse Marketplace - MCP registry control plane
-- Run this in Supabase SQL Editor after 003_remove_redirect_url.sql

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE mcp_registry_submission_status AS ENUM (
    'SUBMITTED',
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED'
);

CREATE TYPE mcp_registry_change_type AS ENUM (
    'NEW',
    'UPDATE'
);

-- ============================================================
-- TABLE: mcp_registry_entries (published source of truth)
-- ============================================================

CREATE TABLE mcp_registry_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id           VARCHAR(100) NOT NULL UNIQUE,
    display_name        VARCHAR(255) NOT NULL,
    description         TEXT,
    current_version     VARCHAR(50) NOT NULL,
    maintainer_name     VARCHAR(255) NOT NULL,
    maintainer_kind     VARCHAR(50) NOT NULL,
    trust_level         VARCHAR(50) NOT NULL,
    documentation_url   VARCHAR(500),
    source              JSONB NOT NULL DEFAULT '{}'::JSONB,
    auth                JSONB,
    tools               JSONB NOT NULL DEFAULT '[]'::JSONB,
    runtime_targets     JSONB NOT NULL DEFAULT '[]'::JSONB,
    platforms           JSONB NOT NULL DEFAULT '[]'::JSONB,
    desktop             JSONB,
    cloud               JSONB,
    capabilities        JSONB,
    created_by          VARCHAR(255),
    updated_by          VARCHAR(255),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version             BIGINT
);

CREATE INDEX idx_mcp_registry_entries_server_id ON mcp_registry_entries(server_id);
CREATE INDEX idx_mcp_registry_entries_published_at ON mcp_registry_entries(published_at DESC);
CREATE INDEX idx_mcp_registry_entries_tools ON mcp_registry_entries USING GIN(tools);
CREATE INDEX idx_mcp_registry_entries_runtime_targets ON mcp_registry_entries USING GIN(runtime_targets);

CREATE TRIGGER update_mcp_registry_entries_updated_at
    BEFORE UPDATE ON mcp_registry_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: mcp_registry_submissions (developer proposals)
-- ============================================================

CREATE TABLE mcp_registry_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id           VARCHAR(100) NOT NULL,
    target_entry_id     UUID REFERENCES mcp_registry_entries(id) ON DELETE SET NULL,
    change_type         mcp_registry_change_type NOT NULL,
    display_name        VARCHAR(255) NOT NULL,
    description         TEXT,
    current_version     VARCHAR(50) NOT NULL,
    maintainer_name     VARCHAR(255) NOT NULL,
    maintainer_kind     VARCHAR(50) NOT NULL,
    trust_level         VARCHAR(50) NOT NULL,
    documentation_url   VARCHAR(500),
    source              JSONB NOT NULL DEFAULT '{}'::JSONB,
    auth                JSONB,
    tools               JSONB NOT NULL DEFAULT '[]'::JSONB,
    runtime_targets     JSONB NOT NULL DEFAULT '[]'::JSONB,
    platforms           JSONB NOT NULL DEFAULT '[]'::JSONB,
    desktop             JSONB,
    cloud               JSONB,
    capabilities        JSONB,
    submission_notes    TEXT,
    created_by          VARCHAR(255) NOT NULL,
    status              mcp_registry_submission_status NOT NULL DEFAULT 'SUBMITTED',
    reviewed_by         VARCHAR(255),
    review_notes        TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at         TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_mcp_registry_submissions_server_id ON mcp_registry_submissions(server_id);
CREATE INDEX idx_mcp_registry_submissions_status ON mcp_registry_submissions(status);
CREATE INDEX idx_mcp_registry_submissions_target_entry ON mcp_registry_submissions(target_entry_id);
CREATE INDEX idx_mcp_registry_submissions_created_at ON mcp_registry_submissions(created_at DESC);

CREATE UNIQUE INDEX idx_mcp_registry_submissions_open_server
    ON mcp_registry_submissions(server_id)
    WHERE status IN ('SUBMITTED', 'PENDING_REVIEW');

CREATE TRIGGER update_mcp_registry_submissions_updated_at
    BEFORE UPDATE ON mcp_registry_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE mcp_registry_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_registry_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on mcp registry entries"
ON mcp_registry_entries FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on mcp registry submissions"
ON mcp_registry_submissions FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public can read mcp registry entries"
ON mcp_registry_entries FOR SELECT
USING (true);
