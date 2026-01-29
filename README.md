# Synapse Plugin Store - NestJS + Supabase

A production-ready, enterprise-grade plugin marketplace API for the Synapse Second Mind application. Built with NestJS and TypeScript, using Supabase for database and storage.

## Features

- **Plugin Marketplace**: Browse, search, and discover published plugins
- **Version Management**: Semantic versioning with compatibility checking
- **Developer Submission**: Upload .synx packages via multipart form upload
- **Admin Review Workflow**: Approve/reject plugins with automated safety checks
- **Supabase Integration**: PostgreSQL database + CDN-backed storage
- **Signed URLs**: Secure, time-limited download URLs
- **Type Safety**: Full TypeScript implementation with strong typing
- **API Documentation**: Auto-generated OpenAPI/Swagger docs

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                        │
│  Mobile App  │  Web Admin  │  Developer Portal  │  CLI  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   NESTJS API GATEWAY                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │   Store  │  │ Developer│  │        Admin         │  │
│  │Controller│  │Controller│  │    Controller        │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
│       └─────────────┼─────────────────────┘             │
│                     ▼                                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Business Logic Layer                  │ │
│  │  PluginService │ PluginReviewService │ StorageSvc  │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                    SUPABASE LAYER                        │
│  ┌────────────────────┐  ┌──────────────────────────┐  │
│  │  PostgreSQL DB     │  │   Supabase Storage       │  │
│  │  - plugins         │  │   - plugins bucket       │  │
│  │  - plugin_versions │  │   - icons bucket         │  │
│  │  - analytics       │  │   - temp-uploads bucket  │  │
│  └────────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

### Table: plugins
```sql
CREATE TABLE plugins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id          VARCHAR(255) NOT NULL UNIQUE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    author              VARCHAR(255) NOT NULL,
    icon_key            VARCHAR(500),
    status              VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    latest_version_id   UUID REFERENCES plugin_versions(id),
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
```

### Table: plugin_versions
```sql
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
    status              VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    rejection_reason    TEXT,
    reviewed_by         VARCHAR(255),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at         TIMESTAMP WITH TIME ZONE,
    published_at        TIMESTAMP WITH TIME ZONE,
    download_count      BIGINT DEFAULT 0,
    is_flagged          BOOLEAN DEFAULT FALSE,
    flag_reason         TEXT,
    UNIQUE(plugin_id, version)
);
```

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your Supabase credentials
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Running the Application

```bash
# Development mode
npm run start:dev

# Production build
npm run build
npm run start:prod
```

## API Documentation

Once running, access the Swagger documentation at:
```
http://localhost:3000/api-docs
```

## API Endpoints

### Public Store APIs (`/api/v1/store`)
- `GET /store/plugins` - List published plugins (with pagination, search, filters)
- `GET /store/plugins/:packageId` - Get plugin by package ID
- `GET /store/plugins/:packageId/versions` - Get all plugin versions
- `GET /store/versions/:versionId` - Get version details
- `GET /store/plugins/:packageId/statistics` - Get plugin statistics

### Developer APIs (`/api/v1/dev`)
- `POST /dev/plugins/submit` - Submit a .synx plugin package

### Admin APIs (`/api/v1/admin`)
- `GET /admin/review-queue` - Get pending review items
- `PATCH /admin/plugins/:versionId/verify` - Approve/reject a version
- `POST /admin/plugins/:versionId/flag` - Flag a plugin for security
- `DELETE /admin/plugins/:versionId/flag` - Unflag a plugin

## .synx Package Format

A `.synx` file is a ZIP archive containing:

```
plugin.synx
├── manifest.json          (Required) - Plugin metadata
├── plugin.js              (Required) - Main JavaScript code
├── icon.png               (Optional) - 256x256px icon
├── README.md              (Optional) - Documentation
└── LICENSE                (Optional) - License file
```

### manifest.json Schema
```json
{
  "name": "Task Manager",
  "description": "Manage your tasks with AI",
  "version": "1.0.0",
  "minAppVersion": "1.0.0",
  "author": {
    "name": "Synapse Team",
    "email": "dev@synapse.com"
  },
  "entryPoint": "plugin.js",
  "icon": "icon.png",
  "permissions": [
    "storage:read",
    "network:https://api.example.com"
  ],
  "capabilities": {
    "transientStorage": true,
    "persistentStorage": false
  },
  "triggers": {
    "voiceIntents": ["create_task", "list_tasks"],
    "screenshotIntents": ["analyze_screenshot"]
  }
}
```

## Project Structure

```
src/
├── admin/              # Admin review module
│   ├── admin.controller.ts
│   └── admin.module.ts
├── common/             # Shared resources
│   ├── dto/           # Data transfer objects
│   ├── entities/      # Entity interfaces
│   ├── enums/         # Enumerations
│   └── exceptions/    # Custom exceptions
├── config/            # Configuration
│   ├── app.config.ts
│   ├── config.module.ts
│   └── supabase.config.ts
├── developer/         # Developer module
│   ├── developer.controller.ts
│   ├── developer.module.ts
│   └── developer.service.ts
├── plugins/           # Core plugin module
│   ├── plugin-versions.repository.ts
│   ├── plugins.controller.ts
│   ├── plugins.module.ts
│   ├── plugins.repository.ts
│   ├── plugins.service.ts
│   └── plugin-review.service.ts
├── storage/           # Supabase storage module
│   ├── storage.module.ts
│   ├── storage.service.ts
│   ├── supabase-storage.service.ts
│   └── synx-package.service.ts
├── app.module.ts
└── main.ts
```

## License

ISC
