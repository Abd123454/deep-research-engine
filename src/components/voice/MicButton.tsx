"use client";
import * as Sentry from "@sentry/nextjs";
import * as React from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

export function MicButton({ onTranscript, language }: { onTranscript: (text: string) => void; language?: string }) {
  const [recording, setRecording] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          setProcessing(true);
          try {
            const res = await fetch("/api/asr", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio: base64, format: "webm", language }),
            });
            const data = await res.json();
            if (data.text) onTranscript(data.text);
          } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* ignore */ 
} finally { setProcessing(false); }
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* mic denied */ 
}
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }

  return (
    <button
      onClick={recording ? stopRecording : startRecording}
      disabled={processing}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors shrink-0 ${
        recording ? "bg-red-500 text-white animate-pulse" : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
      aria-label={recording ? "Stop recording" : "Start recording"}
    >
      {processing ? <Loader2 className="h-4 w-4 animate-spin" />
       : recording ? <MicOff className="h-4 w-4" />
       : <Mic className="h-4 w-4" />}
    </button>
  );
}
