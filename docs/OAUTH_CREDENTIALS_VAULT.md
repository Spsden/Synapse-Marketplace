# OAuth Credentials Vault

A minimal secure storage service for OAuth client credentials that plugins need to authenticate with external providers (Notion, Google, GitHub, etc.).

**Purpose**: Store developer OAuth credentials (client_id, client_secret) securely in the plugin marketplace backend. The Synapse host app fetches these credentials just-in-time to run its existing OAuth flow.

**What it is NOT**: This is NOT a full OAuth broker. The Synapse host continues to manage PKCE, token exchange, and token storage locally. This vault only provides the initial client credentials needed to start the OAuth flow.

---

## Database Schema

### Table: `plugin_oauth_clients`

```sql
CREATE TABLE plugin_oauth_clients (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id               UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    provider                VARCHAR(50) NOT NULL,
    client_id               TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    redirect_url            TEXT NOT NULL,
    scopes                  TEXT[] NOT NULL DEFAULT '{}',
    owner_developer_id      VARCHAR(255) NOT NULL,
    metadata                JSONB DEFAULT '{}'::jsonb,
    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_plugin_provider UNIQUE (plugin_id, provider)
);

-- Indexes
CREATE INDEX idx_oauth_clients_plugin_id ON plugin_oauth_clients(plugin_id);
CREATE INDEX idx_oauth_clients_provider ON plugin_oauth_clients(provider);
CREATE INDEX idx_oauth_clients_developer ON plugin_oauth_clients(owner_developer_id);

-- Auto-update timestamp
CREATE TRIGGER update_oauth_clients_updated_at
    BEFORE UPDATE ON plugin_oauth_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: Only service role can read/write
ALTER TABLE plugin_oauth_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON plugin_oauth_clients
    FOR ALL USING (auth.role() = 'service_role');
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `plugin_id` | UUID | Foreign key to `plugins.id` |
| `provider` | VARCHAR(50) | Provider name: `notion`, `google`, `github`, etc. |
| `client_id` | TEXT | OAuth client ID from provider (plaintext) |
| `client_secret_encrypted` | TEXT | OAuth client secret, AES-256 encrypted |
| `redirect_url` | TEXT | OAuth redirect URL registered with provider |
| `scopes` | TEXT[] | Default OAuth scopes for this plugin |
| `owner_developer_id` | VARCHAR(255) | Developer user ID who submitted credentials |
| `metadata` | JSONB | Provider-specific flags (see below) |
| `is_active` | BOOLEAN | Enable/disable credentials without deletion |

### Metadata Field Structure

The `metadata` JSONB column stores provider-specific OAuth configuration:

```json
{
  "prompt": "consent",              // Google: force consent screen
  "access_type": "offline",         // Google: request refresh token
  "token_auth": true,               // Use HTTP Basic auth for token endpoint
  "approval_prompt": "auto",        // Additional approval parameters
  "include_granted_scopes": true    // Include previously granted scopes
}
```

---

## Encryption

Secrets are encrypted using **AES-256-GCM** before storage:

```typescript
import { createCipheriv, createDecipheriv, randomBytes, CipherGCM } from 'crypto';

const ENCRYPTION_KEY = process.env.VAULT_ENCRYPTION_KEY; // 32 bytes, base64

