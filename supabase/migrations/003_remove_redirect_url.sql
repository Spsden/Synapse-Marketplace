-- ============================================================
-- Remove redirect_url from plugin_oauth_clients
-- ============================================================
-- Security: Redirect URLs are now platform-controlled and computed
-- internally based on the provider, not stored or configured by developers.
-- This prevents token interception, phishing, and provider compliance issues.

-- Drop the redirect_url column from plugin_oauth_clients
ALTER TABLE plugin_oauth_clients
DROP COLUMN IF EXISTS redirect_url;
