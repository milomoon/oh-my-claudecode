import { execSync } from 'node:child_process';
import type { GitProvider, PRInfo, IssueInfo } from './types.js';

export class GiteaProvider implements GitProvider {
  readonly name = 'gitea' as const;
  readonly displayName = 'Gitea';
  readonly prTerminology = 'PR' as const;
  readonly prRefspec = null;

  detectFromRemote(_url: string): boolean {
    // Self-hosted: can't reliably detect from URL patterns alone
    return false;
  }

  async detectFromApi(baseUrl: string): Promise<boolean> {
    try {
      // Check Forgejo first (Forgejo is a Gitea fork with its own version endpoint)
      const forgejoRes = await fetch(`${baseUrl}/api/forgejo/v1/version`);
      if (forgejoRes.ok) return true;
    } catch {
      // Forgejo endpoint not available, try Gitea
    }

    try {
      const giteaRes = await fetch(`${baseUrl}/api/v1/version`);
      return giteaRes.ok;
    } catch {
      return false;
    }
  }

  viewPR(number: number, owner?: string, repo?: string): PRInfo | null {
    // Try tea CLI first
    try {
      const raw = execSync(
        `tea pr view ${number}`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const data = JSON.parse(raw);
      return {
        title: data.title,
        headBranch: data.head_branch,
        baseBranch: data.base_branch,
        url: data.html_url,
        body: data.body,
        author: data.user?.login,
      };
    } catch {
      // tea not installed or failed, fall back to REST API
    }

    return this.viewPRviaRest(number, owner, repo);
  }

  private viewPRviaRest(number: number, owner?: string, repo?: string): PRInfo | null {
    const baseUrl = process.env.GITEA_URL;
    const token = process.env.GITEA_TOKEN;
    if (!baseUrl || !owner || !repo) return null;

    try {
      const headers = token ? `-H "Authorization: token ${token}"` : '';
      const raw = execSync(
        `curl -sS ${headers} "${baseUrl}/api/v1/repos/${owner}/${repo}/pulls/${number}"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const data = JSON.parse(raw);
      return {
        title: data.title,
        headBranch: data.head?.ref ?? data.head_branch,
        baseBranch: data.base?.ref ?? data.base_branch,
        url: data.html_url,
        body: data.body,
        author: data.user?.login,
      };
    } catch {
      return null;
    }
  }

  viewIssue(number: number, owner?: string, repo?: string): IssueInfo | null {
    // Try tea CLI first
    try {
      const raw = execSync(
        `tea issues view ${number}`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const data = JSON.parse(raw);
      return {
        title: data.title,
        body: data.body,
        url: data.html_url,
        labels: data.labels?.map((l: { name: string }) => l.name),
      };
    } catch {
      // tea not installed or failed, fall back to REST API
    }

    return this.viewIssueviaRest(number, owner, repo);
  }

  private viewIssueviaRest(number: number, owner?: string, repo?: string): IssueInfo | null {
    const baseUrl = process.env.GITEA_URL;
    if (!baseUrl || !owner || !repo) return null;

    try {
      const raw = execSync(
        `curl -sS "${baseUrl}/api/v1/repos/${owner}/${repo}/issues/${number}"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const data = JSON.parse(raw);
      return {
        title: data.title,
        body: data.body,
        url: data.html_url,
        labels: data.labels?.map((l: { name: string }) => l.name),
      };
    } catch {
      return null;
    }
  }

  checkAuth(): boolean {
    // Check GITEA_TOKEN env var
    if (process.env.GITEA_TOKEN) return true;

    // Try tea CLI auth
    try {
      execSync('tea login list', { stdio: ['pipe', 'pipe', 'pipe'] });
      return true;
    } catch {
      return false;
    }
  }

  getRequiredCLI(): string | null {
    return 'tea';
  }
}
