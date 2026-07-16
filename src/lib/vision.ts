// Vision — multimodal image understanding via LLM vision APIs.
//
// Fallback chain: OpenAI (GPT-4o) → Anthropic (Claude 3.5) → NVIDIA
// (Llama 3.2 Vision) → Tesseract OCR (text only, no understanding).

import { env } from "./env";
import { logger } from "./logger";

export interface ImageAnalysis {
  description: string;
  text?: string;
  objects?: string[];
  provider: string;
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  prompt: string = "Describe this image in detail. Extract any visible text. List key objects and their positions."
): Promise<ImageAnalysis> {
  if (env("OPENAI_API_KEY")) {
    try {
      return await openaiVision(imageBase64, mimeType, prompt);
    } catch (err) {
      logger.warn(
        { module: "vision", provider: "openai", err: err instanceof Error ? err.message : String(err) },
        "OpenAI vision failed"
      );
    }
  }

  if (env("ANTHROPIC_API_KEY")) {
    try {
      return await anthropicVision(imageBase64, mimeType, prompt);
    } catch (err) {
      logger.warn(
        { module: "vision", provider: "anthropic", err: err instanceof Error ? err.message : String(err) },
        "Anthropic vision failed"
      );
    }
  }

  if (env("NVIDIA_API_KEY")) {
    try {
      return await nvidiaVision(imageBase64, mimeType, prompt);
    } catch (err) {
      logger.warn(
        { module: "vision", provider: "nvidia", err: err instanceof Error ? err.message : String(err) },
        "NVIDIA vision failed"
      );
    }
  }

  // Fallback: Tesseract OCR (text only).
  return await tesseractFallback(imageBase64);
}

async function openaiVision(imageBase64: string, mimeType: string, prompt: string): Promise<ImageAnalysis> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }],
      max_tokens: 1000,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`OpenAI Vision error ${res.status}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const description = data.choices?.[0]?.message?.content ?? "Unable to analyze image.";
  return { description, provider: "openai" };
}

async function anthropicVision(imageBase64: string, mimeType: string, prompt: string): Promise<ImageAnalysis> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: imageBase64 } },
          { type: "text", text: prompt },
        ],
      }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Anthropic Vision error ${res.status}`);
  const data = await res.json() as { content?: { type: string; text?: string }[] };
  const description = data.content?.find((c) => c.type === "text")?.text ?? "Unable to analyze image.";
  return { description, provider: "anthropic" };
}

async function nvidiaVision(imageBase64: string, mimeType: string, prompt: string): Promise<ImageAnalysis> {
  const baseUrl = env("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env("NVIDIA_API_KEY")}`,
    },
    body: JSON.stringify({
      model: "meta/llama-3.2-90b-vision-instruct",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }],
      max_tokens: 1000,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`NVIDIA Vision error ${res.status}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const description = data.choices?.[0]?.message?.content ?? "Unable to analyze image.";
  return { description, provider: "nvidia" };
}

async function tesseractFallback(imageBase64: string): Promise<ImageAnalysis> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(Buffer.from(imageBase64, "base64"));
    await worker.terminate();
    return {
      description: data.text ? `Extracted text: ${data.text.slice(0, 1000)}` : "No text found in image. (Vision API not configured — using OCR fallback.)",
      text: data.text || "",
      provider: "tesseract",
    };
  } catch {
    return {
      description: "Image analysis unavailable. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or NVIDIA_API_KEY for vision support.",
      provider: "none",
    };
  }
}
