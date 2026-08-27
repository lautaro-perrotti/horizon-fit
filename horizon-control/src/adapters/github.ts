/**
 * GitHub adapter is a stub in Phase 0/1.
 * repo.status uses local git. No PRs, merges, or writes.
 */
export type GithubAdapter = {
  enabled: boolean;
  note: string;
};

export function createGithubAdapter(): GithubAdapter {
  return {
    enabled: false,
    note: "github adapter is a stub; repo.status uses local git only. repo.merge is never granted.",
  };
}
