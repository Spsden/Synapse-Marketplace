import { importOfficialMcpServer } from './official-mcp-server-importer';

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
        tools: ['notion-get-self', 'notion-create-pages'],
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
      tools: ['notion-get-self', 'notion-create-pages'],
    });
  });

  it('imports an npm stdio package and maps required auth environment', () => {
    const imported = importOfficialMcpServer(
      {
        name: 'io.github.example/spotify',
        title: 'Spotify MCP',
        description: 'Control Spotify',
        version: '0.4.0',
        packages: [
          {
            registryType: 'npm',
            identifier: '@example/spotify-mcp',
            version: '0.4.0',
            transport: { type: 'stdio' },
            environmentVariables: [
              {
                name: 'SPOTIFY_ACCESS_TOKEN',
                isRequired: true,
                isSecret: true,
              },
            ],
          },
        ],
      },
      {
        serverId: 'spotify',
        tools: ['spotify-search', 'spotify-play'],
        createdBy: 'developer@example.com',
        maintainerName: 'Example',
        authProfiles: [
          {
            id: 'spotify-token',
            type: 'oauth2-user',
            provider: 'spotify',
            delivery: 'environment',
            config: {
              environmentVariables: ['SPOTIFY_ACCESS_TOKEN'],
            },
          },
        ],
      },
    );

    expect(imported.artifacts).toEqual([
      expect.objectContaining({
        runtime: 'node',
        source: expect.objectContaining({
          packageName: '@example/spotify-mcp',
          version: '0.4.0',
        }),
      }),
    ]);
    expect(imported.deployments).toEqual([
      expect.objectContaining({
        kind: 'node-stdio',
        authProfileId: 'spotify-token',
      }),
    ]);
  });

  it('rejects Python-only official packages', () => {
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
    ).toThrow('no supported remote or npm stdio deployment');
  });

  it('rejects secret values embedded in the review overlay', () => {
    expect(() =>
      importOfficialMcpServer(
        {
          name: 'io.github.example/private',
          description: 'Private MCP',
          version: '1.0.0',
          packages: [
            {
              registryType: 'npm',
              identifier: '@example/private-mcp',
              version: '1.0.0',
              transport: { type: 'stdio' },
              environmentVariables: [
                {
                  name: 'PRIVATE_API_KEY',
                  isRequired: true,
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
          packageInputs: {
            PRIVATE_API_KEY: 'must-not-enter-the-registry',
          },
        },
      ),
    ).toThrow('cannot be supplied through overlay.packageInputs');
  });
});
