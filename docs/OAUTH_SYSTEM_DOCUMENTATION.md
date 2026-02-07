# OAuth Broker System & Vault - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Vault Module](#vault-module)
4. [OAuth Module](#oauth-module)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [OAuth Flow](#oauth-flow)
8. [Security Features](#security-features)
9. [Configuration](#configuration)
10. [Developer Integration](#developer-integration)
11. [Host App Integration](#host-app-integration)

---

## Overview

The OAuth Broker System enables plugins to authenticate with external providers (Notion, Google, GitHub, etc.) without handling OAuth credentials directly. The backend manages the complete OAuth 2.0 flow with PKCE, stores encrypted tokens, and provides proxy endpoints for authenticated API calls.

### Key Benefits

- **Security**: OAuth credentials and tokens encrypted at rest using AES-256-GCM
- **PKCE Support**: Proof Key for Code Exchange prevents authorization code interception
- **Multi-Provider**: Support for 11+ OAuth providers out of the box
- **Proxy API**: Backend makes authenticated requests, tokens never exposed to clients
- **Audit Trail**: All OAuth operations logged for compliance and debugging

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OAuth Flow Architecture                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Synapse    │         │   Backend    │         │   Provider   │
│   Host App   │         │   (NestJS)   │         │   (Notion,   │
│              │         │              │         │   Google)    │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │  1. Start OAuth        │                        │
       │  ─────────────────────►│                        │
       │                        │                        │
       │                        │  2. Generate PKCE      │
       │                        │     + Auth URL         │
       │                        │                        │
       │  3. Auth URL           │                        │
       │  ◄─────────────────────│                        │
       │                        │                        │
       │  4. Redirect User      │                        │
       │  ───────────────────────────────────────────────►│
       │                        │                        │
       │                        │  5. User Authorizes    │
       │                        │  ◄─────────────────────│
       │                        │                        │
       │                        │  6. Exchange Code      │
       │                        │  ─────────────────────►│
       │                        │                        │
       │                        │  7. Return Tokens      │
       │                        │  ◄─────────────────────│
       │                        │                        │
       │  8. Deep Link Success  │                        │
       │  ◄─────────────────────│                        │
       │                        │                        │
       │  9. Proxy API Request  │                        │
       │  ─────────────────────►│                        │
       │                        │                        │
       │                        │  10. Authenticated API │
       │                        │  ─────────────────────►│
       │                        │                        │
       │  11. API Response      │                        │
       │  ◄─────────────────────│◄───────────────────────│
```

---

## Vault Module

The Vault module provides encryption/decryption services for sensitive data using AES-256-GCM.

### File Structure

```
src/vault/
├── vault.module.ts          # Global module export
├── vault.service.ts         # Encryption/decryption logic
└── vault.service.spec.ts    # Unit tests
```

### VaultService

**Location**: `src/vault/vault.service.ts`

#### Encryption Algorithm: AES-256-GCM

| Property | Value |
|----------|-------|
| Algorithm | AES-256-GCM |
| Key Length | 256 bits (32 bytes) |
| IV Length | 128 bits (16 bytes) |
| Auth Tag Length | 128 bits (16 bytes) |
| Key Derivation | PBKDF2 (100,000 iterations) |

#### Key Methods

```typescript
class VaultService {
  // Encrypt plaintext to base64-encoded ciphertext
  async encrypt(plaintext: string): Promise<string>

  // Decrypt base64-encoded ciphertext to plaintext
  async decrypt(encryptedData: string): Promise<string>

  // Encrypt object (serialized to JSON first)
  async encryptObject<T>(data: T): Promise<string>

  // Decrypt and parse JSON
  async decryptObject<T>(encryptedData: string): Promise<T>

  // One-way hash (SHA-256)
  hash(data: string): string

  // Generate cryptographically secure random string
  generateRandom(length: number, encoding?: 'hex' | 'base64url'): string
}
```

#### Encrypted Data Format

```
base64(iv).base64(authTag).base64(ciphertext)

Example:
W3JqN3pLbGxVTW5jS3Rw.Q2FRRnlSWWpRL2Z0Vk1sMA.g0cEtJVWV...[ciphertext]
```

The three dot-separated parts ensure:
1. **IV** - Unique for each encryption (required for GCM)
2. **Auth Tag** - Ensures data integrity (detects tampering)
3. **Ciphertext** - The encrypted data

#### Configuration

```bash
# .env
VAULT_ENCRYPTION_KEY=<32-byte-base64-encoded-key>
```

Generate a key:
```bash
openssl rand -base64 32
```

---

## OAuth Module

The OAuth module handles the complete OAuth 2.0 lifecycle with PKCE support.

### File Structure

```
src/oauth/
├── oauth.module.ts              # Module definition
├── oauth.service.ts             # Core OAuth logic
├── oauth.controller.ts          # HTTP endpoints
├── oauth-proxy.service.ts       # Proxy API service
├── oauth-proxy.controller.ts    # Proxy endpoints
├── oauth-provider.config.ts     # Provider configurations
├── oauth-clients.repository.ts  # Client credentials storage
├── oauth-tokens.repository.ts   # Token storage
├── oauth-sessions.repository.ts # Session storage
└── oauth-audit.repository.ts    # Audit logging
```

### OAuthService

**Location**: `src/oauth/oauth.service.ts`

#### Core Methods

```typescript
class OAuthService {
  // Start OAuth flow - returns authorization URL
  async startFlow(params: StartOAuthParams): Promise<StartOAuthResult>

  // Handle OAuth callback from provider
  async handleCallback(params: HandleCallbackParams): Promise<HandleCallbackResult>

  // Refresh expired access token
  async refreshToken(userId: string, pluginId: string, provider: OAuthProvider): Promise<OAuthTokenInfo>

  // Revoke OAuth tokens
  async revokeToken(userId: string, pluginId: string, provider: OAuthProvider): Promise<void>

  // Check if user has valid token
  async hasValidToken(userId: string, pluginId: string, provider: OAuthProvider): Promise<boolean>
}
```

### Supported Providers

| Provider | Auth URL | Token URL | PKCE | Default Scopes |
|----------|----------|-----------|------|----------------|
| **Notion** | `api.notion.com/v1/oauth/authorize` | `api.notion.com/v1/oauth/token` | ✓ | `[]` |
| **Google** | `accounts.google.com/o/oauth2/v2/auth` | `oauth2.googleapis.com/token` | ✓ | `openid, profile, email` |
| **GitHub** | `github.com/login/oauth/authorize` | `github.com/login/oauth/access_token` | ✓ | `read:user, user:email` |
| **Slack** | `slack.com/oauth/v2/authorize` | `slack.com/api/oauth.v2.access` | ✓ | `chat:write, channels:read` |
| **Microsoft** | `login.microsoftonline.com/...` | `login.microsoftonline.com/...` | ✓ | `openid, profile, email` |
| **Discord** | `discord.com/oauth2/authorize` | `discord.com/api/oauth2/token` | ✓ | `identify, guilds` |
| **Linear** | `linear.app/oauth/authorize` | `api.linear.app/oauth/token` | ✓ | `read, write` |
| **Figma** | `www.figma.com/oauth` | `www.figma.com/api/oauth/token` | ✓ | `file_read` |
| **Salesforce** | Instance-specific | Instance-specific | ✓ | `api, web, full` |
| **Dropbox** | `www.dropbox.com/oauth2/authorize` | `api.dropboxapi.com/oauth2/token` | ✓ | `[]` |
| **Stripe** | `connect.stripe.com/oauth/authorize` | `connect.stripe.com/oauth/token` | ✓ | `read_only` |

### OAuthProxyService

**Location**: `src/oauth/oauth-proxy.service.ts`

Makes authenticated API requests to providers on behalf of users.

```typescript
class OAuthProxyService {
  // Generic proxy request
  async proxyRequest(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
    path: string,
    options: ProxyRequestOptions
  ): Promise<ProxyResponse>

  // HTTP method shortcuts
  async get(userId, pluginId, provider, path, params?, headers?): Promise<ProxyResponse>
  async post(userId, pluginId, provider, path, body?, headers?): Promise<ProxyResponse>
  async put(userId, pluginId, provider, path, body?, headers?): Promise<ProxyResponse>
  async patch(userId, pluginId, provider, path, body?, headers?): Promise<ProxyResponse>
  async delete(userId, pluginId, provider, path, params?, headers?): Promise<ProxyResponse>
}
```

---

## Database Schema

### Tables

#### 1. `plugin_oauth_clients`

Stores OAuth client credentials submitted by developers.

```sql
CREATE TABLE plugin_oauth_clients (
    id                      UUID PRIMARY KEY,
    plugin_id               UUID REFERENCES plugins(id),
    provider                VARCHAR(50) NOT NULL,
    client_id               TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,        -- AES-256 encrypted
    redirect_url            TEXT NOT NULL,
    scopes                  TEXT[],
    created_by              VARCHAR(255) NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE,
    updated_at              TIMESTAMP WITH TIME ZONE,
    is_active               BOOLEAN DEFAULT TRUE,

    CONSTRAINT unique_plugin_provider UNIQUE (plugin_id, provider)
);
```

**Fields**:
- `client_secret_encrypted`: The OAuth client secret, encrypted with VaultService
- `redirect_url`: The OAuth redirect URL registered with the provider
- `scopes`: Default scopes for this plugin/provider combination

#### 2. `plugin_oauth_tokens`

Stores user OAuth tokens after successful authentication.

```sql
CREATE TABLE plugin_oauth_tokens (
    id                          UUID PRIMARY KEY,
    user_id                     VARCHAR(255) NOT NULL,
    plugin_id                   UUID REFERENCES plugins(id),
    provider                    VARCHAR(50) NOT NULL,
    access_token_encrypted      TEXT NOT NULL,     -- AES-256 encrypted
    refresh_token_encrypted     TEXT,              -- AES-256 encrypted (nullable)
    token_type                  VARCHAR(20) DEFAULT 'Bearer',
    expires_at                  TIMESTAMP WITH TIME ZONE,
    scopes                      TEXT[],
    metadata                    JSONB,
    created_at                  TIMESTAMP WITH TIME ZONE,
    updated_at                  TIMESTAMP WITH TIME ZONE,
    last_used_at                TIMESTAMP WITH TIME ZONE,
    is_revoked                  BOOLEAN DEFAULT FALSE,

    CONSTRAINT unique_user_plugin_provider UNIQUE (user_id, plugin_id, provider)
);
```

**Fields**:
- `access_token_encrypted`: The access token, encrypted with VaultService
- `refresh_token_encrypted`: The refresh token (if provider supports it), encrypted
- `expires_at`: When the access token expires (nullable for non-expiring tokens)
- `last_used_at`: Updated each time the token is used via proxy
- `is_revoked`: Soft delete flag

#### 3. `oauth_sessions`

Temporary storage for OAuth flow session data (PKCE verifiers, state).

```sql
CREATE TABLE oauth_sessions (
    id              UUID PRIMARY KEY,
    user_id         VARCHAR(255) NOT NULL,
    plugin_id       UUID REFERENCES plugins(id),
    provider        VARCHAR(50) NOT NULL,
    state           VARCHAR(255) NOT NULL UNIQUE,
    code_verifier   VARCHAR(255) NOT NULL,
    code_challenge  VARCHAR(255),
    redirect_uri    TEXT,
    scopes          TEXT[],
    metadata        JSONB,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL    -- ~10 minutes
);
```

**Fields**:
- `state`: Random string for CSRF protection
- `code_verifier`: PKCE code verifier (generated by us)
- `code_challenge`: PKCE code challenge (SHA256 of verifier, base64url)
- `expires_at`: Session expiry time (default 10 minutes)

#### 4. `oauth_audit_log`

Audit trail for all OAuth operations.

```sql
CREATE TABLE oauth_audit_log (
    id              UUID PRIMARY KEY,
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
```

**Actions logged**:
- `flow_started` - OAuth flow initiated
- `auth_code_received` - Authorization code received from provider
- `token_exchanged` - Authorization code exchanged for tokens
- `token_refreshed` - Access token refreshed
- `token_revoked` - User revoked their tokens
- `token_used` - Token used via proxy API
- `session_expired` - Session expired
- `flow_failed` - OAuth flow failed

---

## API Endpoints

### OAuth Flow Endpoints

#### Start OAuth Flow

```http
GET /api/v1/oauth/:provider/start?user_id={user_id}&plugin_id={plugin_id}
```

**Response**:
```json
{
  "authorization_url": "https://api.notion.com/v1/oauth/authorize?...",
  "state": "random_state_string"
}
```

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | User ID initiating the flow |
| `plugin_id` | string | Yes | Plugin ID requesting OAuth |
| `redirect_uri` | string | No | Custom redirect URI |
| `scopes` | string | No | Comma-separated scopes |

#### OAuth Callback

```http
GET /api/v1/oauth/:provider/callback?code={code}&state={state}
```

**Response**: Redirects to `synapse://oauth/success?plugin_id={plugin}` or `synapse://oauth/error?error={error}`

#### Refresh Token

```http
POST /api/v1/oauth/:provider/refresh?user_id={user_id}&plugin_id={plugin_id}
```

**Response**:
```json
{
  "expiresAt": "2025-01-01T12:00:00Z",
  "expiresIn": 3600,
  "scopes": ["read", "write"]
}
```

#### Revoke Token

```http
POST /api/v1/oauth/:provider/revoke?user_id={user_id}&plugin_id={plugin_id}
```

**Response**: `204 No Content`

#### Check Token Validity

```http
GET /api/v1/oauth/:provider/check?user_id={user_id}&plugin_id={plugin_id}
```

**Response**:
```json
{
  "valid": true
}
```

### OAuth Proxy Endpoints

#### Generic Proxy

```http
POST /api/v1/proxy/:provider/*
```

Make any HTTP request to a provider with automatic authentication.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | User ID |
| `plugin_id` | string | Yes | Plugin ID |

**Headers**:
| Header | Description |
|--------|-------------|
| `X-HTTP-Method-Override` | HTTP method (GET, POST, PUT, PATCH, DELETE) |
| `Content-Type` | Request content type |

**Example**:
```bash
curl -X POST "http://localhost:3000/api/v1/proxy/notion/users/me" \
  -G \
  -d "user_id=user_123" \
  -d "plugin_id=plugin_456"
```

#### Method-Specific Proxies

```http
GET    /api/v1/proxy/:provider/*
POST   /api/v1/proxy/:provider/post/*
PUT    /api/v1/proxy/:provider/*
PATCH  /api/v1/proxy/:provider/*
DELETE /api/v1/proxy/:provider/*
```

### Developer Portal Endpoints

#### Submit OAuth Credentials

```http
POST /api/v1/dev/plugins/oauth/credentials
```

**Request Body**:
```json
{
  "plugin_id": "plugin-uuid",
  "provider": "notion",
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "redirect_url": "https://your-domain.com/api/v1/oauth/notion/callback",
  "scopes": [],
  "created_by": "developer-user-id"
}
```

#### Get OAuth Credentials

```http
GET /api/v1/dev/plugins/:pluginId/oauth/credentials
```

**Response** (secret never returned):
```json
[
  {
    "id": "cred-uuid",
    "plugin_id": "plugin-uuid",
    "provider": "notion",
    "client_id": "client-id-from-notion",
    "redirect_url": "https://...",
    "scopes": [],
    "is_active": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
]
```

#### Update OAuth Credentials

```http
PUT /api/v1/dev/plugins/oauth/credentials/:credentialId
```

**Request Body**:
```json
{
  "client_id": "new-client-id",
  "client_secret": "new-client-secret",
  "redirect_url": "new-redirect-url",
  "scopes": ["read"],
  "is_active": true
}
```

#### Deactivate OAuth Credentials

```http
DELETE /api/v1/dev/plugins/oauth/credentials/:credentialId
```

**Response**: `204 No Content`

---

## OAuth Flow

### 1. Developer Setup

1. Developer creates OAuth app with provider (Notion, Google, etc.)
2. Developer gets `client_id` and `client_secret` from provider
3. Developer sets redirect URL: `https://your-domain.com/api/v1/oauth/notion/callback`
4. Developer submits credentials via API:
   ```bash
   POST /api/v1/dev/plugins/oauth/credentials
   ```

### 2. User Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        OAuth Flow with PKCE                             │
└─────────────────────────────────────────────────────────────────────────┘

1. User initiates OAuth in host app
   └─► Host app calls: GET /api/v1/oauth/notion/start?user_id=X&plugin_id=Y

2. Backend generates PKCE parameters
   └─► code_verifier = random(32 bytes, base64url)
   └─► code_challenge = SHA256(code_verifier) → base64url
   └─► state = random(32 bytes, base64url)
   └─► Stores session in oauth_sessions table

3. Backend returns authorization URL
   └─► authorization_url contains: client_id, redirect_uri, state,
       code_challenge, response_type=code

4. Host app opens authorization_url in browser

5. User authorizes with provider (logs in, approves scopes)

6. Provider redirects to callback URL
   └─► GET /api/v1/oauth/notion/callback?code=AUTH_CODE&state=STATE

7. Backend validates state and retrieves session

8. Backend exchanges code for tokens
   └─► POST to provider's token endpoint
   └─► Includes: code, code_verifier, client_id, client_secret

9. Provider returns access_token (and refresh_token)

10. Backend encrypts and stores tokens
    └─► VaultService.encrypt(access_token)
    └─► Stored in plugin_oauth_tokens table

11. Backend redirects to host app
    └─► synapse://oauth/success?plugin_id=Y&provider=notion

12. Plugin can now make authenticated API requests
    └─► Via proxy: GET /api/v1/proxy/notion/users/me
```

### 3. Token Refresh (when token expires)

```
1. Plugin/Host detects token expired
2. Calls: POST /api/v1/oauth/notion/refresh
3. Backend retrieves encrypted refresh_token
4. Decrypts and exchanges for new access_token
5. Encrypts and updates stored tokens
6. Returns new expiration info
```

### 4. Token Revocation

```
1. User disconnects integration in host app
2. Calls: POST /api/v1/oauth/notion/revoke
3. Backend marks tokens as revoked (is_revoked=true)
4. Tokens can no longer be used via proxy
```

---

## Security Features

### 1. Encryption at Rest

All sensitive data encrypted using AES-256-GCM:

| Data | Storage | Encryption |
|------|---------|------------|
| Client Secret | `plugin_oauth_clients.client_secret_encrypted` | ✓ |
| Access Token | `plugin_oauth_tokens.access_token_encrypted` | ✓ |
| Refresh Token | `plugin_oauth_tokens.refresh_token_encrypted` | ✓ |

### 2. PKCE (Proof Key for Code Exchange)

Prevents authorization code interception attacks:

```
code_verifier (random, secret)
       │
       ├── SHA256 → base64url → code_challenge (sent in auth URL)
       │
       └── sent in token exchange (only backend knows this)
```

Without `code_verifier`, stolen authorization codes cannot be exchanged for tokens.

### 3. State Parameter

CSRF protection via random state parameter:

```
state (random, generated by backend)
       │
       ├── sent in authorization URL
       │
       ├── returned in callback
       │
       └── validated against stored session
```

### 4. Short-Lived Sessions

OAuth sessions expire after 10 minutes:
- Stored in `oauth_sessions` with `expires_at`
- Cleanup function `cleanup_expired_sessions()` removes expired sessions
- Old sessions automatically rejected

### 5. Strict (user_id, plugin_id, provider) Scoping

Tokens are scoped to:
- A specific user
- A specific plugin
- A specific provider

This prevents:
- Plugin A using Plugin B's tokens
- Plugin using tokens for wrong provider
- Cross-user token access

### 6. Audit Logging

All OAuth operations logged:
- `action`: What happened (flow_started, token_exchanged, etc.)
- `status`: success/failure
- `user_id`, `plugin_id`, `provider`: Context
- `ip_address`, `user_agent`: Request metadata
- `error_message`: Failure details
- `metadata`: Additional context

### 7. Service Role Only

All OAuth database operations use Supabase service role key:
- Bypasses RLS for operations
- Never exposes encryption key to clients
- Tokens never sent to frontend

### 8. Vault Key Derivation

Encryption key derived using PBKDF2:
- 100,000 iterations
- SHA-256 hash
- Fixed salt (acceptable because input is random)
- Produces consistent 32-byte key for AES-256

---

## Configuration

### Environment Variables

```bash
# Vault Configuration (required)
VAULT_ENCRYPTION_KEY=<32-byte-base64-encoded-key>

# Generate with: openssl rand -base64 32

# OAuth Configuration (optional)
OAUTH_CALLBACK_BASE_URL=http://localhost:3000
# Defaults to APP_BASE_URL or http://localhost:3000

# Supabase Configuration (required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Module Imports

The VaultModule is marked `@Global()` and imported by AppModule:

```typescript
// src/app.module.ts
import { VaultModule } from './vault/vault.module';
import { OAuthModule } from './oauth/oauth.module';

@Module({
  imports: [
    VaultModule,      // Global - provides VaultService everywhere
    OAuthModule,      // Provides OAuthService, OAuthProxyService
    // ...
  ],
})
export class AppModule {}
```

---

## Developer Integration

### 1. Plugin Manifest

Add `auth` field to `manifest.json`:

```json
{
  "name": "Notion Tasks",
  "version": "1.0.0",
  "auth": {
    "provider": "notion",
    "scopes": []
  }
}
```

### 2. Submit Plugin

```bash
# Submit .synx file
curl -X POST "http://localhost:3000/api/v1/dev/plugins/submit" \
  -F "file=@plugin.synx" \
  -F "packageId=com.example.notion-tasks"
```

### 3. Submit OAuth Credentials

```bash
# After creating OAuth app with Notion
curl -X POST "http://localhost:3000/api/v1/dev/plugins/oauth/credentials" \
  -H "Content-Type: application/json" \
  -d '{
    "plugin_id": "plugin-uuid-from-step-2",
    "provider": "notion",
    "client_id": "your-notion-client-id",
    "client_secret": "your-notion-client-secret",
    "redirect_url": "https://your-domain.com/api/v1/oauth/notion/callback",
    "scopes": [],
    "created_by": "developer-user-id"
  }'
```

### 4. View Credentials

```bash
# List all OAuth credentials for a plugin
curl "http://localhost:3000/api/v1/dev/plugins/{packageId}/oauth/credentials"
```

---

## Host App Integration

### 1. Detect OAuth Requirement

```typescript
// Read plugin manifest
const manifest = await fetchPluginManifest(pluginId);

if (manifest.auth?.provider) {
  // Plugin requires OAuth
  const needsAuth = await checkTokenValidity(userId, pluginId, manifest.auth.provider);
}
```

### 2. Check Token Validity

```bash
curl "http://localhost:3000/api/v1/oauth/notion/check?user_id={user}&plugin_id={plugin}"
# Response: { "valid": true }
```

### 3. Start OAuth Flow

```bash
curl "http://localhost:3000/api/v1/oauth/notion/start?user_id={user}&plugin_id={plugin}"
# Response: {
#   "authorization_url": "https://api.notion.com/v1/oauth/authorize?...",
#   "state": "random_state_string"
# }
```

### 4. Open Authorization URL

```typescript
// Open URL in browser or webview
window.open(authorization_url, '_blank');

// Or in mobile app:
DeepLink.openURL(authorization_url);
```

### 5. Handle Deep Link Redirect

After successful OAuth, provider redirects to your callback, which redirects to:

```
synapse://oauth/success?plugin_id={plugin}&provider=notion
```

### 6. Make Authenticated API Requests

Via proxy (recommended - tokens never exposed):

```bash
curl -X POST "http://localhost:3000/api/v1/proxy/notion/users/me" \
  -G \
  -d "user_id={user}" \
  -d "plugin_id={plugin}"
```

Or directly from plugin code (conceptual):

```javascript
// In plugin JavaScript
const response = await synapse.fetch('/api/v1/proxy/notion/users/me', {
  provider: 'notion',
  headers: {
    'X-User-Id': userId,
    'X-Plugin-Id': pluginId
  }
});
```

---

## Database Setup

### Run Migration

```sql
-- Run in Supabase SQL Editor
-- File: supabase/migrations/002_oauth_system.sql
```

This creates:
1. `plugin_oauth_clients` table
2. `plugin_oauth_tokens` table
3. `oauth_sessions` table
4. `oauth_audit_log` table
5. Encryption functions using pgcrypto
6. Indexes and RLS policies
7. Cleanup functions

### Enable pgcrypto Extension

The migration automatically enables pgcrypto:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Row Level Security

RLS policies allow service role full access:

```sql
-- Service role has full access
CREATE POLICY "Service role full access on oauth_clients"
ON plugin_oauth_clients FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
```

---

## Testing

### Vault Service Tests

```bash
npm test -- vault.service.spec
```

Tests cover:
- Encryption/decryption roundtrip
- Unique ciphertext for same plaintext
- Special characters and unicode
- Object encryption/decryption
- Hash consistency
- Random generation uniqueness
- Invalid format detection

### Manual OAuth Flow Test

1. Create OAuth app with Notion
2. Submit plugin and credentials
3. Start flow: `GET /api/v1/oauth/notion/start?user_id=test&plugin_id={plugin}`
4. Open `authorization_url` in browser
5. Authorize with Notion
6. Check redirect to `synapse://oauth/success`
7. Verify token in `plugin_oauth_tokens` table
8. Test proxy: `GET /api/v1/proxy/notion/users/me`

---

## Troubleshooting

### Common Issues

#### 1. "VAULT_ENCRYPTION_KEY is required"

**Solution**: Generate and set the environment variable:
```bash
openssl rand -base64 32
# Add to .env: VAULT_ENCRYPTION_KEY=<output>
```

#### 2. "No OAuth credentials found for plugin"

**Solution**: Developer must submit credentials via:
```bash
POST /api/v1/dev/plugins/oauth/credentials
```

#### 3. Token expired error from proxy

**Solution**: Refresh token via:
```bash
POST /api/v1/oauth/{provider}/refresh
```

#### 4. Invalid state in callback

**Solution**: Session may have expired (>10 minutes). Restart OAuth flow.

#### 5. Provider returns "invalid_grant"

**Solution**: Authorization code already used or expired. Restart OAuth flow.

---

## File Reference

### Vault Module

| File | Purpose |
|------|---------|
| `src/vault/vault.module.ts` | Global module definition |
| `src/vault/vault.service.ts` | AES-256-GCM encryption |
| `src/vault/vault.service.spec.ts` | Unit tests |

### OAuth Module

| File | Purpose |
|------|---------|
| `src/oauth/oauth.module.ts` | Module definition |
| `src/oauth/oauth.service.ts` | Core OAuth logic |
| `src/oauth/oauth.controller.ts` | HTTP endpoints |
| `src/oauth/oauth-proxy.service.ts` | Proxy API service |
| `src/oauth/oauth-proxy.controller.ts` | Proxy endpoints |
| `src/oauth/oauth-provider.config.ts` | Provider configurations |
| `src/oauth/oauth-clients.repository.ts` | Client credentials storage |
| `src/oauth/oauth-tokens.repository.ts` | Token storage |
| `src/oauth/oauth-sessions.repository.ts` | Session storage |
| `src/oauth/oauth-audit.repository.ts` | Audit logging |

### Entities & Enums

| File | Purpose |
|------|---------|
| `src/common/entities/oauth.entity.ts` | TypeScript interfaces |
| `src/common/enums/oauth-provider.enum.ts` | Provider enums & constants |

### Developer Module (Extended)

| File | Changes |
|------|---------|
| `src/developer/developer.controller.ts` | Added OAuth credential endpoints |
| `src/developer/developer.service.ts` | Added OAuth credential methods |
| `src/developer/developer.module.ts` | Imports OAuthModule |

### Database

| File | Purpose |
|------|---------|
| `supabase/migrations/002_oauth_system.sql` | Database schema |

### Documentation

| File | Purpose |
|------|---------|
| `docs/OAUTH_MANIFEST_SCHEMA.md` | Plugin manifest auth schema |
| `docs/OAUTH_SYSTEM_DOCUMENTATION.md` | This file |

---

## Summary

The OAuth Broker System provides:

1. **Secure Storage**: AES-256-GCM encryption for all OAuth credentials and tokens
2. **Complete OAuth Flow**: PKCE-enabled authorization with token exchange
3. **Proxy API**: Backend makes authenticated requests, tokens never exposed
4. **Multi-Provider**: 11+ providers supported out of the box
5. **Developer Portal**: API for submitting OAuth credentials
6. **Audit Trail**: Complete logging of all OAuth operations
7. **Token Management**: Automatic refresh and revocation support

All sensitive data is stored in Supabase PostgreSQL, encrypted at rest, and only accessible via service role operations.