function encryptSecret(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv) as CipherGCM;
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted}`;
}

function decryptSecret(encrypted: string): string {
  const [ivB64, tagB64, ciphertext] = encrypted.split('.');
  const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivB64, 'base64')) as DecipherGCM;
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

**Important**: Only the backend service-role can decrypt. The `client_secret_encrypted` value is NEVER returned to API consumers.

---

## API Specification

### Base URL
```
/api/v1/dev/oauth/credentials
```

### 1. Submit Credentials

Create or update OAuth client credentials for a plugin.

```http
POST /api/v1/dev/oauth/credentials
```

**Request Body:**
```json
{
  "plugin_id": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "notion",
  "client_id": "oauth-client-id-abc123",
  "client_secret": "oauth-secret-xyz789",
  "redirect_url": "synapse://oauth/callback",
  "scopes": [],
  "metadata": {
    "token_auth": true
  }
}
```

**Response (201 Created):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "plugin_id": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "notion",
  "client_id": "oauth-client-id-abc123",
  "redirect_url": "synapse://oauth/callback",
  "scopes": [],
  "metadata": {
    "token_auth": true
  },
  "is_active": true,
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

**Note:** `client_secret_encrypted` is NEVER returned in responses.

---

### 2. List Credentials (by Plugin)

Get all OAuth credentials for a specific plugin.

```http
GET /api/v1/dev/oauth/credentials?plugin_id={plugin_id}
```

**Response (200 OK):**
```json
{
  "credentials": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "plugin_id": "550e8400-e29b-41d4-a716-446655440000",
      "provider": "notion",
      "client_id": "oauth-client-id-abc123",
      "redirect_url": "synapse://oauth/callback",
      "scopes": [],
      "is_active": true,
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

### 3. List Credentials (by Developer)

Get all OAuth credentials submitted by a developer.

```http
GET /api/v1/dev/oauth/credentials?developer_id={developer_id}
```

**Response (200 OK):**
```json
{
  "credentials": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "plugin_id": "550e8400-e29b-41d4-a716-446655440000",
      "provider": "notion",
      "client_id": "oauth-client-id-abc123",
      "redirect_url": "synapse://oauth/callback",
      "scopes": [],
      "is_active": true,
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

### 4. Get Credential for OAuth (Internal)

**Internal endpoint used by Synapse host to fetch credentials before starting OAuth.**
Returns the decrypted client secret (only accessible with proper authorization).

```http
POST /api/v1/oauth/credentials/fetch
Authorization: Bearer <internal-service-token>
```

**Request Body:**
```json
{
  "plugin_id": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "notion"
}
```

**Response (200 OK):**
```json
{
  "client_id": "oauth-client-id-abc123",
  "client_secret": "oauth-secret-xyz789",
  "redirect_url": "synapse://oauth/callback",
  "scopes": [],
  "metadata": {
    "token_auth": true
  }
}
```

**Error Responses:**
- `404 Not Found` - No credentials exist for this plugin/provider
- `410 Gone` - Credentials exist but are disabled (`is_active = false`)

---

### 5. Update Credentials

Rotate or modify existing OAuth credentials.

```http
PUT /api/v1/dev/oauth/credentials/{credential_id}
```

**Request Body:**
```json
{
  "client_id": "new-client-id",
  "client_secret": "new-client-secret",
  "redirect_url": "synapse://oauth/callback",
  "scopes": ["read", "write"],
  "metadata": {
    "prompt": "consent"
  },
  "is_active": true
}
```

**Response (200 OK):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "plugin_id": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "notion",
  "client_id": "new-client-id",
  "redirect_url": "synapse://oauth/callback",
  "scopes": ["read", "write"],
  "metadata": {
    "prompt": "consent"
  },
  "is_active": true,
  "updated_at": "2025-01-15T11:00:00Z"
}
```

---

### 6. Disable Credentials

Soft-delete credentials (sets `is_active = false`).

```http
DELETE /api/v1/dev/oauth/credentials/{credential_id}
```

**Response (204 No Content)**

---

## Security Notes

### Service-Role Only Access

- All database operations use Supabase **service role key**
- RLS policy ensures only `auth.role() = 'service_role'` can read/write
- End-user requests (with anon key) cannot access encrypted secrets

### Encryption at Rest

- `client_secret_encrypted` uses AES-256-GCM
- Each encryption uses a unique IV (prevents pattern analysis)
- Auth tag ensures integrity (detects tampering)
- Encryption key stored in environment variable, not database

### Secret Exposure Prevention

| Operation | Secret Returned? |
|-----------|------------------|
| Submit (POST) | No - only confirms storage |
| List (GET) | No - never included |
| Update (PUT) | No - only confirms update |
| Fetch (internal) | **Yes** - decrypted for OAuth flow |
| Delete (DELETE) | No |

The `/fetch` endpoint requires internal service authorization and is only called by the Synapse host app when initiating OAuth.

### Developer Portal Security

The developer portal should:
1. Never display stored secrets back to developers
2. Require re-entry of secrets on updates (show `************` for existing)
3. Log all credential access attempts
4. Limit credential submission to verified developers

---

## Integration with Synapse Host

The Synapse host app continues to manage the complete OAuth flow:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Synapse Host OAuth Flow                      │
└─────────────────────────────────────────────────────────────────┘

1. Plugin manifest declares: { "provider": "notion", "scopes": [] }
   │
2. Host fetches credentials from vault
   │  POST /api/v1/oauth/credentials/fetch
   │  → { client_id, client_secret, redirect_url, scopes, metadata }
   │
3. Host generates PKCE verifier + challenge
   │
4. Host builds authorization URL with fetched client_id
   │  → https://noton.com/oauth?client_id=...&code_challenge=...
   │
5. User authorizes in browser
   │
6. Host exchanges code for tokens (using client_secret)
   │
7. Host stores tokens locally (NOT in marketplace DB)
```

**Key Point**: The marketplace vault only provides the **initial client credentials**. All subsequent OAuth operations (PKCE, token exchange, token storage, refresh) remain in the Synapse host app.

---

## Supported Providers

| Provider | Provider Value | Default Scopes | Special Notes |
|----------|---------------|----------------|---------------|
| Notion | `notion` | `[]` | Requires Basic auth for token |
| Google | `google` | `openid,profile,email` | Set `access_type: offline` in metadata for refresh tokens |
| GitHub | `github` | `read:user,user:email` | |
| Slack | `slack` | `chat:write,channels:read` | |
| Microsoft | `microsoft` | `openid,profile,email` | |
| Discord | `discord` | `identify,guilds` | |
| Linear | `linear` | `read,write` | |
| Figma | `figma` | `file_read` | |
| Salesforce | `salesforce` | `api,web,full` | Instance-specific URLs |
| Dropbox | `dropbox` | `[]` | |
| Stripe | `stripe` | `read_only` | |

---

## Environment Variables

```bash
# Required: 32-byte encryption key (generate with: openssl rand -base64 32)
VAULT_ENCRYPTION_KEY=<base64-encoded-32-bytes>

# Optional: Internal service token for /fetch endpoint
OAUTH_VAULT_INTERNAL_TOKEN=<service-token>
```

---

## Migration SQL

```sql
-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the table
CREATE TABLE plugin_oauth_clients (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id               UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    provider                VARCHAR(50) NOT NULL,
    client_id               TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    redirect_url            TEXT NOT NULL,
    scopes                  TEXT[] NOT NULL DEFAULT '{}',
    owner_developer_id      VARCHAR(255) NOT NULL,
    metadata                JSONB DEFAULT '{}'::jsonb,
    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_plugin_provider UNIQUE (plugin_id, provider)
);

-- Indexes
CREATE INDEX idx_oauth_clients_plugin_id ON plugin_oauth_clients(plugin_id);
CREATE INDEX idx_oauth_clients_provider ON plugin_oauth_clients(provider);
CREATE INDEX idx_oauth_clients_developer ON plugin_oauth_clients(owner_developer_id);

-- RLS (service role only)
ALTER TABLE plugin_oauth_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on plugin_oauth_clients"
ON plugin_oauth_clients FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
```
