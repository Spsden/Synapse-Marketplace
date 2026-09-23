import { registerAs } from '@nestjs/config';

/**
 * Configuration for ingesting plugin source from a git host.
 *
 * Ingest builds .synx artifacts from a pinned commit instead of accepting
 * uploaded archives, so the reviewed bytes are reproducible from source.
 */
export const githubConfig = registerAs('github', () => ({
  /** Optional token; raises the API rate limit and is required for private repos. */
  token: process.env.GITHUB_TOKEN,

  /** Source repository in `owner/name` form. */
  pluginRepo: process.env.GITHUB_PLUGIN_REPO || 'Spsden/Synapse-SDK',

  /** Directory within the repository that holds one folder per plugin. */
  pluginPath: (process.env.GITHUB_PLUGIN_PATH || 'plugins').replace(/^\/+|\/+$/g, ''),

  /** REST API base, overridable for GitHub Enterprise. */
  apiBaseUrl: (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, ''),

  /** Per-request timeout in milliseconds. */
  timeoutMs: parseInt(process.env.GITHUB_TIMEOUT_MS || '15000', 10),
}));
