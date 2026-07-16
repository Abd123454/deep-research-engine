// Embedding service — converts text into vector embeddings for semantic search.
//
// Fallback chain: NVIDIA (nv-embed-v1, 1024 dims, free) → OpenAI
// (text-embedding-3-small, 1536 dims, paid) → skip (return empty array).
//
// If both fail, the memory is stored without an embedding — text search
// (LIKE) is used as a fallback for recall.

import { env } from "./env";
import { logger } from "./logger";

const MAX_TOKENS_PER_CHUNK = 8000; // ~32K chars per chunk
const MAX_BATCH_SIZE = 64;

// Split text into chunks that fit within the embedding model's token limit.
function chunkText(text: string): string[] {
  if (text.length <= MAX_TOKENS_PER_CHUNK * 4) return [text];
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let current = "";
  for (const sentence of sentences) {
    if ((current + " " + sentence).length > MAX_TOKENS_PER_CHUNK * 4) {
      if (current) chunks.push(current);
      current = sentence;
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// Mean-pool multiple chunk embeddings into a single vector.
function meanPool(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  if (vectors.length === 1) return vectors[0]!;
  const dim = vectors[0]!.length;
  const result = new Array(dim).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) result[i] += vec[i]!;
  }
  for (let i = 0; i < dim; i++) result[i] /= vectors.length;
  return result;
}

// ---------- NVIDIA embedding ----------

async function embedNvidia(text: string): Promise<number[]> {
  const apiKey = env("NVIDIA_API_KEY");
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");
  const baseUrl = env("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1");
  const model = env("NVIDIA_EMBED_MODEL", "nvidia/nv-embed-v1");

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
      input_type: "query",
      encoding_format: "float",
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`NVIDIA embedding error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    data?: { embedding?: number[] }[];
  };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error("NVIDIA embedding returned empty vector");
  }
  return embedding;
}

// ---------- OpenAI embedding (fallback) ----------

async function embedOpenAI(text: string): Promise<number[]> {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const baseUrl = env("OPENAI_BASE_URL", "https://api.openai.com/v1");
  const model = env("OPENAI_EMBED_MODEL", "text-embedding-3-small");

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
      encoding_format: "float",
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI embedding error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    data?: { embedding?: number[] }[];
  };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error("OpenAI embedding returned empty vector");
  }
  return embedding;
}

// ---------- Public API ----------

export interface EmbedResult {
  vector: number[];
  provider: "nvidia" | "openai" | "none";
  dimensions: number;
}

/**
 * Embed a single text string. Chunks long text and mean-pools the results.
 * Fallback chain: NVIDIA → OpenAI → none (empty vector).
 */
export async function embed(text: string): Promise<EmbedResult> {
  if (!text || !text.trim()) {
    return { vector: [], provider: "none", dimensions: 0 };
  }

  const chunks = chunkText(text);
  const vectors: number[][] = [];

  for (const chunk of chunks) {
    // Try NVIDIA first.
    try {
      const vec = await embedNvidia(chunk);
      vectors.push(vec);
      continue;
    } catch (err) {
      logger.warn(
        { module: "embeddings", provider: "nvidia", err: err instanceof Error ? err.message : String(err) },
        "NVIDIA embeddings failed -> OpenAI"
      );
    }

    // Fallback to OpenAI.
    try {
      const vec = await embedOpenAI(chunk);
      vectors.push(vec);
      continue;
    } catch (err) {
      logger.warn(
        { module: "embeddings", provider: "openai", err: err instanceof Error ? err.message : String(err) },
        "OpenAI embeddings failed -> skip"
      );
    }

    // Both failed — skip this chunk.
    return { vector: [], provider: "none", dimensions: 0 };
  }

  const pooled = meanPool(vectors);
  // Determine which provider actually succeeded by checking the vector
  // dimensions (NVIDIA = 1024, OpenAI = 1536).
  const dim = pooled.length;
  const provider: "nvidia" | "openai" = dim === 1024 ? "nvidia" : "openai";

  return {
    vector: pooled,
    provider,
    dimensions: dim,
  };
}

/**
 * Embed multiple texts in batches. More efficient than calling embed() N times.
 */
export async function embedBatch(texts: string[]): Promise<EmbedResult[]> {
  const results: EmbedResult[] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((t) => embed(t)));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Get the expected embedding dimension based on the active provider.
 */
export function getEmbeddingDimension(): number {
  if (env("NVIDIA_API_KEY")) return 1024; // nvidia/nv-embed-v1
  if (env("OPENAI_API_KEY")) return 1536; // text-embedding-3-small
  return 0; // no provider available
}

/**
 * Check if embeddings are available (at least one provider configured).
 */
export function isEmbeddingAvailable(): boolean {
  return !!env("NVIDIA_API_KEY") || !!env("OPENAI_API_KEY");
}

// ---------- Cosine similarity (for SQLite fallback) ----------

/**
 * Compute cosine similarity between two vectors.
 * Used for in-memory semantic search when pgvector is not available.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}
