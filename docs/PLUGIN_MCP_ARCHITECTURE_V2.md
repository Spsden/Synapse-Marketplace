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

## MCP deployment strategy

Synapse serves **provider-hosted remote MCP servers only**. Every registry entry
describes an HTTPS remote reached by the runtime over Streamable HTTP, with SSE
retained as a compatibility transport. There is no local execution path: no npm
packages, no Python runtimes, no stdio entrypoints, no desktop developer
commands, and no Synapse-hosted Node workers.

### Provider-hosted remote

Use a `remote-http` deployment for an official hosted server such as Notion. The
deployment carries the remote URL, the transport, the platforms it is available
on, and an optional named auth profile. Authentication uses a named `mcp-oauth`
profile delivered through the authorization header, or MCP protocol-level
negotiation.

Because nothing is executed locally, an entry has no artifacts and no
certification step. The reviewed artifact is the reviewed remote URL plus the
exact tool catalog a plugin may call.

## Authentication

Plugin manifests declare named connections. Credentials live in the user
connection vault, while each plugin receives a revocable grant. Because MCP
servers are provider-hosted, credentials are never handed to a local process:
the runtime resolves the grant and attaches it to outbound requests to the
provider's endpoint.

MCP OAuth is distinct from a provider's normal API OAuth integration. Hosted
MCP servers may require RFC 9470 discovery, RFC 8414 metadata, dynamic client
registration, PKCE, and refresh-token rotation.

## Manifest contract

Synapse accepts manifest v2 packages only. Runtime trigger, input-schema, and
MCP allowlist views are derived from action contracts; legacy top-level
`triggers`, `inputSchema`, `auth`, and `mcpServers` fields are rejected.
