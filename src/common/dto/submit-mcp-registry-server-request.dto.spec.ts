import { ValidationPipe } from '@nestjs/common';
import { SubmitMcpRegistryServerRequestDto } from './submit-mcp-registry-server-request.dto';

describe('SubmitMcpRegistryServerRequestDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('accepts schema v2 nested registry records through the global pipe', async () => {
    const value = await pipe.transform(
      {
        schemaVersion: 2,
        serverId: 'notion',
        displayName: 'Notion MCP',
        currentVersion: '1.0.0',
        maintainerName: 'Notion',
        maintainerKind: 'official',
        trustLevel: 'official',
        source: {
          type: 'remote-http',
          url: 'https://mcp.notion.com/mcp',
        },
        tools: ['notion-get-self', 'notion-create-pages'],
        runtimeTargets: ['provider-remote'],
        platforms: ['macos', 'windows', 'linux', 'android', 'ios'],
        authProfiles: [
          {
            id: 'notion-oauth',
            type: 'mcp-oauth',
            provider: 'notion',
            delivery: 'mcp-protocol',
          },
        ],
        deployments: [
          {
            id: 'notion-hosted',
            kind: 'remote-http',
            runtimeTarget: 'provider-remote',
            platforms: ['macos', 'windows', 'linux', 'android', 'ios'],
            authProfileId: 'notion-oauth',
            transport: 'streamable-http',
            url: 'https://mcp.notion.com/mcp',
          },
        ],
        createdBy: 'developer@example.com',
      },
      {
        type: 'body',
        metatype: SubmitMcpRegistryServerRequestDto,
      },
    );

    expect(value).toBeInstanceOf(SubmitMcpRegistryServerRequestDto);
    expect(value.authProfiles).toHaveLength(1);
    expect(value.deployments).toHaveLength(1);
  });
});
