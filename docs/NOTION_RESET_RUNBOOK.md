# Notion Clean Reset Runbook

Canonical identities:

- Plugin package: `com.synapse.notion@1.0.2`
- MCP registry server: `notion`
- OAuth provider metadata row: `notion`

The OAuth credential metadata row must not be deleted. Migration
`006_oauth_package_identity.sql` removes the plugin foreign-key coupling and
re-keys credentials by `package_id`.

Admin and developer curl requests require:

```bash
-H "Authorization: Bearer $SYNAPSE_MARKETPLACE_TOKEN"
```

## Order of operations

1. Apply Marketplace migrations `005_mcp_registry_v2.sql` and
   `006_oauth_package_identity.sql`.
2. Record the existing Notion OAuth row and verify its client ID is present.
3. Delete old plugin packages such as `com.notion.add` and
   `com.notion.mcp.add` through the admin API.
4. Verify plugin/version/storage rows are gone and the Notion OAuth row remains.
5. Build and validate `Synapse-SDK/plugins/notion`.
6. Upload `com.synapse.notion-1.0.2.synx` with multipart `packageId` set to
   `com.synapse.notion`.
7. Review and publish the uploaded plugin version.
8. Submit `docs/examples/notion-mcp-registry-v2.json`.
9. Approve the MCP registry submission.
10. Fetch `/api/v1/mcp/registry` and verify the published v2 entry.
11. Install the plugin in a clean Synapse profile and complete MCP OAuth.
12. Run `notion-get-self`, then create a disposable page with
    `notion-create-pages`.
13. Disconnect and reconnect to verify grant revocation and token refresh.
14. Repeat on desktop and one mobile target.

## Required checks

- Multipart `packageId` equals `manifest.id`.
- The package content hash validates after download.
- Only `notion-get-self` and `notion-create-pages` are available to the plugin.
- The app never sends a raw OAuth token to a remote Synapse cloud endpoint.
- Registry cache fallback works when Marketplace is temporarily unavailable.
- No Python runtime or artifact is accepted.
