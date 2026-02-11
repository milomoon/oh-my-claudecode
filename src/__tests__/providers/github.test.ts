import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
import { GitHubProvider } from '../../providers/github.js';

const mockExecSync = vi.mocked(execSync);

describe('GitHubProvider', () => {
  let provider: GitHubProvider;

  beforeEach(() => {
    provider = new GitHubProvider();
    vi.clearAllMocks();
  });

  describe('static properties', () => {
    it('has correct name', () => {
      expect(provider.name).toBe('github');
    });

    it('has correct displayName', () => {
      expect(provider.displayName).toBe('GitHub');
    });

    it('uses PR terminology', () => {
      expect(provider.prTerminology).toBe('PR');
    });

    it('has correct prRefspec', () => {
      expect(provider.prRefspec).toBe('pull/{number}/head:{branch}');
    });

    it('requires gh CLI', () => {
      expect(provider.getRequiredCLI()).toBe('gh');
    });
  });

  describe('detectFromRemote', () => {
    it('returns true for github.com URLs', () => {
      expect(provider.detectFromRemote('https://github.com/user/repo')).toBe(true);
    });

    it('returns true for github.com SSH URLs', () => {
      expect(provider.detectFromRemote('git@github.com:user/repo.git')).toBe(true);
    });

    it('returns false for non-GitHub URLs', () => {
      expect(provider.detectFromRemote('https://gitlab.com/user/repo')).toBe(false);
    });

    it('returns false for bitbucket URLs', () => {
      expect(provider.detectFromRemote('https://bitbucket.org/user/repo')).toBe(false);
    });
  });

  describe('viewPR', () => {
    it('calls gh pr view with correct command and parses response', () => {
      const mockResponse = JSON.stringify({
        title: 'Fix bug',
        headRefName: 'fix/bug',
        baseRefName: 'main',
        body: 'Fixes the bug',
        url: 'https://github.com/user/repo/pull/42',
        author: { login: 'testuser' },
      });
      mockExecSync.mockReturnValue(mockResponse);

      const result = provider.viewPR(42);

      expect(mockExecSync).toHaveBeenCalledWith(
        'gh pr view 42 --json title,headRefName,baseRefName,body,url,author',
        expect.objectContaining({ encoding: 'utf-8' }),
      );
      expect(result).toEqual({
        title: 'Fix bug',
        headBranch: 'fix/bug',
        baseBranch: 'main',
        body: 'Fixes the bug',
        url: 'https://github.com/user/repo/pull/42',
        author: 'testuser',
      });
    });

    it('includes --repo flag when owner and repo are provided', () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        title: 'PR',
        headRefName: 'feat',
        baseRefName: 'main',
        body: '',
        url: '',
        author: { login: 'u' },
      }));

      provider.viewPR(1, 'owner', 'repo');

      expect(mockExecSync).toHaveBeenCalledWith(
        'gh pr view 1 --repo owner/repo --json title,headRefName,baseRefName,body,url,author',
        expect.any(Object),
      );
    });

    it('returns null when execSync throws', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('gh: not found');
      });

      expect(provider.viewPR(1)).toBeNull();
    });
  });

  describe('viewIssue', () => {
    it('calls gh issue view with correct command and parses response', () => {
      const mockResponse = JSON.stringify({
        title: 'Bug report',
        body: 'Something is broken',
        labels: [{ name: 'bug' }, { name: 'critical' }],
        url: 'https://github.com/user/repo/issues/10',
      });
      mockExecSync.mockReturnValue(mockResponse);

      const result = provider.viewIssue(10);

      expect(mockExecSync).toHaveBeenCalledWith(
        'gh issue view 10 --json title,body,labels,url',
        expect.objectContaining({ encoding: 'utf-8' }),
      );
      expect(result).toEqual({
        title: 'Bug report',
        body: 'Something is broken',
        labels: ['bug', 'critical'],
        url: 'https://github.com/user/repo/issues/10',
      });
    });

    it('includes --repo flag when owner and repo are provided', () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        title: 'Issue',
        body: '',
        labels: [],
        url: '',
      }));

      provider.viewIssue(5, 'owner', 'repo');

      expect(mockExecSync).toHaveBeenCalledWith(
        'gh issue view 5 --repo owner/repo --json title,body,labels,url',
        expect.any(Object),
      );
    });

    it('returns null when execSync throws', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('gh: not found');
      });

      expect(provider.viewIssue(1)).toBeNull();
    });
  });

  describe('checkAuth', () => {
    it('returns true when gh auth status succeeds', () => {
      mockExecSync.mockReturnValue('');

      expect(provider.checkAuth()).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        'gh auth status',
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] }),
      );
    });

    it('returns false when gh auth status fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('not authenticated');
      });

      expect(provider.checkAuth()).toBe(false);
    });
  });
});
