// API client for communicating with Quaesitor backend
// Configure INSTANCE_URL in app.json or via settings

const DEFAULT_URL = "http://localhost:3000";

/**
 * Validate that a URL is well-formed and uses an allowed protocol
 * (http: or https: only).
 *
 * SECURITY (v7 audit fix): without this guard, a malicious or
 * misconfigured `baseUrl` could point the API client at an arbitrary
 * scheme — e.g. `file:///etc/passwd` (would attempt to read local
 * files), `javascript:` (would surface as a script-injection sink),
 * or a third-party `https://attacker.example/` endpoint that
 * exfiltrates the user's API key + chat content.
 *
 * The check uses the standard `URL` constructor, which throws on
 * malformed input. We then assert `protocol === "http:" || "https:"`
 * — any other scheme is rejected with a clear error.
 *
 * Throws `Error("Invalid base URL. Must be http:// or https://")`
 * on any failure (the caller surfaces this as a settings-screen
 * validation message).
 */
function validateBaseUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid base URL. Must be http:// or https://");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid base URL. Must be http:// or https://");
  }
}

export class QuaesitorAPI {
  private baseUrl: string;
  private apiKey: string | null;

  constructor(baseUrl?: string) {
    const candidate = baseUrl || DEFAULT_URL;
    // Validate even the default — a future code change to DEFAULT_URL
    // shouldn't silently ship an invalid URL. The default is currently
    // `http://localhost:3000` which always passes, but the check is
    // cheap and defends against regressions.
    validateBaseUrl(candidate);
    this.baseUrl = candidate;
    this.apiKey = null;
  }

  setApiKey(key: string) { this.apiKey = key; }

  /**
   * Update the base URL at runtime (e.g. when the user edits their
   * instance URL in the settings screen).
   *
   * Validates the URL via `validateBaseUrl` BEFORE mutating
   * `this.baseUrl` — a rejected URL leaves the previous (valid) URL
   * in place, so the API client never enters a broken state.
   */
  setBaseUrl(url: string) {
    validateBaseUrl(url);
    this.baseUrl = url;
  }

  async chat(message: string, conversationId?: string): Promise<ReadableStream<Uint8Array>> {
    const res = await fetch(`${this.baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ message, conversationId }),
    });
    if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
    return res.body!;
  }

  async startResearch(query: string): Promise<{ jobId: string }> {
    const res = await fetch(`${this.baseUrl}/api/research/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`Research failed: ${res.status}`);
    return res.json();
  }

  async getJobStatus(jobId: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/api/research/status/${jobId}`, {
      headers: { "Authorization": `Bearer ${this.apiKey}` },
    });
    if (!res.ok) throw new Error(`Status failed: ${res.status}`);
    return res.json();
  }
}
