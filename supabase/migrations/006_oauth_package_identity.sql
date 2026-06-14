-- Decouple OAuth client credentials from plugin row lifecycle.
--
-- Older installations used plugin_id with ON DELETE CASCADE. Current
-- installations use package_id. This migration safely converges both shapes
-- while preserving encrypted credentials.

ALTER TABLE plugin_oauth_clients
    ADD COLUMN IF NOT EXISTS package_id VARCHAR(255);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'plugin_oauth_clients'
          AND column_name = 'plugin_id'
    ) THEN
        UPDATE plugin_oauth_clients oauth
        SET package_id = plugins.package_id
        FROM plugins
        WHERE oauth.plugin_id = plugins.id
          AND oauth.package_id IS NULL;
    END IF;
END $$;
ALTER TABLE plugin_oauth_clients
    ALTER COLUMN package_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_clients_package_provider
    ON plugin_oauth_clients(package_id, provider);

CREATE INDEX IF NOT EXISTS idx_oauth_clients_package_id
    ON plugin_oauth_clients(package_id);

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'plugin_oauth_clients'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'plugins'
    LOOP
        EXECUTE format(
            'ALTER TABLE plugin_oauth_clients DROP CONSTRAINT IF EXISTS %I',
            constraint_name
        );
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'plugin_oauth_clients'
          AND column_name = 'plugin_id'
    ) THEN
        ALTER TABLE plugin_oauth_clients DROP COLUMN plugin_id;
    END IF;
END $$;
