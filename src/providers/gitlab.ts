import { execSync } from 'node:child_process';
import type { GitProvider, PRInfo, IssueInfo } from './types.js';

export class GitLabProvider implements GitProvider {
  readonly name = 'gitlab' as const;
  readonly displayName = 'GitLab';
  readonly prTerminology = 'MR' as const;
  readonly prRefspec = 'merge-requests/{number}/head:{branch}';

  detectFromRemote(url: string): boolean {
    return url.includes('gitlab.com') || /gitlab/i.test(url);
  }

  async detectFromApi(baseUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${baseUrl}/api/v4/version`);
      return response.ok;
    } catch {
      return false;
    }
  }

  viewPR(number: number, owner?: string, repo?: string): PRInfo | null {
    try {
      const repoFlag = owner && repo ? ` --repo ${owner}/${repo}` : '';
      const raw = execSync(
        `glab mr view ${number}${repoFlag} --output json`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const data = JSON.parse(raw);
      return {
        title: data.title,
        headBranch: data.source_branch,
        baseBranch: data.target_branch,
        url: data.web_url,
        body: data.description,
        author: data.author?.username,
      };
    } catch {
      return null;
    }
  }

  viewIssue(number: number, owner?: string, repo?: string): IssueInfo | null {
    try {
      const repoFlag = owner && repo ? ` --repo ${owner}/${repo}` : '';
      const raw = execSync(
        `glab issue view ${number}${repoFlag} --output json`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const data = JSON.parse(raw);
      return {
        title: data.title,
        body: data.description,
        url: data.web_url,
        labels: data.labels,
      };
    } catch {
      return null;
    }
  }

  checkAuth(): boolean {
    try {
      execSync('glab auth status', { stdio: ['pipe', 'pipe', 'pipe'] });
      return true;
    } catch {
      return false;
    }
  }

  getRequiredCLI(): string | null {
    return 'glab';
  }
}
