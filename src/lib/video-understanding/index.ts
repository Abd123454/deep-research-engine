// Video Understanding — extract keyframes + audio transcript for vision models.
//
// P2-final-wave / Feature 3: interface + stubs for video analysis. Real
// implementation requires ffmpeg (for keyframe extraction + ffprobe for
// metadata) and Whisper (for audio transcription). This module provides
// the type contracts + a stub implementation that returns empty results
// so callers can be written against the interface today; the actual
// ffmpeg + Whisper wiring is a future infrastructure milestone.
//
// When `VIDEO_UNDERSTANDING_ENABLED=true` is set AND ffmpeg + Whisper
// are installed on the host, the real implementation (TODO: wire up
// child_process.execFile calls) would:
//   1. Run `ffprobe -v quiet -print_format json -show_format -show_streams`
//      to get duration, resolution, fps, codec.
//   2. Run `ffmpeg -i input.mp4 -vf fps=1/N frame_%04d.jpg` to extract
//      one keyframe every N seconds (default 5s, capped at maxKeyframes).
//   3. Run `ffmpeg -i input.mp4 -vn -acodec pcm_s16le audio.wav` to
//      extract the audio track, then `whisper audio.wav --model small`
//      to transcribe (returns segments with start/end/text).
//   4. Return a VideoAnalysis with all of the above, ready to feed into
//      `buildVideoPrompt()` for a vision model query.
//
// SECURITY: the `videoPath` is server-controlled (the caller validates it
// against an allow-list of upload directories before invoking). We never
// shell-escape user input — we pass it as an argv element to execFile,
// which avoids shell-injection entirely.

export interface VideoKeyframe {
  /** Timestamp of the frame in the source video, in seconds. */
  timestamp: number;
  /** JPEG thumbnail as a base64 data URI (no `data:image/jpeg;base64,` prefix). */
  base64: string;
}

export interface VideoTranscript {
  segments: Array<{
    /** Start time of the segment, in seconds. */
    start: number;
    /** End time of the segment, in seconds. */
    end: number;
    /** Transcribed text for this segment. */
    text: string;
  }>;
  /** Convenience: all segments joined with a space. */
  fullText: string;
}

export interface VideoAnalysis {
  /** Total duration in seconds. */
  duration: number;
  /** Extracted keyframes (thumbnails). Empty if extraction failed. */
  keyframes: VideoKeyframe[];
  /** Audio transcript, or null if transcription failed / not requested. */
  transcript: VideoTranscript | null;
  /** Source video metadata (from ffprobe). */
  metadata: {
    width: number;
    height: number;
    fps: number;
    codec: string;
  };
}

export interface AnalyzeVideoOptions {
  /** Extract one keyframe every N seconds. Default: 5. */
  keyframeInterval?: number;
  /** Maximum number of keyframes to extract. Default: 20. */
  maxKeyframes?: number;
  /** Whether to also transcribe the audio track. Default: true. */
  transcribe?: boolean;
}

/**
 * Whether video understanding is available on this server.
 *
 * Set `VIDEO_UNDERSTANDING_ENABLED=true` in the environment AND install
 * ffmpeg + Whisper on the host. The flag is the single source of truth —
 * callers should check this BEFORE attempting to analyze a video so they
 * can return a clean 503 to the client instead of a confusing stub result.
 */
export function isVideoUnderstandingAvailable(): boolean {
  return process.env.VIDEO_UNDERSTANDING_ENABLED === "true";
}

/**
 * Analyze a video: extract metadata, keyframes, and (optionally) an
 * audio transcript. The result is structured for direct consumption by
 * vision models (keyframes become image inputs; transcript becomes text).
 *
 * @throws if `isVideoUnderstandingAvailable()` returns false. Callers
 *         should check availability first and return a 503 to the client.
 *
 * STUB: returns an empty analysis. Real implementation is gated behind
 * `VIDEO_UNDERSTANDING_ENABLED=true` + ffmpeg + Whisper installation.
 */
