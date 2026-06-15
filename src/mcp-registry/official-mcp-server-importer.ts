import { createHash } from 'crypto';
import { HttpStatus } from '@nestjs/common';
import {
  McpArtifactRequestDto,
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

interface OfficialArgument extends OfficialInput {
  type?: string;
}

interface OfficialPackage {
  registryType?: string;
  identifier?: string;
  version?: string;
  fileSha256?: string;
  runtimeHint?: string;
  runtimeArguments?: OfficialArgument[];
  packageArguments?: OfficialArgument[];
  environmentVariables?: OfficialInput[];
  transport?: { type?: string };
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
  packages?: OfficialPackage[];
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
  packageIdentifier?: string;
  remoteUrl?: string;
  remoteVariables?: Record<string, string>;
  packageInputs?: Record<string, string>;
  authProfiles?: McpAuthProfileRequestDto[];
  authProfileId?: string;
  artifactDigest?: string;
  cloudGatewayUrl?: string;
  cloudCertification?: Record<string, unknown>;
  submissionNotes?: string;
}

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

  const artifacts: McpArtifactRequestDto[] = [];
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

  const selectedPackage = selectNodePackage(server.packages, overlay);
  if (selectedPackage) {
    if (selectedPackage.runtimeArguments?.length) {
      badRequest(
        'Official npm packages with runtimeArguments are not supported yet; provide a reviewed Synapse deployment override.',
      );
    }
    const packageName = requiredString(
      selectedPackage.identifier,
      'server.packages[].identifier',
    );
    const packageVersion = requiredString(
      selectedPackage.version ?? currentVersion,
      'server.packages[].version',
    );
    const artifactId = `${serverId}-npm`;
    const digest = normalizeDigest(
      overlay.artifactDigest ?? selectedPackage.fileSha256,
    );
    const args = resolveArguments(
      selectedPackage.packageArguments,
      overlay.packageInputs ?? {},
    );
    const env = resolveEnvironment(
      selectedPackage.environmentVariables,
      overlay.packageInputs ?? {},
      authEnvironmentNames(authProfiles),
    );

    artifacts.push({
      id: artifactId,
      runtime: 'node',
      source: {
        type: 'npm',
        packageName,
        version: packageVersion,
        officialRegistryName: officialName,
      },
      entrypoint: packageName,
      ...(digest ? { digest } : {}),
    });

    const desktopPlatforms = platforms.filter((platform) =>
      ['macos', 'windows', 'linux'].includes(platform),
    );
    if (desktopPlatforms.length) {
      deployments.push({
        id: `${serverId}-desktop-node`,
        kind: 'node-stdio',
        runtimeTarget: 'desktop-node',
        platforms: desktopPlatforms,
        priority: 20,
        artifactId,
        install: {
          strategy: 'npm',
          packageName,
          version: packageVersion,
        },
        entrypoint: packageName,
        ...(args.length ? { args } : {}),
        ...(Object.keys(env).length ? { env } : {}),
        ...(authProfileId ? { authProfileId } : {}),
      });
    }

    if (overlay.cloudGatewayUrl || overlay.cloudCertification) {
      if (!digest) {
        badRequest(
          'Cloud Node import requires overlay.artifactDigest or package fileSha256.',
        );
      }
      if (overlay.cloudCertification?.status !== 'certified') {
        badRequest(
          'Cloud Node import requires overlay.cloudCertification.status to be "certified".',
        );
      }
      const certifiedDigest = overlay.cloudCertification.artifactDigest;
      if (certifiedDigest && certifiedDigest !== digest) {
        badRequest('Cloud certification digest does not match the artifact digest.');
      }
      const cloudPlatforms = platforms.filter((platform) =>
        ['ios', 'android', 'web', 'cloud'].includes(platform),
      );
      if (!cloudPlatforms.length) {
        badRequest('Cloud Node import requires at least one mobile/cloud platform.');
      }
      deployments.push({
        id: `${serverId}-cloud-node`,
        kind: 'synapse-cloud-node',
        runtimeTarget: 'synapse-cloud-node',
        platforms: cloudPlatforms,
        priority: 30,
        artifactId,
        entrypoint: packageName,
        ...(args.length ? { args } : {}),
        ...(Object.keys(env).length ? { env } : {}),
        ...(overlay.cloudGatewayUrl
          ? { gatewayUrl: overlay.cloudGatewayUrl }
          : {}),
        ...(authProfileId ? { authProfileId } : {}),
      });
    }
  }

  if (!deployments.length) {
    badRequest(
      'The official server has no supported remote or npm stdio deployment.',
    );
  }

  const runtimeTargets = Array.from(
    new Set(deployments.map((deployment) => deployment.runtimeTarget)),
  );
  const firstRemote = deployments.find(
    (deployment) => deployment.kind === 'remote-http',
  );
  const source = firstRemote
    ? {
        type: 'remote-http',
        url: firstRemote.url,
        transport: firstRemote.transport,
      }
    : {
        type: 'official-mcp-registry',
        name: officialName,
        package: selectedPackage?.identifier,
      };
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
    source,
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
    artifacts,
    deployments,
    capabilityCatalog: { tools: [...tools] },
    cloudCertification: overlay.cloudCertification,
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

function selectNodePackage(
  packages: OfficialPackage[] | undefined,
  overlay: SynapseImportOverlay,
): OfficialPackage | undefined {
  const nodePackages = (packages ?? []).filter(
    (item) =>
      item.registryType === 'npm' &&
      item.transport?.type === 'stdio' &&
      typeof item.identifier === 'string',
  );
  if (!overlay.packageIdentifier) return nodePackages[0];
  const selected = nodePackages.find(
    (item) => item.identifier === overlay.packageIdentifier,
  );
  if (!selected) {
    badRequest(
      `overlay.packageIdentifier "${overlay.packageIdentifier}" is not a supported npm stdio package.`,
    );
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

function resolveArguments(
  args: OfficialArgument[] | undefined,
  values: Record<string, string>,
): string[] {
  const resolved: string[] = [];
  for (const [index, argument] of (args ?? []).entries()) {
    const key = argument.valueHint ?? argument.name ?? String(index);
    if (argument.isSecret) {
      badRequest(
        `Secret package argument "${key}" is not supported; use an environment auth profile.`,
      );
    }
    const value = argument.value ?? values[key] ?? argument.default;
    if (!value && argument.isRequired !== false) {
      badRequest(`Package argument "${key}" requires overlay.packageInputs.`);
    }
    if (!value) continue;
    if (argument.type === 'named' && argument.name) {
      resolved.push(`${argument.name}=${value}`);
    } else {
      resolved.push(value);
    }
  }
  return resolved;
}

function resolveEnvironment(
  inputs: OfficialInput[] | undefined,
  values: Record<string, string>,
  authEnvironment: Set<string>,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const input of inputs ?? []) {
    const name = input.name;
    if (!name) continue;
    const value = input.value ?? values[name] ?? input.default;
    if (input.isSecret && value) {
      badRequest(
        `Secret environment variable "${name}" cannot be supplied through overlay.packageInputs; map it through authProfiles[].config.environmentVariables.`,
      );
    }
    if (value) {
      env[name] = value;
      continue;
    }
    if (input.isRequired !== false && !authEnvironment.has(name)) {
      badRequest(
        `Environment variable "${name}" requires a fixed package input or authProfiles[].config.environmentVariables mapping.`,
      );
    }
  }
  return env;
}

function authEnvironmentNames(
  authProfiles: McpAuthProfileRequestDto[],
): Set<string> {
  const result = new Set<string>();
  for (const profile of authProfiles) {
    const names = profile.config?.environmentVariables;
    if (!Array.isArray(names)) continue;
    for (const name of names) {
      if (typeof name === 'string') result.add(name);
    }
  }
  return result;
}

function normalizeDigest(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.startsWith('sha256-') ? value : `sha256-${value}`;
  if (!/^sha256-[a-f0-9]{64}$/.test(normalized)) {
    badRequest('Artifact digest must be a SHA-256 hex digest.');
  }
  return normalized;
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
