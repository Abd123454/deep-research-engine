// GitHub connector — fetch repo files via GitHub API.

export interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

export async function fetchRepoFiles(
  token: string,
  owner: string,
  repo: string,
  path: string = ""
): Promise<GitHubFile[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = (await res.json()) as GitHubFile[];
  return Array.isArray(data) ? data : [data];
}

export async function fetchFileContent(
  token: string,
  downloadUrl: string
): Promise<string> {
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  return res.text();
}
