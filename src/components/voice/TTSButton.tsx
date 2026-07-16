"use client";
import * as Sentry from "@sentry/nextjs";
import * as React from "react";
import { Volume2, Loader2, Square } from "lucide-react";

export function TTSButton({ text, voice }: { text: string; voice?: "male" | "female" | "neutral" }) {
  const [loading, setLoading] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  async function handlePlay() {
    if (playing) {
      audioRef.current?.pause();
      speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      const data = await res.json();
      if (data.provider === "browser") {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        speechSynthesis.speak(utterance);
        setPlaying(true);
        utterance.onend = () => setPlaying(false);
      } else if (data.audioBase64) {
        const audio = new Audio(`data:audio/${data.format};base64,${data.audioBase64}`);
        audioRef.current = audio;
        audio.play();
        setPlaying(true);
        audio.onended = () => setPlaying(false);
      }
    } catch (err) {
  if (process.env.NODE_ENV === "production") Sentry.captureException(err);
/* ignore */ 
} finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePlay}
      disabled={loading || !text}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
      aria-label="Listen"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
       : playing ? <Square className="h-3.5 w-3.5" />
       : <Volume2 className="h-3.5 w-3.5" />}
    </button>
  );
}
