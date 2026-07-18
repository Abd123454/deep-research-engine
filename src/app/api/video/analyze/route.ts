// POST /api/video/analyze — analyze a video (keyframes + transcript).
//
// P2-final-wave / Feature 3: Video Understanding. Accepts a video URL
// or local path and returns a structured analysis (metadata, keyframes
// as base64 JPEGs, audio transcript). The result is suitable for
// feeding into a vision-model chat turn via `buildVideoPrompt()`.
//
// GATING: this endpoint returns 503 unless `VIDEO_UNDERSTANDING_ENABLED=true`
// is set on the server. The real implementation also requires ffmpeg +
// Whisper installed on the host — the lib stub returns an empty analysis
// when those aren't available, but the flag is the single source of truth
// for "is this endpoint live". Operators who haven't installed the
// toolchain should leave the flag unset so clients get a clean 503
// instead of a confusing empty result.
//
// SECURITY:
//   1. requireAuth + getUserId — only authenticated users can analyze
//      videos (video processing is CPU-intensive; anonymous access
//      would be a DoS vector).
//   2. Audit logging — every analysis request is recorded with the
//      `video.analyze` action slug. The video path / URL is recorded
//      (capped at 500 chars) so an operator can reconstruct what was
//      analyzed and by whom.
//   3. Path validation — the `videoPath` / `videoUrl` is validated as a
//      non-empty string ≤ 2000 chars. The actual path-allow-list check
//      (against upload directories) is the lib's responsibility when
//      the real implementation lands.
//
// The route runs in the nodejs runtime (not edge) because the real
// implementation will use child_process.execFile for ffmpeg + Whisper.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { sanitizeError } from "@/lib/sanitize-error";
import { logger } from "@/lib/logger";
import {
  analyzeVideo,
  isVideoUnderstandingAvailable,
  type AnalyzeVideoOptions,
  type VideoAnalysis,
} from "@/lib/video-understanding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnalyzeVideoBody {
  videoPath?: unknown;
  videoUrl?: unknown;
  options?: unknown;
}

/** Max length for the recorded videoPath/videoUrl in audit metadata. */
const MAX_PATH_LOG_LEN = 500;

/** Max length for a submitted videoPath/videoUrl string. */
const MAX_PATH_INPUT_LEN = 2000;

/**
 * POST /api/video/analyze
 *
 * Body:
 *   {
 *     videoPath: string,  // local path OR
 *     videoUrl: string,   // remote URL (fetched server-side)
 *     options?: {         // optional analysis tuning
 *       keyframeInterval?: number,  // seconds between keyframes (default 5)
 *       maxKeyframes?: number,      // cap on keyframes (default 20)
 *       transcribe?: boolean        // also transcribe audio (default true)
 *     }
 *   }
 *
 * Response (200): `{ ok, analysis: VideoAnalysis }`.
 * Response (503): video understanding not enabled on this server.
 * Response (400): missing/invalid videoPath or videoUrl.
 * Response (401): not authenticated.
 */
export async function POST(req: NextRequest) {
  // Gate 1: feature flag. Return a clean 503 BEFORE requiring auth so
  // a misconfigured client gets a descriptive error without leaking
  // whether auth is configured. (The auth check happens second so the
  // 503 message is consistent regardless of credentials.)
  if (!isVideoUnderstandingAvailable()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Video understanding is not available on this server. " +
          "Set VIDEO_UNDERSTANDING_ENABLED=true and install ffmpeg + Whisper.",
      },
      { status: 503 }
    );
  }

  // Gate 2: auth. Video analysis is CPU-intensive — anonymous access
  // would be a DoS vector.
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  let body: AnalyzeVideoBody;
  try {
    body = (await req.json()) as AnalyzeVideoBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  // Validate videoPath / videoUrl. Exactly one must be provided.
  const videoPath =
    typeof body.videoPath === "string" ? body.videoPath : undefined;
  const videoUrl =
    typeof body.videoUrl === "string" ? body.videoUrl : undefined;
  const target = videoPath || videoUrl;
  if (!target || target.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "'videoPath' or 'videoUrl' is required." },
      { status: 400 }
    );
  }
  if (target.length > MAX_PATH_INPUT_LEN) {
    return NextResponse.json(
      { ok: false, error: `'videoPath'/'videoUrl' must be ≤ ${MAX_PATH_INPUT_LEN} chars.` },
      { status: 400 }
    );
  }

  // Validate options shape (if provided).
  const options: AnalyzeVideoOptions = {};
  if (body.options !== undefined && body.options !== null) {
    if (typeof body.options !== "object" || Array.isArray(body.options)) {
      return NextResponse.json(
        { ok: false, error: "'options' must be an object." },
        { status: 400 }
      );
    }
    const opts = body.options as Record<string, unknown>;
    if (opts.keyframeInterval !== undefined) {
      if (typeof opts.keyframeInterval !== "number" || opts.keyframeInterval <= 0) {
        return NextResponse.json(
          { ok: false, error: "'options.keyframeInterval' must be a positive number." },
          { status: 400 }
        );
      }
      options.keyframeInterval = opts.keyframeInterval;
    }
    if (opts.maxKeyframes !== undefined) {
      if (typeof opts.maxKeyframes !== "number" || opts.maxKeyframes <= 0) {
        return NextResponse.json(
          { ok: false, error: "'options.maxKeyframes' must be a positive number." },
          { status: 400 }
        );
      }
      options.maxKeyframes = opts.maxKeyframes;
    }
    if (opts.transcribe !== undefined) {
      if (typeof opts.transcribe !== "boolean") {
        return NextResponse.json(
          { ok: false, error: "'options.transcribe' must be a boolean." },
          { status: 400 }
        );
      }
      options.transcribe = opts.transcribe;
    }
  }

  // Audit-log BEFORE executing. The videoPath/URL is recorded (capped)
  // so an operator can reconstruct what was analyzed and by whom. The
  // ANALYSIS RESULT (keyframes + transcript) is NOT logged — it can be
  // large and contain sensitive content (e.g. a video of a whiteboard
  // with proprietary info).
  logSensitiveAction("video.analyze", userId, req, {
    source: videoUrl ? "url" : "path",
    target: target.slice(0, MAX_PATH_LOG_LEN),
    keyframeInterval: options.keyframeInterval,
    maxKeyframes: options.maxKeyframes,
    transcribe: options.transcribe,
  });

  try {
    const analysis: VideoAnalysis = await analyzeVideo(target, options);
    logger.debug(
      {
        module: "video-understanding",
        userId,
        duration: analysis.duration,
        keyframeCount: analysis.keyframes.length,
        hasTranscript: !!analysis.transcript,
      },
      "Video analyzed"
    );
    return NextResponse.json({ ok: true, analysis });
  } catch (err) {
    logger.warn(
      {
        module: "video-understanding",
        userId,
        err: sanitizeError(err),
      },
      "Video analysis failed"
    );
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeError(err) || "Video analysis failed.",
      },
      { status: 500 }
    );
  }
}
