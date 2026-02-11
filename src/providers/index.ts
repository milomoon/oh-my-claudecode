/**
 * Git Provider Detection and Registry
 *
 * Auto-detects git hosting provider from remote URLs and provides
 * access to provider-specific adapters.
 */

import { execSync } from 'node:child_process';
import type { ProviderName, RemoteUrlInfo, GitProvider } from './types.js';

// Lazy-loaded provider instances
let providerRegistry: Map<ProviderName, GitProvider> | null = null;

/**
 * Detect provider from a git remote URL by matching known hostnames.
 */
export function detectProvider(remoteUrl: string): ProviderName {
  const url = remoteUrl.toLowerCase();

  // Azure DevOps (check before generic patterns)
  if (url.includes('dev.azure.com') || url.includes('ssh.dev.azure.com') || url.includes('visualstudio.com')) {
    return 'azure-devops';
  }

  // GitHub
  if (url.includes('github.com')) {
    return 'github';
  }

  // GitLab (SaaS)
  if (url.includes('gitlab.com')) {
    return 'gitlab';
  }

  // Bitbucket
  if (url.includes('bitbucket.org')) {
    return 'bitbucket';
  }

  // Self-hosted heuristics (less reliable)
  if (/gitlab/i.test(url)) {
    return 'gitlab';
  }
  if (/gitea/i.test(url)) {
    return 'gitea';
  }
  if (/forgejo/i.test(url)) {
    return 'forgejo';
  }

  return 'unknown';
}

/**
 * Parse a git remote URL into structured components.
 * Supports HTTPS, SSH (SCP-style), and provider-specific formats.
 */
export function parseRemoteUrl(url: string): RemoteUrlInfo | null {
  const trimmed = url.trim();

  // Azure DevOps HTTPS: https://dev.azure.com/{org}/{project}/_git/{repo}
  const azureHttpsMatch = trimmed.match(
    /https?:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/\s]+?)(?:\.git)?$/
  );
  if (azureHttpsMatch) {
    return {
      provider: 'azure-devops',
      host: 'dev.azure.com',
      owner: `${azureHttpsMatch[1]}/${azureHttpsMatch[2]}`,
      repo: azureHttpsMatch[3],
    };
  }

  // Azure DevOps SSH: git@ssh.dev.azure.com:v3/{org}/{project}/{repo}
  const azureSshMatch = trimmed.match(
    /git@ssh\.dev\.azure\.com:v3\/([^/]+)\/([^/]+)\/([^/\s]+?)(?:\.git)?$/
  );
  if (azureSshMatch) {
    return {
      provider: 'azure-devops',
      host: 'dev.azure.com',
      owner: `${azureSshMatch[1]}/${azureSshMatch[2]}`,
      repo: azureSshMatch[3],
    };
  }

  // Standard HTTPS: https://host/owner/repo.git
  const httpsMatch = trimmed.match(
    /https?:\/\/([^/]+)\/([^/]+)\/([^/\s]+?)(?:\.git)?$/
  );
  if (httpsMatch) {
    const host = httpsMatch[1];
    return {
      provider: detectProvider(trimmed),
      host,
      owner: httpsMatch[2],
      repo: httpsMatch[3],
    };
  }

  // SSH SCP-style: git@host:owner/repo.git
  const sshMatch = trimmed.match(
    /git@([^:]+):([^/]+)\/([^/\s]+?)(?:\.git)?$/
  );
  if (sshMatch) {
    const host = sshMatch[1];
    return {
      provider: detectProvider(trimmed),
      host,
      owner: sshMatch[2],
      repo: sshMatch[3],
    };
  }

  // SSH URL-style: ssh://git@host/owner/repo.git
  const sshUrlMatch = trimmed.match(
    /ssh:\/\/git@([^/]+)\/([^/]+)\/([^/\s]+?)(?:\.git)?$/
  );
  if (sshUrlMatch) {
    const host = sshUrlMatch[1];
    return {
      provider: detectProvider(trimmed),
      host,
      owner: sshUrlMatch[2],
      repo: sshUrlMatch[3],
    };
  }

  return null;
}

/**
 * Detect the git provider for the current working directory
 * by reading the origin remote URL.
 */
export function detectProviderFromCwd(cwd?: string): ProviderName {
  try {
    const url = execSync('git remote get-url origin', {
      cwd,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!url) return 'unknown';
    return detectProvider(url);
  } catch {
    return 'unknown';
  }
}

/**
 * Parse the remote URL for the current working directory.
 */
export function parseRemoteFromCwd(cwd?: string): RemoteUrlInfo | null {
  try {
    const url = execSync('git remote get-url origin', {
      cwd,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!url) return null;
    return parseRemoteUrl(url);
  } catch {
    return null;
  }
}

/**
 * Initialize the provider registry with all available providers.
 */
function initRegistry(): Map<ProviderName, GitProvider> {
  if (providerRegistry) return providerRegistry;

  providerRegistry = new Map();

  // Lazy imports to avoid circular dependencies and loading unused providers
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GitHubProvider } = require('./github.js');
    providerRegistry.set('github', new GitHubProvider());
  } catch { /* provider not available */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GitLabProvider } = require('./gitlab.js');
    providerRegistry.set('gitlab', new GitLabProvider());
  } catch { /* provider not available */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BitbucketProvider } = require('./bitbucket.js');
    providerRegistry.set('bitbucket', new BitbucketProvider());
  } catch { /* provider not available */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AzureDevOpsProvider } = require('./azure-devops.js');
    providerRegistry.set('azure-devops', new AzureDevOpsProvider());
  } catch { /* provider not available */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GiteaProvider } = require('./gitea.js');
    providerRegistry.set('gitea', new GiteaProvider());
    providerRegistry.set('forgejo', new GiteaProvider()); // Forgejo uses same API
  } catch { /* provider not available */ }

  return providerRegistry;
}

/**
 * Get a provider instance by name.
 * Returns null if the provider is not registered.
 */
export function getProvider(name: ProviderName): GitProvider | null {
  const registry = initRegistry();
  return registry.get(name) ?? null;
}

/**
 * Get a provider for the current working directory.
 * Detects the provider from the git remote URL and returns its adapter.
 */
export function getProviderFromCwd(cwd?: string): GitProvider | null {
  const name = detectProviderFromCwd(cwd);
  if (name === 'unknown') return null;
  return getProvider(name);
}

// Re-export types for convenience
export type { ProviderName, RemoteUrlInfo, GitProvider, PRInfo, IssueInfo } from './types.js';
