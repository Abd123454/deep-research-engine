// In-memory document store.
//
// Same pattern as research-store.ts: a Map on globalThis so documents
// survive HMR in dev and are shared across requests in a single server
// process. Documents auto-expire after 2 hours of inactivity to bound
// memory usage.
//
// For production with multiple instances, replace this with SQLite or
// an object store (S3 + Postgres metadata).

import { randomUUID } from "crypto";
import { sanitizeFilename } from "./document-parser";

const MAX_DOCS_PER_IP = 10;
const DOC_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours
const MAX_TOTAL_DOCS = 100;

export interface StoredDocument {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  text: string;
  textLength: number;
  preview: string;
  uploadedAt: number;
  lastAccessedAt: number;
  uploaderIp: string;
}

type DocMap = Map<string, StoredDocument>;

interface DocStore {
  docs: DocMap;
  countsByIp: Map<string, number>;
}

function getStore(): DocStore {
  const g = globalThis as typeof globalThis & {
    __deepResearchDocs?: DocStore;
  };
  if (!g.__deepResearchDocs) {
    g.__deepResearchDocs = { docs: new Map(), countsByIp: new Map() };
  }
  return g.__deepResearchDocs;
}

// Sweep expired documents. Called on every access.
function sweepExpired(store: DocStore): void {
  const now = Date.now();
  for (const [id, doc] of store.docs) {
    if (now - doc.lastAccessedAt > DOC_TTL_MS) {
      store.docs.delete(id);
      const c = store.countsByIp.get(doc.uploaderIp) ?? 0;
      if (c > 0) store.countsByIp.set(doc.uploaderIp, c - 1);
    }
  }
}

export function addDocument(
  uploaderIp: string,
  filename: string,
  mimeType: string,
  size: number,
  text: string,
  textLength: number,
  preview: string
): { ok: true; document: StoredDocument } | { ok: false; reason: string } {
  const store = getStore();
  sweepExpired(store);

  const ipCount = store.countsByIp.get(uploaderIp) ?? 0;
  if (ipCount >= MAX_DOCS_PER_IP) {
    return {
      ok: false,
      reason: `Document limit reached (${MAX_DOCS_PER_IP} per IP). Delete an existing document first.`,
    };
  }
  if (store.docs.size >= MAX_TOTAL_DOCS) {
    return { ok: false, reason: "Server document storage is full. Try again later." };
  }

  const doc: StoredDocument = {
    id: randomUUID(),
    filename: sanitizeFilename(filename),
    mimeType,
    size,
    text,
    textLength,
    preview,
    uploadedAt: Date.now(),
    lastAccessedAt: Date.now(),
    uploaderIp,
  };
  store.docs.set(doc.id, doc);
  store.countsByIp.set(uploaderIp, ipCount + 1);
  return { ok: true, document: doc };
}

export function getDocument(id: string): StoredDocument | undefined {
  const store = getStore();
  const doc = store.docs.get(id);
  if (doc) {
    doc.lastAccessedAt = Date.now();
  }
  return doc;
}

export function listDocuments(): StoredDocument[] {
  const store = getStore();
  sweepExpired(store);
  return Array.from(store.docs.values()).sort(
    (a, b) => b.uploadedAt - a.uploadedAt
  );
}

export function deleteDocument(id: string): boolean {
  const store = getStore();
  const doc = store.docs.get(id);
  if (!doc) return false;
  store.docs.delete(id);
  const c = store.countsByIp.get(doc.uploaderIp) ?? 0;
  if (c > 0) store.countsByIp.set(doc.uploaderIp, c - 1);
  return true;
}

// For testing — reset the store.
export function _resetStore(): void {
  const store = getStore();
  store.docs.clear();
  store.countsByIp.clear();
}
