import { importOfficialMcpServer } from './official-mcp-server-importer';
import { PluginStoreException } from '../common/exceptions';

describe('importOfficialMcpServer', () => {
  it('imports an official hosted server with Synapse auth and tool policy', () => {
    const imported = importOfficialMcpServer(
      {
        $schema:
          'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
        name: 'com.notion/notion',
        title: 'Notion MCP',
        description: 'Official Notion MCP server',
        version: '1.0.0',
        websiteUrl:
          'https://developers.notion.com/guides/mcp/get-started-with-mcp',
        remotes: [
          {
            type: 'streamable-http',
            url: 'https://mcp.notion.com/mcp',
          },
        ],
      },
      {
        serverId: 'notion',
        tools: ['notion-create-pages'],
        createdBy: 'synapse-system',
        maintainerName: 'Notion',
        maintainerKind: 'official',
        trustLevel: 'official',
        authProfiles: [
          {
            id: 'notion-oauth',
            type: 'mcp-oauth',
            provider: 'notion',
            delivery: 'authorization-header',
          },
        ],
      },
    );

    expect(imported.deployments).toEqual([
      expect.objectContaining({
        kind: 'remote-http',
        url: 'https://mcp.notion.com/mcp',
        authProfileId: 'notion-oauth',
      }),
    ]);
    expect(imported.upstreamHash).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(imported.capabilityCatalog).toEqual({
      tools: ['notion-create-pages'],
    });
  });

  it('rejects an official server that only ships local packages', () => {
    expect(() =>
      importOfficialMcpServer(
        {
          name: 'io.github.example/python',
          description: 'Python MCP',
          version: '1.0.0',
          packages: [
            {
              registryType: 'pypi',
              identifier: 'python-mcp',
              version: '1.0.0',
              transport: { type: 'stdio' },
            },
          ],
        },
        {
          serverId: 'python-mcp',
          tools: ['python-tool'],
          createdBy: 'developer@example.com',
          maintainerName: 'Example',
        },
      ),
    ).toThrow(PluginStoreException);
  });

  it('rejects a secret remote URL variable', () => {
    expect(() =>
      importOfficialMcpServer(
        {
          name: 'io.github.example/private',
          description: 'Private MCP',
          version: '1.0.0',
          remotes: [
            {
              type: 'streamable-http',
              url: 'https://mcp.example.com/{token}/mcp',
              variables: { token: { isSecret: true } },
            },
          ],
        },
        {
          serverId: 'private-mcp',
          tools: ['private-tool'],
          createdBy: 'developer@example.com',
          maintainerName: 'Example',
          remoteVariables: { token: 'must-not-enter-the-registry' },
        },
      ),
    ).toThrow(/Secret remote URL variable/);
  });

  it('rejects a secret header value', () => {
    expect(() =>
      importOfficialMcpServer(
        {
          name: 'io.github.example/private',
          description: 'Private MCP',
          version: '1.0.0',
          remotes: [
            {
              type: 'streamable-http',
              url: 'https://mcp.example.com/mcp',
              headers: [
                {
                  name: 'Authorization',
                  value: 'Bearer must-not-enter-the-registry',
                  isSecret: true,
                },
              ],
            },
          ],
        },
        {
          serverId: 'private-mcp',
          tools: ['private-tool'],
          createdBy: 'developer@example.com',
          maintainerName: 'Example',
        },
      ),
    ).toThrow(/Secret header/);
  });
});
