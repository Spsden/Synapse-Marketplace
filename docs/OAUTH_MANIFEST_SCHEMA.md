# Plugin Manifest OAuth Schema

This document describes how plugins declare OAuth authentication requirements in their `manifest.json` file.

## Overview

Plugins that need to authenticate with external providers (Notion, Google, GitHub, etc.) should declare their OAuth requirements in the manifest. The actual OAuth credentials (client_id, client_secret) are submitted separately by the developer through the Developer Portal API.

## Manifest Schema

### OAuth Declaration

Add an `auth` field to your `manifest.json`:

```json
{
  "name": "My Notion Plugin",
  "version": "1.0.0",
  "auth": {
    "provider": "notion",
    "scopes": ["read", "write"]
  }
}
```

### Auth Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | Yes | OAuth provider name (see list below) |
| `scopes` | string[] | No | OAuth scopes to request (default scopes used if omitted) |

### Supported Providers

| Provider | Value | Default Scopes |
|----------|-------|---------------|
| Notion | `"notion"` | `[]` |
| Google | `"google"` | `["openid", "profile", "email"]` |
| GitHub | `"github"` | `["read:user", "user:email"]` |
| Slack | `"slack"` | `["chat:write", "channels:read"]` |
| Microsoft | `"microsoft"` | `["openid", "profile", "email"]` |
| Discord | `"discord"` | `["identify", "guilds"]` |
| Linear | `"linear"` | `["read", "write"]` |
| Figma | `"figma"` | `["file_read"]` |
| Salesforce | `"salesforce"` | `["api", "web", "full"]` |
| Dropbox | `"dropbox"` | `[]` |
| Stripe | `"stripe"` | `["read_only"]` |

## Complete Manifest Example

```json
{
  "name": "Notion Task Sync",
  "description": "Sync tasks between Notion and other apps",
  "version": "1.0.0",
  "author": "Developer Name",
  "minAppVersion": "1.0.0",

  "auth": {
    "provider": "notion",
    "scopes": []
  },

  "permissions": ["storage", "network"],

  "capabilities": {
    "actions": [
      {
        "id": "sync-tasks",
        "name": "Sync Tasks",
        "description": "Sync tasks with Notion database"
      }
    ]
  }
}
```

## Multiple Providers (Future)

Currently, each plugin can only authenticate with one provider. Multiple provider support may be added in the future:

```json
{
  "auth": [
    { "provider": "notion", "scopes": [] },
    { "provider": "google", "scopes": ["drive.readonly"] }
  ]
}
```

## Developer Submission Flow

1. **Developer creates OAuth app** with the external provider
   - Gets `client_id` and `client_secret`
   - Sets redirect URL to: `https://your-domain.com/api/v1/oauth/{provider}/callback`

2. **Developer submits plugin** with manifest containing `auth` field

3. **Developer submits OAuth credentials** via API:
   ```bash
   POST /api/v1/dev/plugins/oauth/credentials
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

4. **Users authenticate** when using the plugin
   - Host app opens OAuth flow
   - User authorizes with provider
   - Tokens stored securely
   - Plugin can make authenticated requests

## Host App Integration

The host app (Synapse) should:

1. Detect `auth` field in manifest
2. Check if user has valid token via: `GET /api/v1/oauth/{provider}/check?user_id={user}&plugin_id={plugin}`
3. Start OAuth flow if needed: `GET /api/v1/oauth/{provider}/start?user_id={user}&plugin_id={plugin}`
4. Open returned `authorization_url` in browser
5. Handle deep link redirect after successful auth

## Proxy API Usage

Once authenticated, plugins can make requests to provider APIs via the proxy:

```javascript
// From plugin code (conceptual)
const response = await fetch('/api/v1/proxy/notion/users/me', {
  headers: {
    'X-User-Id': userId,
    'X-Plugin-Id': pluginId
  }
});
```

The backend automatically injects the stored OAuth access token.
