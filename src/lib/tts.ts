// TTS — Text-to-Speech via NVIDIA → OpenAI → Browser fallback.
import * as Sentry from "@sentry/nextjs";


export interface TTSOptions {
  text: string;
  voice?: "male" | "female" | "neutral";
  speed?: number;
}

export interface TTSResult {
  audioBase64: string;
  format: string;
  provider: string;
}

export async function synthesizeSpeech(opts: TTSOptions): Promise<TTSResult> {
  const text = opts.text.slice(0, 4000);
  if (!text) return { audioBase64: "", format: "none", provider: "none" };

  if (process.env.NVIDIA_API_KEY) {
    try { return await nvidiaTTS(opts); } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}
  }
  if (process.env.OPENAI_API_KEY) {
    try { return await openaiTTS(opts); } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}
  }
  return { audioBase64: "", format: "web-speech", provider: "browser" };
}

async function nvidiaTTS(opts: TTSOptions): Promise<TTSResult> {
  const voiceMap: Record<string, string> = { male: "male", female: "female", neutral: "neutral" };
  const res = await fetch("https://integrate.api.nvidia.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: "nvidia/tts-en-us-multispeaker",
      input: opts.text.slice(0, 3000),
      voice: voiceMap[opts.voice || "neutral"],
      speed: opts.speed || 1.0,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`NVIDIA TTS failed (${res.status})`);
  const buffer = await res.arrayBuffer();
  return { audioBase64: Buffer.from(buffer).toString("base64"), format: "mp3", provider: "nvidia" };
}

async function openaiTTS(opts: TTSOptions): Promise<TTSResult> {
  const voiceMap: Record<string, string> = { male: "onyx", female: "nova", neutral: "alloy" };
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "tts-1",
      input: opts.text.slice(0, 4000),
      voice: voiceMap[opts.voice || "neutral"],
      speed: opts.speed || 1.0,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`OpenAI TTS failed (${res.status})`);
  const buffer = await res.arrayBuffer();
  return { audioBase64: Buffer.from(buffer).toString("base64"), format: "mp3", provider: "openai" };
}
