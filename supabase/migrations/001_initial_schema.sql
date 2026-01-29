-- Synapse Plugin Store - Initial Schema
-- Run this in Supabase SQL Editor to set up the database

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE plugin_status AS ENUM ('SUBMITTED', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED');
CREATE TYPE version_status AS ENUM ('SUBMITTED', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'FLAGGED');

-- ============================================================
-- TABLE: plugins (Master Record)
-- ============================================================

CREATE TABLE plugins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id          VARCHAR(255) NOT NULL UNIQUE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    author              VARCHAR(255) NOT NULL,
    icon_key            VARCHAR(500),
    status              plugin_status NOT NULL DEFAULT 'SUBMITTED',
    latest_version_id   UUID,
    category            VARCHAR(100),
    tags                VARCHAR(500),
    source_url          VARCHAR(500),
    total_downloads     BIGINT DEFAULT 0,
    rating_average      DECIMAL(3,2),
    rating_count        INTEGER DEFAULT 0,
    featured            BOOLEAN DEFAULT FALSE,
    verified            BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_published_at  TIMESTAMP WITH TIME ZONE,
    last_updated_at     TIMESTAMP WITH TIME ZONE,
    is_deleted          BOOLEAN DEFAULT FALSE,
    deleted_at          TIMESTAMP WITH TIME ZONE,
    version             BIGINT
);

