import { createHash } from 'crypto';
import { HttpStatus } from '@nestjs/common';
import {
  McpAuthProfileRequestDto,
  McpDeploymentRequestDto,
  SubmitMcpRegistryServerRequestDto,
} from '../common/dto';
import { PluginStoreException } from '../common/exceptions';

interface OfficialInput {
  name?: string;
  value?: string;
  default?: string;
  valueHint?: string;
  isRequired?: boolean;
  isSecret?: boolean;
}

interface OfficialRemote {
  type?: string;
  url?: string;
  headers?: OfficialInput[];
  variables?: Record<string, OfficialInput>;
}

interface OfficialServerDocument {
  name?: string;
  title?: string;
  description?: string;
  version?: string;
  websiteUrl?: string;
  repository?: Record<string, unknown>;
  remotes?: OfficialRemote[];
}

interface SynapseImportOverlay {
  serverId?: string;
  tools?: string[];
  createdBy?: string;
  maintainerName?: string;
  maintainerKind?: string;
  trustLevel?: string;
  platforms?: string[];
  remoteUrl?: string;
  remoteVariables?: Record<string, string>;
  authProfiles?: McpAuthProfileRequestDto[];
  authProfileId?: string;
  submissionNotes?: string;
}

/**
 * Converts an official MCP registry `server.json` plus a Synapse overlay into a
 * schema v2 registry submission.
 *
 * Synapse only serves provider-hosted remote servers, so only HTTPS
 * `streamable-http` and `sse` remotes are imported. Anything that would require
 * local execution — npm packages, Python runtimes, shell commands, Synapse-hosted
 * Node workers — is rejected rather than translated.
 */
export function importOfficialMcpServer(
  rawServer: Record<string, unknown>,
  rawOverlay: Record<string, unknown>,
): SubmitMcpRegistryServerRequestDto {
  const server = rawServer as OfficialServerDocument;
  const overlay = rawOverlay as SynapseImportOverlay;
  const officialName = requiredString(server.name, 'server.name');
  const currentVersion = requiredString(server.version, 'server.version');
  const serverId = requiredString(overlay.serverId, 'overlay.serverId');
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(serverId)) {
    badRequest('overlay.serverId must be lowercase kebab-case');
  }
  const tools = requiredStringArray(overlay.tools, 'overlay.tools');
  const createdBy = requiredString(overlay.createdBy, 'overlay.createdBy');
  const maintainerName = requiredString(
    overlay.maintainerName,
    'overlay.maintainerName',
  );
  const maintainerKind = oneOf(
    overlay.maintainerKind ?? 'community',
    ['official', 'community', 'synapse'],
    'overlay.maintainerKind',
  );
  const trustLevel = oneOf(
    overlay.trustLevel ?? 'community-reviewed',
    ['official', 'community-reviewed', 'synapse-managed'],
    'overlay.trustLevel',
  );
  const platforms =
    overlay.platforms?.length
      ? requiredStringArray(overlay.platforms, 'overlay.platforms')
      : ['macos', 'windows', 'linux', 'ios', 'android'];
  const authProfiles = overlay.authProfiles ?? [];
  const authProfileId =
    overlay.authProfileId ??
    (authProfiles.length === 1 ? authProfiles[0]?.id : undefined);
  if (
    authProfileId &&
    !authProfiles.some((profile) => profile.id === authProfileId)
  ) {
    badRequest(
      `overlay.authProfileId references unknown auth profile "${authProfileId}"`,
    );
  }

  const deployments: McpDeploymentRequestDto[] = [];

  for (const [index, remote] of selectRemotes(server.remotes, overlay).entries()) {
    const transport = oneOf(
      remote.type,
      ['streamable-http', 'sse'],
      `server.remotes[${index}].type`,
    );
    const url = resolveRemoteUrl(
      requiredString(remote.url, `server.remotes[${index}].url`),
      remote.variables,
      overlay.remoteVariables ?? {},
    );
    deployments.push({
      id: `${serverId}-remote-${index + 1}`,
      kind: 'remote-http',
      runtimeTarget: 'provider-remote',
      platforms: [...platforms],
      priority: 10 + index,
      transport,
      url,
      ...(authProfileId ? { authProfileId } : {}),
      ...fixedRemoteHeaders(remote.headers),
    });
  }

  if (!deployments.length) {
    badRequest(
      'The official server declares no HTTPS streamable-http or sse remote. ' +
        'Synapse only supports provider-hosted remote MCP servers.',
    );
  }

  const runtimeTargets = Array.from(
    new Set(deployments.map((deployment) => deployment.runtimeTarget)),
  );
  const firstRemote = deployments[0];
  const firstAuthProfile = authProfiles[0];

  return {
    schemaVersion: 2,
    serverId,
    displayName: server.title ?? officialName,
    description: server.description,
    currentVersion,
    maintainerName,
    maintainerKind,
    trustLevel,
    documentationUrl: server.websiteUrl,
    source: {
      type: 'remote-http',
      url: firstRemote.url,
      transport: firstRemote.transport,
    },
    auth: firstAuthProfile
      ? {
          type: firstAuthProfile.type,
          provider: firstAuthProfile.provider,
        }
      : undefined,
    tools,
    runtimeTargets,
    platforms,
    authProfiles,
    deployments,
    capabilityCatalog: { tools: [...tools] },
    upstream: {
      registry: 'https://registry.modelcontextprotocol.io',
      format: 'server.json',
      document: rawServer,
      ...(server.repository ? { repository: server.repository } : {}),
    },
    upstreamHash: `sha256-${createHash('sha256')
      .update(JSON.stringify(rawServer))
      .digest('hex')}`,
    submissionNotes: overlay.submissionNotes,
    createdBy,
  };
}

