# Official MCP Server Import

Synapse is a downstream MCP registry. It preserves upstream `server.json`
metadata, then applies a Synapse review overlay for policy that the upstream
document does not define:

- stable `serverId`
- exact plugin-visible tool catalog
- auth profiles and credential delivery
- supported Synapse platforms
- trust level and maintainer identity
- optional cloud artifact certification

Submit an import with:

```http
POST /api/v1/dev/mcp/servers/import-official
Authorization: Bearer $SYNAPSE_MARKETPLACE_TOKEN
Content-Type: application/json
```

The body contains `server`, the official MCP Registry document, and `overlay`,
the Synapse policy. See
[`examples/official-notion-import.json`](examples/official-notion-import.json).

The importer currently supports:

- Streamable HTTP and SSE remotes over HTTPS

It deliberately rejects:

- any upstream server that declares no HTTPS remote, including PyPI, `uvx`,
  npm, and other local execution packages
- arbitrary shell commands
- secret values supplied directly in a URL, header, or remote variable
- non-HTTPS remote transports

The result enters the normal review queue. Importing never publishes directly;
an admin must approve the generated schema v2 submission.

The upstream document and its SHA-256 digest are stored on the submission so a
future refresh can be diffed against the reviewed version.
