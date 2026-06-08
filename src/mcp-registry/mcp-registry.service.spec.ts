import { Test, TestingModule } from '@nestjs/testing';
import {
  McpRegistryChangeType,
  McpRegistryReviewDecision,
  McpRegistrySubmissionStatus,
} from '../common/enums/mcp-registry-submission-status.enum';
import {
  McpRegistryEntry,
  McpRegistrySubmission,
} from '../common/entities/mcp-registry.entity';
import { McpRegistryEntriesRepository } from './mcp-registry-entries.repository';
import { McpRegistryService } from './mcp-registry.service';
import { McpRegistrySubmissionsRepository } from './mcp-registry-submissions.repository';

describe('McpRegistryService', () => {
  let service: McpRegistryService;
  let entriesRepository: jest.Mocked<McpRegistryEntriesRepository>;
  let submissionsRepository: jest.Mocked<McpRegistrySubmissionsRepository>;

  const publishedEntry: McpRegistryEntry = {
    id: 'entry-1',
    serverId: 'notion',
    displayName: 'Notion MCP',
    description: 'Official Notion MCP server',
    currentVersion: '1.0.0',
    maintainerName: 'Notion',
    maintainerKind: 'official',
    trustLevel: 'official',
    documentationUrl: 'https://developers.notion.com/docs/get-started-with-mcp',
    source: { type: 'remote-http', url: 'https://mcp.notion.com/mcp' },
    auth: { type: 'oauth2-user', provider: 'notion' },
    tools: ['notion-get-self'],
    runtimeTargets: ['desktop-node', 'cloud-worker'],
    platforms: ['macos', 'windows', 'linux', 'android', 'ios'],
    desktop: { transport: 'http' },
    cloud: { transport: 'http' },
    capabilities: { oauth: true },
    createdBy: 'seed@synapse.dev',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    publishedAt: new Date('2026-06-01T00:00:00.000Z'),
  };

  const submission: McpRegistrySubmission = {
    id: 'submission-1',
    serverId: 'notion',
    targetEntryId: 'entry-1',
    changeType: McpRegistryChangeType.UPDATE,
    displayName: 'Notion MCP',
    description: 'Official Notion MCP server',
    currentVersion: '1.1.0',
    maintainerName: 'Notion',
    maintainerKind: 'official',
    trustLevel: 'official',
    documentationUrl: 'https://developers.notion.com/docs/get-started-with-mcp',
    source: { type: 'remote-http', url: 'https://mcp.notion.com/mcp' },
    auth: { type: 'oauth2-user', provider: 'notion' },
    tools: ['notion-get-self', 'notion-create-pages'],
    runtimeTargets: ['desktop-node', 'cloud-worker'],
    platforms: ['macos', 'windows', 'linux', 'android', 'ios'],
    desktop: { transport: 'http' },
    cloud: { transport: 'http' },
    capabilities: { oauth: true },
    submissionNotes: 'Add page creation support',
    createdBy: 'developer@example.com',
    status: McpRegistrySubmissionStatus.SUBMITTED,
    reviewedBy: null,
    reviewNotes: null,
    createdAt: new Date('2026-06-07T00:00:00.000Z'),
    updatedAt: new Date('2026-06-07T00:00:00.000Z'),
    reviewedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpRegistryService,
        {
          provide: McpRegistryEntriesRepository,
          useValue: {
            findById: jest.fn(),
            findByServerId: jest.fn(),
            listPublished: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: McpRegistrySubmissionsRepository,
          useValue: {
            findById: jest.fn(),
            findOpenByServerId: jest.fn(),
            findInReviewQueue: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(McpRegistryService);
    entriesRepository = module.get(McpRegistryEntriesRepository);
    submissionsRepository = module.get(McpRegistrySubmissionsRepository);
  });

  it('builds a published snapshot from registry entries', async () => {
    entriesRepository.listPublished.mockResolvedValue([publishedEntry]);

    const snapshot = await service.getPublishedRegistrySnapshot();

    expect(snapshot.version).toBe('1');
    expect(snapshot.servers).toHaveLength(1);
    expect(snapshot.servers[0].serverId).toBe('notion');
  });

  it('creates an update submission when the server already exists', async () => {
    entriesRepository.findByServerId.mockResolvedValue(publishedEntry);
    submissionsRepository.findOpenByServerId.mockResolvedValue(null);
    submissionsRepository.create.mockResolvedValue(submission);

    const result = await service.submitServerDefinition({
      serverId: 'notion',
      displayName: 'Notion MCP',
      description: 'Official Notion MCP server',
      currentVersion: '1.1.0',
      maintainerName: 'Notion',
      maintainerKind: 'official',
      trustLevel: 'official',
      documentationUrl: 'https://developers.notion.com/docs/get-started-with-mcp',
      source: { type: 'remote-http', url: 'https://mcp.notion.com/mcp' },
      auth: { type: 'oauth2-user', provider: 'notion' },
      tools: ['notion-get-self', 'notion-create-pages'],
      runtimeTargets: ['desktop-node', 'cloud-worker'],
      platforms: ['macos', 'windows', 'linux', 'android', 'ios'],
      desktop: { transport: 'http' },
      cloud: { transport: 'http' },
      capabilities: { oauth: true },
      submissionNotes: 'Add page creation support',
      createdBy: 'developer@example.com',
    });

    expect(submissionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        serverId: 'notion',
        targetEntryId: 'entry-1',
        changeType: 'UPDATE',
      }),
    );
    expect(result.serverId).toBe('notion');
  });

  it('publishes an approved update submission into the entry table', async () => {
    submissionsRepository.findById.mockResolvedValue(submission);
    entriesRepository.update.mockResolvedValue({
      ...publishedEntry,
      currentVersion: '1.1.0',
      tools: ['notion-get-self', 'notion-create-pages'],
    });
    submissionsRepository.update.mockResolvedValue({
      ...submission,
      status: McpRegistrySubmissionStatus.APPROVED,
      reviewedBy: 'admin@synapse.dev',
      reviewNotes: 'Looks good',
      reviewedAt: new Date(),
    });

    await service.submitReviewDecision('submission-1', {
      decision: McpRegistryReviewDecision.PUBLISH,
      reviewedBy: 'admin@synapse.dev',
      reviewNotes: 'Looks good',
    });

    expect(entriesRepository.update).toHaveBeenCalledWith(
      'entry-1',
      expect.objectContaining({
        currentVersion: '1.1.0',
        updatedBy: 'admin@synapse.dev',
      }),
    );
    expect(submissionsRepository.update).toHaveBeenCalledWith(
      'submission-1',
      expect.objectContaining({
        status: McpRegistrySubmissionStatus.APPROVED,
        reviewedBy: 'admin@synapse.dev',
      }),
    );
  });
});