function selectRemotes(
  remotes: OfficialRemote[] | undefined,
  overlay: SynapseImportOverlay,
): OfficialRemote[] {
  const supported = (remotes ?? []).filter(
    (remote) =>
      (remote.type === 'streamable-http' || remote.type === 'sse') &&
      typeof remote.url === 'string',
  );
  if (!overlay.remoteUrl) return supported;
  const selected = supported.filter((remote) => remote.url === overlay.remoteUrl);
  if (!selected.length) {
    badRequest(`overlay.remoteUrl "${overlay.remoteUrl}" was not found upstream.`);
  }
  return selected;
}

function resolveRemoteUrl(
  template: string,
  definitions: Record<string, OfficialInput> | undefined,
  values: Record<string, string>,
): string {
  const resolved = template.replace(/\{([^}]+)\}/g, (match, key: string) => {
    const definition = definitions?.[key];
    const value = values[key] ?? definition?.default;
    if (!value) {
      badRequest(`Remote URL variable "${key}" requires an overlay value.`);
    }
    if (definition?.isSecret) {
      badRequest(
        `Secret remote URL variable "${key}" cannot be stored in registry metadata.`,
      );
    }
    return encodeURIComponent(value);
  });
  try {
    const url = new URL(resolved);
    if (url.protocol !== 'https:') {
      badRequest('Imported remote MCP URLs must use HTTPS.');
    }
  } catch {
    badRequest(`Imported remote MCP URL "${resolved}" is invalid.`);
  }
  return resolved;
}

function fixedRemoteHeaders(
  headers: OfficialInput[] | undefined,
): Pick<McpDeploymentRequestDto, 'headers'> {
  const fixed: Record<string, string> = {};
  for (const header of headers ?? []) {
    if (header.isSecret && (header.value || header.default)) {
      badRequest(
        `Secret header "${header.name ?? 'unknown'}" cannot be stored in registry metadata.`,
      );
    }
    if (header.name && header.value) {
      fixed[header.name] = header.value;
    }
  }
  return Object.keys(fixed).length ? { headers: fixed } : {};
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    badRequest(`${path} is required.`);
  }
  return value;
}

function requiredStringArray(value: unknown, path: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    badRequest(`${path} must be a non-empty string array.`);
  }
  return [...value];
}

function oneOf<T extends string>(
  value: unknown,
  choices: readonly T[],
  path: string,
): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) {
    badRequest(`${path} must be one of: ${choices.join(', ')}.`);
  }
  return value as T;
}

function badRequest(message: string): never {
  throw new PluginStoreException(message, HttpStatus.BAD_REQUEST);
}
