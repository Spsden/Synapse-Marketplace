-- ============================================================
-- OAuth Credentials Vault - Database Schema
-- ============================================================
-- This migration adds support for storing OAuth client credentials
-- for plugins that need to authenticate with external providers.

-- ============================================================
-- Enable pgcrypto for encryption
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLE: plugin_oauth_clients
-- ============================================================
-- Stores OAuth client credentials submitted by developers.
-- The Synapse host app fetches these credentials to run OAuth flows.

CREATE TABLE plugin_oauth_clients (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id               UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    provider                VARCHAR(50) NOT NULL,
    client_id               TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    scopes                  TEXT[] NOT NULL DEFAULT '{}',
    owner_developer_id      VARCHAR(255) NOT NULL,
    metadata                JSONB DEFAULT '{}'::jsonb,
    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_plugin_provider UNIQUE (plugin_id, provider)
);

-- Indexes for OAuth clients
CREATE INDEX idx_oauth_clients_plugin_id ON plugin_oauth_clients(plugin_id);
CREATE INDEX idx_oauth_clients_provider ON plugin_oauth_clients(provider);
CREATE INDEX idx_oauth_clients_developer ON plugin_oauth_clients(owner_developer_id);

-- Trigger for updated_at
CREATE TRIGGER update_oauth_clients_updated_at
    BEFORE UPDATE ON plugin_oauth_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE plugin_oauth_clients ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access on OAuth clients
CREATE POLICY "Service role full access on plugin_oauth_clients"
ON plugin_oauth_clients FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE plugin_oauth_clients IS 'Stores OAuth client credentials per plugin/provider';
COMMENT ON COLUMN plugin_oauth_clients.client_secret_encrypted IS 'AES-256-GCM encrypted client secret';
COMMENT ON COLUMN plugin_oauth_clients.metadata IS 'Provider-specific OAuth configuration flags (prompt, token_auth, etc.)';
