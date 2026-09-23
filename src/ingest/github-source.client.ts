import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';

import { PluginStoreException } from '../common/exceptions';

/** One entry of a git tree listing. */
export interface GitTreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

/** Resolved source location for one ingest run. */
export interface ResolvedSource {
  repository: string;
  commitSha: string;
  /** Commit SHA abbreviated for display. */
  shortSha: string;
}

/**
 * Read-only client for fetching plugin source at a pinned revision.
 *
 * Every read is addressed by blob SHA from a resolved commit, never by branch
 * name, so the bytes behind a build cannot change after review.
 */
@Injectable()
export class GitHubSourceClient {
  private readonly logger = new Logger(GitHubSourceClient.name);
  private readonly http: AxiosInstance;

  /** Repository in `owner/name` form. */
  readonly repository: string;

  /** Directory within the repository that holds one folder per plugin. */
  readonly pluginsDirectory: string;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get('github');
    this.repository = config.pluginRepo;
    this.pluginsDirectory = config.pluginPath;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'synapse-marketplace',
    };
    if (config.token) {
      headers.Authorization = `Bearer ${config.token}`;
    }

    this.http = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: config.timeoutMs,
      headers,
    });
  }

  /**
   * Resolves a branch, tag, or commit-ish to an immutable commit SHA.
   */
  async resolveCommit(ref: string): Promise<ResolvedSource> {
    const data = await this.get<{ sha: string }>(
      `/repos/${this.repository}/commits/${encodeURIComponent(ref)}`,
      `ref '${ref}'`,
    );

    return {
      repository: this.repository,
      commitSha: data.sha,
      shortSha: data.sha.slice(0, 12),
    };
  }

  /**
   * Lists every blob under the plugins directory at a pinned commit.
   */
  async listPluginFiles(source: ResolvedSource): Promise<GitTreeEntry[]> {
    const tree = await this.get<{ tree: GitTreeEntry[]; truncated?: boolean }>(
      `/repos/${this.repository}/git/trees/${source.commitSha}?recursive=1`,
      `tree at ${source.shortSha}`,
    );

    if (tree.truncated) {
      throw new PluginStoreException(
        `Git tree for ${this.repository}@${source.shortSha} is truncated; ` +
          'the repository is too large to ingest in one pass.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const prefix = `${this.pluginsDirectory}/`;
    return tree.tree.filter(
      (entry) => entry.type === 'blob' && entry.path.startsWith(prefix),
    );
  }

  /**
   * Reads a blob by SHA. Content is returned exactly as committed.
   */
  async readBlob(sha: string, path: string): Promise<Buffer> {
    const data = await this.get<{ content: string; encoding: string }>(
      `/repos/${this.repository}/git/blobs/${sha}`,
      `blob ${path}`,
    );

    if (data.encoding !== 'base64') {
      throw new PluginStoreException(
        `Unexpected blob encoding '${data.encoding}' for ${path}.`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    return Buffer.from(data.content.replace(/\s/g, ''), 'base64');
  }

  private async get<T>(path: string, description: string): Promise<T> {
    try {
      const response = await this.http.get<T>(path);
      return response.data;
    } catch (error) {
      throw this.toStoreException(error, description);
    }
  }

  private toStoreException(error: unknown, description: string): PluginStoreException {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (status === 404) {
        return new PluginStoreException(
          `Not found while reading ${description} from ${this.repository}.`,
          HttpStatus.NOT_FOUND,
        );
      }
      if (status === 401 || status === 403) {
        const remaining = axiosError.response?.headers?.['x-ratelimit-remaining'];
        const hint =
          remaining === '0'
            ? 'GitHub API rate limit exhausted; set GITHUB_TOKEN.'
            : 'Check GITHUB_TOKEN permissions.';
        return new PluginStoreException(
          `GitHub refused the request while reading ${description}. ${hint}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      if (status) {
        return new PluginStoreException(
          `GitHub returned ${status} while reading ${description}.`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.logger.error(`GitHub request failed for ${description}: ${axiosError.message}`);
      return new PluginStoreException(
        `Could not reach GitHub while reading ${description}.`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    this.logger.error(`Unexpected GitHub client failure for ${description}`, error as Error);
    return new PluginStoreException(
      `Unexpected failure while reading ${description} from GitHub.`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}