export async function analyzeVideo(
  videoPath: string,
  options: AnalyzeVideoOptions = {}
): Promise<VideoAnalysis> {
  if (!isVideoUnderstandingAvailable()) {
    throw new Error(
      "Video understanding is not available. Set VIDEO_UNDERSTANDING_ENABLED=true " +
        "and install ffmpeg + Whisper."
    );
  }

  // Validate the path — must be a non-empty string. The actual path-
  // allow-list check (against upload directories) is the caller's
  // responsibility; we just sanity-check the shape here.
  if (typeof videoPath !== "string" || videoPath.trim().length === 0) {
    throw new Error("videoPath must be a non-empty string.");
  }

  const { keyframeInterval = 5, maxKeyframes = 20, transcribe = true } = options;

  // Real implementation would:
  // 1. Run ffprobe to get metadata (duration, width, height, fps, codec).
  // 2. Run ffmpeg to extract keyframes (1 per `keyframeInterval` seconds,
  //    capped at `maxKeyframes`).
  // 3. If `transcribe`, extract audio with ffmpeg and run Whisper.
  // 4. Return structured analysis.
  //
  // For now, return an empty analysis so callers can develop against the
  // interface. The TODO below marks the wiring points.
  void keyframeInterval;
  void maxKeyframes;
  void transcribe;
  // TODO(p2-final-wave): wire up ffprobe + ffmpeg + Whisper here.

  return {
    duration: 0,
    keyframes: [],
    transcript: null,
    metadata: { width: 0, height: 0, fps: 0, codec: "unknown" },
  };
}

/**
 * Extract keyframes from a video at a fixed interval.
 *
 * Real implementation: `ffmpeg -i input.mp4 -vf fps=1/{interval} frame_%04d.jpg`
 * then read each frame file as base64 and delete the temp files.
 *
 * @returns array of keyframes (timestamp + base64 JPEG). Empty if the
 *          real implementation isn't wired up yet.
 */
export async function extractKeyframes(
  videoPath: string,
  intervalSeconds = 5,
  maxFrames = 20
): Promise<VideoKeyframe[]> {
  if (!isVideoUnderstandingAvailable()) return [];
  // TODO(p2-final-wave): ffmpeg -i {videoPath} -vf fps=1/{interval} frame_%04d.jpg
  void videoPath;
  void intervalSeconds;
  void maxFrames;
  return [];
}

/**
 * Transcribe a video's audio track using Whisper.
 *
 * Real implementation: extract audio (`ffmpeg -i input.mp4 -vn audio.wav`),
 * then run `whisper audio.wav --model small --output_format json` and
 * parse the JSON segments.
 *
 * @returns transcript with segments + fullText. Empty if the real
 *          implementation isn't wired up yet.
 */
export async function transcribeVideo(videoPath: string): Promise<VideoTranscript> {
  if (!isVideoUnderstandingAvailable()) {
    return { segments: [], fullText: "" };
  }
  // TODO(p2-final-wave): ffmpeg audio extraction + whisper transcription.
  void videoPath;
  return { segments: [], fullText: "" };
}

/**
 * Build a vision-model prompt from a video analysis.
 *
 * The prompt summarizes the video's metadata, lists keyframe timestamps,
 * and includes (a truncated) transcript. The vision model receives the
 * keyframes as image inputs alongside this text prompt — the text gives
 * it the temporal + audio context that pure image inputs can't convey.
 *
 * @param analysis the result of `analyzeVideo()`.
 * @param question the user's question about the video.
 * @returns a single string prompt suitable for a vision-model chat turn.
 */
export function buildVideoPrompt(analysis: VideoAnalysis, question: string): string {
  const parts: string[] = [
    `Video duration: ${analysis.duration}s`,
    `Resolution: ${analysis.metadata.width}x${analysis.metadata.height}`,
    `Keyframes: ${analysis.keyframes.length} (1 per ${
      analysis.keyframes.length > 0
        ? Math.floor(analysis.duration / analysis.keyframes.length)
        : 0
   }s)`,
  ];
  if (analysis.transcript && analysis.transcript.fullText) {
    // Truncate the transcript to 2000 chars — vision models have a
    // limited context window, and the keyframes carry most of the
    // visual information anyway. The transcript is supplementary.
    parts.push(`Transcript: ${analysis.transcript.fullText.slice(0, 2000)}`);
  }
  parts.push(`Question: ${question}`);
  return parts.join("\n");
}
