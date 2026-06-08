# Desktop MCP End-to-End

This runbook covers the full desktop MCP path across the three Synapse repos:

1. `/Users/pratap/code/Synapse-Marketplace`
2. `/Users/pratap/code/synapse`
3. `/Users/pratap/code/synapse-mcp-plane`

It includes:

1. automated checks that we can rerun in CI or locally
2. a desktop runtime smoke test
3. an app-level Dart to Node MCP end-to-end test
4. a manual Notion plugin flow for real desktop verification

## What is covered

The current desktop validation path proves:

1. `synapse` can launch the local Node MCP runtime through `DesktopMcpRuntimeController`
2. `McpService` can call the local `/call` endpoint
3. the TypeScript MCP runtime can spawn a real MCP server over stdio
4. responses flow back into Dart using the same contract the app uses

The automated test uses the fixture registry in `synapse-mcp-plane/examples/registry.sample.json`, which points `serverName: "notion"` at the local echo MCP fixture.

The manual Notion flow uses `synapse-mcp-plane/dev/registry.desktop.json`, which points `serverName: "notion"` at the real `@synapse/mcp-notion-server`.

## Prerequisites

1. Node.js 20+
2. Flutter installed and working for your desktop target
3. The three repos present at:
   - `/Users/pratap/code/Synapse-Marketplace`
   - `/Users/pratap/code/synapse`
   - `/Users/pratap/code/synapse-mcp-plane`

## Plugin artifact

The packaged desktop test plugin is:

`/Users/pratap/code/Synapse-Marketplace/com.notion.add-1.0.1.synx`

Source files live in:

`/Users/pratap/code/Synapse-Marketplace/notion_mcp_plugin`

## Optional Synapse desktop env overrides

If the app cannot auto-discover the MCP runtime repo, set these in `synapse/.env`:

```env
MCP_RUNTIME_WORKDIR=/Users/pratap/code/synapse-mcp-plane
MCP_RUNTIME_NODE_BINARY=node
MCP_RUNTIME_RUNNER_PATH=/Users/pratap/code/synapse-mcp-plane/dev/desktop-runtime-runner.mjs
MCP_RUNTIME_REGISTRY_PATH=/Users/pratap/code/synapse-mcp-plane/dev/registry.desktop.json
MCP_MANAGER_HOST=127.0.0.1
MCP_MANAGER_PORT=4777
```

For the automated Dart end-to-end test, the test itself injects these values and does not require editing `.env`.

## 1. Build and verify the TS MCP plane

From `/Users/pratap/code/synapse-mcp-plane`:

```bash
npm install
npm run typecheck
npm run test
npm run build
```

Expected result:

1. typecheck passes
2. Vitest passes
3. TypeScript build succeeds

## 2. Runtime smoke test

From `/Users/pratap/code/synapse-mcp-plane`:

```bash
./examples/smoke-test.sh
```

This starts the local MCP runtime with the fixture registry and calls `/call`.

Expected result:

```json
{
  "success": true,
  "data": {
    "id": "page_smoke_test",
    "title": "Weekly Notes",
    "source": "echo-mcp-server"
  }
}
```

## 3. App-level Dart end-to-end test

This is the strongest automated desktop verification right now.

From `/Users/pratap/code/synapse`:

```bash
flutter test test/services/mcp/desktop_mcp_e2e_test.dart
```

What it validates:

1. `DesktopMcpRuntimeController` starts the local Node runtime
2. `McpService` posts to the runtime over loopback HTTP
3. the runtime spawns the MCP fixture server over stdio
4. the response returns successfully to Dart

Expected result:

```text
00:00 +1: All tests passed!
```

## 4. Manual runtime health check

From `/Users/pratap/code/synapse-mcp-plane`:

```bash
MCP_MANAGER_PORT=4777 node ./dev/desktop-runtime-runner.mjs
```

In another terminal:

```bash
curl -sS http://127.0.0.1:4777/health | jq .
```

Expected result:

```json
{
  "ok": true,
  "service": "@synapse/mcp-node-runtime"
}
```

## 5. Manual real Notion runtime call

The dev runtime defaults to `dev/registry.desktop.json`, which launches the real `@synapse/mcp-notion-server`.

If you already have a Notion access token, you can validate the runtime directly without the app:

```bash
curl -sS -X POST http://127.0.0.1:4777/call \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "pluginId": "com.notion.add",
    "serverName": "notion",
    "toolName": "notion-get-self",
    "arguments": {},
    "platform": "desktop",
    "declaredServers": [
      {
        "name": "notion",
        "tools": ["notion-get-self"]
      }
    ],
    "authContext": {
      "provider": "notion",
      "accessToken": "'"$NOTION_ACCESS_TOKEN"'"
    }
  }' | jq .
```

Expected result with a valid token:

1. `success: true`
2. `data.user` contains the current Notion identity
3. `data.source` is `notion-api`

Expected result with a fake token:

1. `success: false`
2. `code: "EXECUTION_ERROR"`
3. error text similar to `API token is invalid. (unauthorized, HTTP 401)`

## 6. Manual Synapse desktop plugin flow

This is the full product-facing desktop path.

### 6.1 Build the runtime first

From `/Users/pratap/code/synapse-mcp-plane`:

```bash
npm run build
```

### 6.2 Run the Synapse desktop app

From `/Users/pratap/code/synapse`:

```bash
flutter run -d macos
```

Use your desktop target if it is not macOS.

### 6.3 Install the packaged plugin

Install:

`/Users/pratap/code/Synapse-Marketplace/com.notion.add-1.0.1.synx`

### 6.4 Authenticate Notion

The plugin uses Synapse OAuth for provider `notion`.

### 6.5 Trigger the plugin

Use the trigger:

`add_to_notion_mcp`

Provide input such as:

```json
{
  "title": "Weekly Notes",
  "content": "Captured from Synapse desktop E2E test."
}
```

Expected product behavior:

1. the desktop header shows the MCP runtime as starting, then ready
2. Synapse performs the Notion connectivity check
3. the plugin calls `synapse.mcp.callTool("notion", ...)`
4. a Notion page is created
5. the plugin returns `Added to Notion via MCP`

## Troubleshooting

### `MCP service not configured`

This means the Synapse app did not receive a live `McpService` instance. Recheck the desktop app wiring in `synapse`.

### `MCP runtime runner not found`

Set `MCP_RUNTIME_WORKDIR` or `MCP_RUNTIME_RUNNER_PATH` in `synapse/.env`.

### `MCP runtime registry not found`

Set `MCP_RUNTIME_REGISTRY_PATH` in `synapse/.env`.

### `Timed out waiting for local MCP runtime health`

Usually one of:

1. `synapse-mcp-plane` was not built
2. Node is not installed or not available at `MCP_RUNTIME_NODE_BINARY`
3. the chosen port is already in use

### Notion returns 401

The runtime is working, but the Notion token is invalid or missing.

## Verified commands

These were rerun successfully while writing this doc:

1. `npm run typecheck`
2. `npm run test`
3. `npm run build`
4. `./examples/smoke-test.sh`
5. `flutter test test/services/mcp/desktop_mcp_e2e_test.dart`
