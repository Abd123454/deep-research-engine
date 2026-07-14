// Document text extraction — PDF, DOCX, TXT, MD, images (OCR).
//
// All extraction runs server-side. No external API calls except NVIDIA
// (for Q&A, not extraction). OCR uses tesseract.js (local, no cloud).
//
// Each function returns the extracted plain text. On failure, throws with
// a clear message so the API route can return a 4xx.

import type { Buffer } from "buffer";

export interface ParsedDocument {
  text: string;
  textLength: number;
  preview: string;
}

const MAX_TEXT_CHARS = 200_000; // cap extracted text to stay within LLM context

function truncate(text: string): ParsedDocument {
  const t = text.slice(0, MAX_TEXT_CHARS);
  return {
    text: t,
    textLength: t.length,
    preview: t.slice(0, 500),
  };
}

// ---------- PDF ----------
export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  // Dynamic import — pdf-parse is ESM-incompatible at top level in some setups.
  const mod = await import("pdf-parse");
  const pdfParse = (mod as unknown as { default: (b: Buffer) => Promise<{ text?: string }> }).default;
  const data = await pdfParse(buffer);
  const text = (data.text || "").trim();
  if (!text) {
    throw new Error("PDF contained no extractable text (it may be a scanned image).");
  }
  return truncate(text);
}

// ---------- DOCX ----------
export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value || "").trim();
  if (!text) {
    throw new Error("DOCX contained no extractable text.");
  }
  return truncate(text);
}

// ---------- TXT / MD ----------
export async function parseText(buffer: Buffer): Promise<ParsedDocument> {
  const text = buffer.toString("utf-8").trim();
  if (!text) {
    throw new Error("Text file is empty.");
  }
  return truncate(text);
}

// ---------- Image (OCR via tesseract.js) ----------
export async function parseImage(buffer: Buffer, _mimeType: string): Promise<ParsedDocument> {
  // tesseract.js is heavy (~5MB). Load it lazily so it doesn't slow startup
  // for the common PDF/DOCX/TXT path.
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(buffer);
    const text = (data.text || "").trim();
    if (!text) {
      throw new Error("OCR found no text in the image.");
    }
    return truncate(text);
  } finally {
    await worker.terminate();
  }
}

// ---------- Dispatcher ----------
export async function parseDocument(
  buffer: Buffer,
  mimeType: string
): Promise<ParsedDocument> {
  const mt = mimeType.toLowerCase();
  if (mt === "application/pdf") return parsePdf(buffer);
  if (
    mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mt === "application/msword"
  ) {
    return parseDocx(buffer);
  }
  if (mt === "text/plain" || mt === "text/markdown") return parseText(buffer);
  if (mt === "image/png" || mt === "image/jpeg" || mt === "image/webp") {
    return parseImage(buffer, mimeType);
  }
  throw new Error(`Unsupported file type: ${mimeType}`);
}

// ---------- Validation ----------
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

// Sanitize filename — strip path separators, limit length.
export function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/[^\w.\- ]/g, "");
  return base.slice(0, 200) || "document";
}
