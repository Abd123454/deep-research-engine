// ASR — Speech-to-Text via NVIDIA → OpenAI Whisper → Browser fallback.

export interface ASRResult {
  text: string;
  provider: string;
}

export async function transcribeAudio(audioBase64: string, format: string, language?: string): Promise<ASRResult> {
  if (!audioBase64) return { text: "", provider: "none" };

  if (process.env.NVIDIA_API_KEY) {
    try { return await nvidiaASR(audioBase64, format, language); } catch { /* fall through */ }
  }
  if (process.env.OPENAI_API_KEY) {
    try { return await openaiWhisper(audioBase64, format, language); } catch { /* fall through */ }
  }
  return { text: "", provider: "browser" };
}

async function nvidiaASR(audioBase64: string, format: string, language?: string): Promise<ASRResult> {
  const buffer = Buffer.from(audioBase64, "base64");
  const blob = new Blob([buffer], { type: `audio/${format}` });
  const formData = new FormData();
  formData.append("file", blob, `audio.${format}`);
  formData.append("model", "nvidia/parakeet-ctc-rnnt-1.1b");
  if (language) formData.append("language", language);

  const res = await fetch("https://integrate.api.nvidia.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`NVIDIA ASR failed (${res.status})`);
  const data = await res.json() as { text?: string };
  return { text: data.text || "", provider: "nvidia" };
}

async function openaiWhisper(audioBase64: string, format: string, language?: string): Promise<ASRResult> {
  const buffer = Buffer.from(audioBase64, "base64");
  const blob = new Blob([buffer], { type: `audio/${format}` });
  const formData = new FormData();
  formData.append("file", blob, `audio.${format}`);
  formData.append("model", "whisper-1");
  if (language) formData.append("language", language);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`OpenAI Whisper failed (${res.status})`);
  const data = await res.json() as { text?: string };
  return { text: data.text || "", provider: "openai" };
}
