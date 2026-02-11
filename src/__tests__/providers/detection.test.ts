import { describe, it, expect } from 'vitest';
import { detectProvider, parseRemoteUrl } from '../../providers/index.js';

describe('detectProvider', () => {
  it('detects GitHub from HTTPS URL', () => {
    expect(detectProvider('https://github.com/user/repo.git')).toBe('github');
  });

  it('detects GitHub from SSH URL', () => {
    expect(detectProvider('git@github.com:user/repo.git')).toBe('github');
  });

  it('detects GitLab from HTTPS URL', () => {
    expect(detectProvider('https://gitlab.com/group/project.git')).toBe('gitlab');
  });

  it('detects GitLab from SSH URL', () => {
    expect(detectProvider('git@gitlab.com:group/project.git')).toBe('gitlab');
  });

  it('detects Bitbucket from HTTPS URL', () => {
    expect(detectProvider('https://bitbucket.org/workspace/repo.git')).toBe('bitbucket');
  });

  it('detects Bitbucket from SSH URL', () => {
    expect(detectProvider('git@bitbucket.org:workspace/repo.git')).toBe('bitbucket');
  });

  it('detects Azure DevOps from HTTPS URL', () => {
    expect(detectProvider('https://dev.azure.com/org/project/_git/repo')).toBe('azure-devops');
  });

  it('detects Azure DevOps from SSH URL', () => {
    expect(detectProvider('git@ssh.dev.azure.com:v3/org/project/repo')).toBe('azure-devops');
  });

  it('detects self-hosted GitLab by hostname heuristic', () => {
    expect(detectProvider('https://my-gitlab.company.com/group/repo.git')).toBe('gitlab');
  });

  it('returns unknown for unrecognized hosts', () => {
    expect(detectProvider('https://random-host.com/user/repo.git')).toBe('unknown');
  });
});

describe('parseRemoteUrl', () => {
  it('parses GitHub HTTPS URL', () => {
    const result = parseRemoteUrl('https://github.com/user/repo.git');
    expect(result).toEqual({
      provider: 'github',
      host: 'github.com',
      owner: 'user',
      repo: 'repo',
    });
  });

  it('parses GitHub SSH URL', () => {
    const result = parseRemoteUrl('git@github.com:user/repo.git');
    expect(result).toEqual({
      provider: 'github',
      host: 'github.com',
      owner: 'user',
      repo: 'repo',
    });
  });

  it('parses GitLab HTTPS URL', () => {
    const result = parseRemoteUrl('https://gitlab.com/group/project.git');
    expect(result).toEqual({
      provider: 'gitlab',
      host: 'gitlab.com',
      owner: 'group',
      repo: 'project',
    });
  });

  it('parses Azure DevOps HTTPS URL', () => {
    const result = parseRemoteUrl('https://dev.azure.com/org/project/_git/repo');
    expect(result).toEqual({
      provider: 'azure-devops',
      host: 'dev.azure.com',
      owner: 'org/project',
      repo: 'repo',
    });
  });

  it('parses Azure DevOps SSH URL', () => {
    const result = parseRemoteUrl('git@ssh.dev.azure.com:v3/org/project/repo');
    expect(result).toEqual({
      provider: 'azure-devops',
      host: 'dev.azure.com',
      owner: 'org/project',
      repo: 'repo',
    });
  });

  it('strips .git suffix from repo name', () => {
    const result = parseRemoteUrl('https://github.com/user/my-repo.git');
    expect(result?.repo).toBe('my-repo');
  });

  it('handles URLs without .git suffix', () => {
    const result = parseRemoteUrl('https://github.com/user/my-repo');
    expect(result?.repo).toBe('my-repo');
  });

  it('returns null for invalid URLs', () => {
    expect(parseRemoteUrl('not-a-url')).toBeNull();
    expect(parseRemoteUrl('')).toBeNull();
  });

  it('handles trailing whitespace and newlines', () => {
    const result = parseRemoteUrl('https://github.com/user/repo.git\n');
    expect(result).toEqual({
      provider: 'github',
      host: 'github.com',
      owner: 'user',
      repo: 'repo',
    });
  });

  it('handles trailing whitespace with spaces', () => {
    const result = parseRemoteUrl('  https://github.com/user/repo.git  ');
    expect(result).toEqual({
      provider: 'github',
      host: 'github.com',
      owner: 'user',
      repo: 'repo',
    });
  });
});
