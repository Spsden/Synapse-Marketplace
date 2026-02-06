-- ============================================================
-- OAuth Broker System - Database Schema
-- ============================================================
-- This migration adds support for OAuth authentication flows
-- for plugins that need to connect to external providers
-- (Notion, Google, GitHub, etc.)

-- ============================================================
-- Enable pgcrypto for encryption
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Encryption Functions (using pgcrypto)
-- ============================================================

-- Encrypt data using PGP with a passphrase from environment
CREATE OR REPLACE FUNCTION encrypt_text(data TEXT, passphrase TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_encrypt(data, passphrase);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypt data using PGP with a passphrase from environment
CREATE OR REPLACE FUNCTION decrypt_text(encrypted_data TEXT, passphrase TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_data::bytea, passphrase);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TABLE: plugin_oauth_clients
-- ============================================================
-- Stores OAuth client credentials for each plugin/provider combination
-- Developers submit these through the Developer Portal

CREATE TABLE plugin_oauth_clients (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id               UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    provider                VARCHAR(50) NOT NULL,
    client_id               TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    redirect_url            TEXT NOT NULL,
    scopes                  TEXT[],
    created_by              VARCHAR(255) NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active               BOOLEAN DEFAULT TRUE,

    CONSTRAINT unique_plugin_provider UNIQUE (plugin_id, provider)
);

-- Indexes for OAuth clients
CREATE INDEX idx_oauth_clients_plugin_id ON plugin_oauth_clients(plugin_id);
CREATE INDEX idx_oauth_clients_provider ON plugin_oauth_clients(provider);
CREATE INDEX idx_oauth_clients_created_by ON plugin_oauth_clients(created_by);

-- Trigger for updated_at
CREATE TRIGGER update_oauth_clients_updated_at
    BEFORE UPDATE ON plugin_oauth_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: plugin_oauth_tokens
-- ============================================================
-- Stores OAuth access/refresh tokens for users per plugin/provider
-- These tokens are used to make authenticated requests to providers

CREATE TABLE plugin_oauth_tokens (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     VARCHAR(255) NOT NULL,
    plugin_id                   UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    provider                    VARCHAR(50) NOT NULL,
    access_token_encrypted      TEXT NOT NULL,
    refresh_token_encrypted     TEXT,
    token_type                  VARCHAR(20) DEFAULT 'Bearer',
    expires_at                  TIMESTAMP WITH TIME ZONE,
    scopes                      TEXT[],
    metadata                    JSONB,
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at                TIMESTAMP WITH TIME ZONE,
    is_revoked                  BOOLEAN DEFAULT FALSE,

    CONSTRAINT unique_user_plugin_provider UNIQUE (user_id, plugin_id, provider)
);

-- Indexes for OAuth tokens
CREATE INDEX idx_oauth_tokens_user_id ON plugin_oauth_tokens(user_id);
CREATE INDEX idx_oauth_tokens_plugin_id ON plugin_oauth_tokens(plugin_id);
CREATE INDEX idx_oauth_tokens_provider ON plugin_oauth_tokens(provider);
CREATE INDEX idx_oauth_tokens_composite ON plugin_oauth_tokens(user_id, plugin_id, provider);
CREATE INDEX idx_oauth_tokens_expires_at ON plugin_oauth_tokens(expires_at) WHERE is_revoked = FALSE;

-- Trigger for updated_at
CREATE TRIGGER update_oauth_tokens_updated_at
    BEFORE UPDATE ON plugin_oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: oauth_sessions
-- ============================================================
-- Stores temporary OAuth flow session data (PKCE verifiers, state)
-- These have a short TTL and are cleaned up after use

CREATE TABLE oauth_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR(255) NOT NULL,
    plugin_id       UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    provider        VARCHAR(50) NOT NULL,
    state           VARCHAR(255) NOT NULL UNIQUE,
    code_verifier   VARCHAR(255) NOT NULL,
    code_challenge  VARCHAR(255),
    redirect_uri    TEXT,
    scopes          TEXT[],
    metadata        JSONB,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for OAuth sessions
CREATE INDEX idx_oauth_sessions_state ON oauth_sessions(state);
CREATE INDEX idx_oauth_sessions_user_id ON oauth_sessions(user_id);
CREATE INDEX idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);

-- ============================================================
-- TABLE: oauth_audit_log
-- ============================================================
-- Audit log for all OAuth operations (token exchange, refresh, revoke)

CREATE TABLE oauth_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR(255),
    plugin_id       UUID,
    provider        VARCHAR(50),
    action          VARCHAR(50) NOT NULL,
    status          VARCHAR(20) NOT NULL,
    error_message   TEXT,
    ip_address      INET,
    user_agent      TEXT,
    metadata        JSONB,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit log
CREATE INDEX idx_oauth_audit_user_id ON oauth_audit_log(user_id);
CREATE INDEX idx_oauth_audit_plugin_id ON oauth_audit_log(plugin_id);
CREATE INDEX idx_oauth_audit_provider ON oauth_audit_log(provider);
CREATE INDEX idx_oauth_audit_created_at ON oauth_audit_log(created_at DESC);

-- ============================================================
-- FUNCTION: cleanup_expired_sessions
-- ============================================================
-- Scheduled job to clean up expired OAuth sessions

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM oauth_sessions
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: log_oauth_action
-- ============================================================
-- Helper function to log OAuth actions

CREATE OR REPLACE FUNCTION log_oauth_action(
    p_user_id VARCHAR,
    p_plugin_id UUID,
    p_provider VARCHAR,
    p_action VARCHAR,
    p_status VARCHAR,
    p_error_message TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO oauth_audit_log (
        user_id, plugin_id, provider, action, status,
        error_message, ip_address, user_agent, metadata
    ) VALUES (
        p_user_id, p_plugin_id, p_provider, p_action, p_status,
        p_error_message, p_ip_address, p_user_agent, p_metadata
    ) RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on OAuth tables
ALTER TABLE plugin_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access on OAuth clients
CREATE POLICY "Service role full access on oauth_clients"
ON plugin_oauth_clients FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policy: Service role has full access on OAuth tokens
CREATE POLICY "Service role full access on oauth_tokens"
ON plugin_oauth_tokens FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policy: Service role has full access on OAuth sessions
CREATE POLICY "Service role full access on oauth_sessions"
ON oauth_sessions FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policy: Service role has full access on OAuth audit log
CREATE POLICY "Service role full access on oauth_audit_log"
ON oauth_audit_log FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE plugin_oauth_clients IS 'Stores OAuth client credentials per plugin/provider';
COMMENT ON TABLE plugin_oauth_tokens IS 'Stores user OAuth tokens per plugin/provider';
COMMENT ON TABLE oauth_sessions IS 'Stores temporary OAuth session data (PKCE, state)';
COMMENT ON TABLE oauth_audit_log IS 'Audit log for all OAuth operations';

COMMENT ON COLUMN plugin_oauth_clients.client_secret_encrypted IS 'PGP encrypted client secret';
COMMENT ON COLUMN plugin_oauth_tokens.access_token_encrypted IS 'PGP encrypted access token';
COMMENT ON COLUMN plugin_oauth_tokens.refresh_token_encrypted IS 'PGP encrypted refresh token (nullable)';
COMMENT ON COLUMN oauth_sessions.code_verifier IS 'PKCE code verifier for OAuth 2.0';
COMMENT ON COLUMN oauth_sessions.state IS 'OAuth state parameter for CSRF protection';
