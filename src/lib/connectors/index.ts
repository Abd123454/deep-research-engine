// Connectors — integration framework for external services.
//
// Each connector implements the Connector interface. The framework is
// deliberately a STUB at this stage: it declares the OAuth2 flow shape
// and the per-service configuration (client id env var, scopes, auth
// URL template) but does NOT implement the actual OAuth2 callback or
// the per-service search/fetch API calls. Those are wired up in a
// later milestone — see /docs/roadmap/v1.5.0-roadmap.md.
//
// The list endpoint (/api/connectors/list) returns the catalog of
// available connectors + which ones have their client-id env vars set
// (so the UI can show "Connect Slack" vs "Slack (not configured)").
// The actual credential storage + token refresh uses the existing
// /api/connectors (singular) endpoint's encrypted-credentials flow —
// see src/app/api/connectors/route.ts and src/lib/credentials.ts.
//
// OAuth2 flow (planned, not yet implemented):
//   1. UI clicks "Connect Slack" → redirect to /api/connectors/[type]/auth
//   2. Auth route generates a random `state` token, stores it server-side
//      (cookie + DB row), and 302-redirects to connector.authUrl(state).
//   3. User authorizes on the provider's site.
//   4. Provider redirects back to /api/connectors/[type]/callback?code=...&state=...
//   5. Callback route verifies `state`, calls connector.handleCallback(code)
//      to exchange the auth code for an access token.
//   6. Access token is encrypted (src/lib/credentials.ts) and stored in
//      the `connectors` table alongside the existing manual-credentials
//      flow.
//
// SECURITY: connector auth URLs include a `state` parameter to prevent
// CSRF. The state is a random token generated server-side and verified
// on callback. The access tokens returned by the provider are encrypted
// at rest with AES-256-GCM (see src/lib/credentials.ts) — they are
// NEVER returned in plaintext over the API.

export interface Connector {
  type: string;
  name: string;
  /** Lucide icon name. The UI maps this to a React component. */
  icon: string;
  description: string;
  /** Whether this connector requires OAuth2 (true) or accepts a manual
   * API token / PAT (false). Manual-token connectors use the existing
   * POST /api/connectors flow; OAuth2 connectors use the auth/callback
   * flow described above. */
  authRequired: boolean;
  /** Capability flags — what the connector can do once connected. */
  capabilities: string[];
  /** OAuth2 authorization URL builder. Returns the URL the UI should
   * redirect the user to. The `state` parameter is a server-generated
   * CSRF token that must be verified on callback. */
  authUrl?: (state: string) => string;
  /** OAuth2 callback handler. Exchanges the authorization code for an
   * access token (and optional refresh token). NOT YET IMPLEMENTED —
   * the stubs below only declare the authUrl, not the handleCallback. */
  handleCallback?: (code: string) => Promise<{ accessToken: string; refreshToken?: string }>;
  /** Search the connected service. NOT YET IMPLEMENTED. */
  search?: (query: string, accessToken: string) => Promise<unknown[]>;
  /** Fetch a single resource by id. NOT YET IMPLEMENTED. */
  fetch?: (id: string, accessToken: string) => Promise<unknown>;
}

export const AVAILABLE_CONNECTORS: Connector[] = [
  {
    type: "slack",
    name: "Slack",
    icon: "MessageSquare",
    description: "Search Slack messages and channels",
    authRequired: true,
    capabilities: ["search", "read"],
    authUrl: (state) =>
      `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=search:read,channels:read&state=${state}`,
  },
  {
    type: "notion",
    name: "Notion",
    icon: "FileText",
    description: "Search Notion pages and databases",
    authRequired: true,
    capabilities: ["search", "read", "write"],
    authUrl: (state) =>
      `https://api.notion.com/v1/oauth/authorize?client_id=${process.env.NOTION_CLIENT_ID}&response_type=code&owner=user&scope=read,write&state=${state}`,
  },
  {
    type: "drive",
    name: "Google Drive",
    icon: "FolderOpen",
    description: "Search Google Drive files",
    authRequired: true,
    capabilities: ["search", "read"],
    authUrl: (state) =>
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=https://www.googleapis.com/auth/drive.readonly&state=${state}`,
  },
  {
    type: "github",
    name: "GitHub",
    icon: "Github",
    description: "Search GitHub repositories and code",
    authRequired: true,
    capabilities: ["search", "read", "write"],
    authUrl: (state) =>
      `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo,read:user&state=${state}`,
  },
  {
    type: "jira",
    name: "Jira",
    icon: "Trello",
    description: "Search Jira issues and projects",
    authRequired: true,
    capabilities: ["search", "read"],
    authUrl: (state) =>
      `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${process.env.JIRA_CLIENT_ID}&scope=read:jira-work&redirect_uri=${process.env.JIRA_REDIRECT_URI}&state=${state}&response_type=code&prompt=consent`,
  },
];

export function getConnector(type: string): Connector | undefined {
  return AVAILABLE_CONNECTORS.find((c) => c.type === type);
}

/**
 * Returns the list of connector types whose client-id env var is set.
 * The UI uses this to show "Connect Slack" (configured) vs
 * "Slack (not configured)" so operators can see at a glance which
 * integrations are wired up.
 *
 * NOTE: this checks the SERVER's env vars. A connector can be
 * "configured" (env var set) without any user having actually connected
 * their account yet — the env var is what makes the OAuth2 flow
 * possible, not a stored credential.
 */
export function getConfiguredConnectors(): string[] {
  return AVAILABLE_CONNECTORS.filter((c) => {
    switch (c.type) {
      case "slack":
        return !!process.env.SLACK_CLIENT_ID;
      case "notion":
        return !!process.env.NOTION_CLIENT_ID;
      case "drive":
        return !!process.env.GOOGLE_CLIENT_ID;
      case "github":
        return !!process.env.GITHUB_CLIENT_ID;
      case "jira":
        return !!process.env.JIRA_CLIENT_ID;
      default:
        return false;
    }
  }).map((c) => c.type);
}
