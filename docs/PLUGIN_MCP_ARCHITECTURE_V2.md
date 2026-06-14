# Plugin and MCP Architecture v2

## Ownership boundaries

Synapse plugins and MCP servers are separate reviewed artifacts:

- A plugin package owns actions, triggers, input/output schemas, connection
  aliases, and the exact MCP capabilities it may use.
- The Marketplace MCP registry owns server provenance, authentication profile,
  installation artifacts, transports, runtime targets, and platform support.
- The runtime joins the two documents by `serverId` and enforces the
  intersection of the plugin allowlist and the registry capability catalog.

This keeps a plugin usable for MCP and non-MCP actions without embedding
deployment details in plugin JavaScript.

## MCP deployment strategies

### Provider-hosted remote

Use a `remote-http` deployment for an official hosted server such as Notion.
Prefer Streamable HTTP and retain SSE only as a compatibility deployment.
Authentication uses a named `mcp-oauth` profile.

### Reviewed npm package

Use a Node artifact with an exact npm package and version, plus a
`node-stdio` deployment for desktop. The review pipeline must resolve and
store an immutable digest before publication.

### Pinned GitHub source

Use a Node artifact pinned to a commit SHA. Marketplace builds the artifact
once, records its digest, and publishes only the reviewed result. Runtime
cloning of a moving branch is not allowed.

### Synapse cloud Node

Use a `synapse-cloud-node` deployment only after explicit cloud
certification. Certification records resource limits, network policy,
secret-delivery policy, health checks, and the reviewed artifact digest.
This is the mobile execution path for Node-only servers that have no remote
provider endpoint.

### Developer command

Desktop developer mode may run an unreviewed local command. Developer commands
never enter the public Marketplace registry and are never available on mobile.

## Authentication

Plugin manifests declare named connections. Credentials live in the user
connection vault, while each plugin receives a revocable grant. Desktop
loopback execution may receive an access token from the local host. Cloud
execution receives only an opaque grant ID and resolves it through the cloud
credential broker.

MCP OAuth is distinct from a provider's normal API OAuth integration. Hosted
MCP servers may require RFC 9470 discovery, RFC 8414 metadata, dynamic client
registration, PKCE, and refresh-token rotation.

## Compatibility

Manifest v1 remains readable. The host derives legacy `triggers`,
`inputSchema`, and `mcpServers` views from manifest v2 actions until all app
surfaces consume action contracts directly.
