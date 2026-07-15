// Tests for TTS + ASR

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => { fetchMock.mockReset(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("TTS", () => {
  it("uses NVIDIA TTS when key is set", async () => {
    process.env.NVIDIA_API_KEY = "test";
    process.env.OPENAI_API_KEY = "";
    fetchMock.mockResolvedValueOnce(new Response(new ArrayBuffer(100), { status: 200 }));
    const { synthesizeSpeech } = await import("../tts");
    const result = await synthesizeSpeech({ text: "hello" });
    expect(result.provider).toBe("nvidia");
    expect(result.format).toBe("mp3");
  });

  it("falls back to OpenAI when NVIDIA fails", async () => {
    process.env.NVIDIA_API_KEY = "test";
    process.env.OPENAI_API_KEY = "test-openai";
    fetchMock.mockResolvedValueOnce(new Response("error", { status: 500 }));
    fetchMock.mockResolvedValueOnce(new Response(new ArrayBuffer(100), { status: 200 }));
    const { synthesizeSpeech } = await import("../tts");
    const result = await synthesizeSpeech({ text: "hello" });
    expect(result.provider).toBe("openai");
  });

  it("returns browser fallback when no keys", async () => {
    process.env.NVIDIA_API_KEY = "";
    process.env.OPENAI_API_KEY = "";
    const { synthesizeSpeech } = await import("../tts");
    const result = await synthesizeSpeech({ text: "hello" });
    expect(result.provider).toBe("browser");
  });

  it("returns none for empty text", async () => {
    const { synthesizeSpeech } = await import("../tts");
    const result = await synthesizeSpeech({ text: "" });
    expect(result.provider).toBe("none");
  });
});

describe("ASR", () => {
  it("uses NVIDIA ASR when key is set", async () => {
    process.env.NVIDIA_API_KEY = "test";
    process.env.OPENAI_API_KEY = "";
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ text: "hello world" }), { status: 200 }));
    const { transcribeAudio } = await import("../asr");
    const result = await transcribeAudio("base64data", "webm");
    expect(result.text).toBe("hello world");
    expect(result.provider).toBe("nvidia");
  });

  it("falls back to OpenAI when NVIDIA fails", async () => {
    process.env.NVIDIA_API_KEY = "test";
    process.env.OPENAI_API_KEY = "test-openai";
    fetchMock.mockResolvedValueOnce(new Response("error", { status: 500 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ text: "openai result" }), { status: 200 }));
    const { transcribeAudio } = await import("../asr");
    const result = await transcribeAudio("base64data", "webm");
    expect(result.provider).toBe("openai");
    expect(result.text).toBe("openai result");
  });

  it("returns browser fallback when no keys", async () => {
    process.env.NVIDIA_API_KEY = "";
    process.env.OPENAI_API_KEY = "";
    const { transcribeAudio } = await import("../asr");
    const result = await transcribeAudio("base64data", "webm");
    expect(result.provider).toBe("browser");
  });

  it("returns none for empty audio", async () => {
    const { transcribeAudio } = await import("../asr");
    const result = await transcribeAudio("", "webm");
    expect(result.provider).toBe("none");
  });
});
