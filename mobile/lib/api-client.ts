// API client for communicating with Quaesitor backend
// Configure INSTANCE_URL in app.json or via settings

const DEFAULT_URL = "http://localhost:3000";

export class QuaesitorAPI {
  private baseUrl: string;
  private apiKey: string | null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || DEFAULT_URL;
    this.apiKey = null;
  }

  setApiKey(key: string) { this.apiKey = key; }
  setBaseUrl(url: string) { this.baseUrl = url; }

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