-- Indexes for plugins
CREATE INDEX idx_plugins_package_id ON plugins(package_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_plugins_status ON plugins(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_plugins_category ON plugins(category) WHERE is_deleted = FALSE;
CREATE INDEX idx_plugins_author ON plugins(author) WHERE is_deleted = FALSE;
CREATE INDEX idx_plugins_featured ON plugins(featured) WHERE featured = TRUE;
CREATE INDEX idx_plugins_total_downloads ON plugins(total_downloads DESC);

-- Full-text search index
CREATE INDEX idx_plugins_search ON plugins USING GIN(to_tsvector('english',
    COALESCE(name, '') || ' ' || COALESCE(description, '')
));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for plugins
CREATE TRIGGER update_plugins_updated_at
    BEFORE UPDATE ON plugins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: plugin_versions (Version Artifacts)
-- ============================================================

CREATE TABLE plugin_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id           UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    version             VARCHAR(50) NOT NULL,
    storage_path        VARCHAR(500),
    storage_bucket      VARCHAR(100),
    temp_storage_path   VARCHAR(500),
    file_size_bytes     BIGINT,
    checksum_sha256     CHAR(64),
    manifest            JSONB NOT NULL,
    min_app_version     VARCHAR(20) NOT NULL,
    release_notes       TEXT,
    status              version_status NOT NULL DEFAULT 'SUBMITTED',
    rejection_reason    TEXT,
    reviewed_by         VARCHAR(255),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at         TIMESTAMP WITH TIME ZONE,
    published_at        TIMESTAMP WITH TIME ZONE,
    download_count      BIGINT DEFAULT 0,
    is_flagged          BOOLEAN DEFAULT FALSE,
    flag_reason         TEXT,
    CONSTRAINT unique_plugin_version UNIQUE (plugin_id, version)
);

-- Indexes for plugin_versions
CREATE UNIQUE INDEX idx_plugin_versions_unique ON plugin_versions(plugin_id, version)
    WHERE status != 'DELETED';
CREATE INDEX idx_plugin_versions_plugin_id ON plugin_versions(plugin_id);
CREATE INDEX idx_plugin_versions_status ON plugin_versions(status);
CREATE INDEX idx_plugin_versions_composite ON plugin_versions(plugin_id, version);
CREATE INDEX idx_plugin_versions_compatibility ON plugin_versions(min_app_version)
    WHERE status = 'PUBLISHED';
CREATE INDEX idx_plugin_versions_plugin_created ON plugin_versions(plugin_id, created_at DESC);

-- GIN index for manifest queries
CREATE INDEX idx_plugin_versions_manifest ON plugin_versions USING GIN(manifest);

-- Trigger for plugin_versions
CREATE TRIGGER update_plugin_versions_updated_at
    BEFORE UPDATE ON plugin_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCTION: find_latest_compatible_version
-- ============================================================

CREATE OR REPLACE FUNCTION find_latest_compatible_version(
    p_plugin_id UUID,
    p_app_version VARCHAR
) RETURNS TABLE (
    id UUID,
    plugin_id UUID,
    version VARCHAR,
    storage_path VARCHAR,
    storage_bucket VARCHAR,
    temp_storage_path VARCHAR,
    file_size_bytes BIGINT,
    checksum_sha256 CHAR(64),
    manifest JSONB,
    min_app_version VARCHAR,
    release_notes TEXT,
    status version_status,
    rejection_reason TEXT,
    reviewed_by VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    download_count BIGINT,
    is_flagged BOOLEAN,
    flag_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT v.*
    FROM plugin_versions v
    WHERE v.plugin_id = p_plugin_id
      AND v.status = 'PUBLISHED'
      AND v.min_app_version <= p_app_version
    ORDER BY
        STRING_TO_ARRAY(v.min_app_version, '.')::INT[] DESC,
        v.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: increment_download_count
-- ============================================================

CREATE OR REPLACE FUNCTION increment_download_count(p_version_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE plugin_versions
    SET download_count = download_count + 1
    WHERE id = p_version_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: plugin_downloads (Analytics)
-- ============================================================

CREATE TABLE plugin_downloads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id       UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    version_id      UUID NOT NULL REFERENCES plugin_versions(id) ON DELETE CASCADE,
    downloaded_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    app_version     VARCHAR(50),
    platform        VARCHAR(50),
    country_code    CHAR(2),
    date_partition  DATE NOT NULL DEFAULT (CURRENT_DATE)
);

-- Indexes for analytics
CREATE INDEX idx_downloads_plugin_version ON plugin_downloads(plugin_id, version_id);
CREATE INDEX idx_downloads_date ON plugin_downloads(downloaded_at DESC);
CREATE INDEX idx_downloads_partition ON plugin_downloads(date_partition);

-- ============================================================
-- TABLE: admin_audit_log (Governance)
-- ============================================================

CREATE TABLE admin_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        VARCHAR(255) NOT NULL,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID NOT NULL,
    entity_version  VARCHAR(50),
    old_status      VARCHAR(50),
    new_status      VARCHAR(50),
    reason          TEXT,
    metadata        JSONB,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_log_created ON admin_audit_log(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Public can read published plugins
CREATE POLICY "Public can read published plugins"
ON plugins FOR SELECT
USING (status = 'PUBLISHED' AND is_deleted = FALSE);

-- Policy: Public can read published plugin versions
CREATE POLICY "Public can read published versions"
ON plugin_versions FOR SELECT
USING (status = 'PUBLISHED');

-- Policy: Service role has full access on plugins
CREATE POLICY "Service role full access on plugins"
ON plugins FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policy: Service role has full access on versions
CREATE POLICY "Service role full access on versions"
ON plugin_versions FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- STORAGE BUCKETS (Create in Supabase Dashboard)
-- ============================================================

-- Create these buckets in the Supabase Storage Dashboard:
-- 1. plugins - Versioned .synx artifacts
-- 2. icons - Plugin icons (PNG, SVG)
-- 3. temp-uploads - Staging area for uploads

-- Or use SQL (if you have service role access):
-- INSERT INTO storage.buckets (id, name, public) VALUES
-- ('plugins', 'plugins', false),
-- ('icons', 'icons', true),
-- ('temp-uploads', 'temp-uploads', false);

-- ============================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================

-- Insert sample plugin
INSERT INTO plugins (package_id, name, description, author, category, status, latest_version_id)
VALUES (
    'com.synapse.tictic',
    'Tic Tac Toe',
    'Classic two-player game',
    'Synapse Team',
    'games',
    'PUBLISHED',
    NULL
);

-- Note: You'll need to insert a version first, then update the plugin's latest_version_id
