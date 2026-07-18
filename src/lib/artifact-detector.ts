// Artifact detector — scans LLM responses for extractable artifacts.
// If a response contains HTML, React/JSX, code, SVG, or a long markdown
// report, it's extracted into an Artifact that renders in the side panel
// instead of cluttering the chat.
//
// Two entry points:
//   1. `detectArtifact(response)` — runs AFTER the full response is in.
//      Returns the canonical artifact (final fenced-block content, etc.).
//   2. `detectArtifactStream(partialText)` — runs DURING streaming. It
//      scans a sliding window (the last ~500 chars) for the OPENING
//      marker of an artifact (```\n```html, ```<svg```, ```function ```,
//      ```def ```, ```mermaid```, etc.) and returns a PARTIAL artifact
//      immediately so the UI can show an "Artifact detected →" affordance
//      before the stream completes.
//
// The streaming detector is intentionally conservative: it only fires on
// unambiguous opening markers (a fence + language tag, or a bare ```<svg```)
// to avoid false positives on prose that happens to mention "html" or
// "function". The final `detectArtifact` pass on the completed response
// is still authoritative.

export interface Artifact {
  type: "research_report" | "code" | "html" | "react" | "markdown" | "svg" | "mermaid";
  content: string;
  title?: string;
  language?: string;
}

export function detectArtifact(response: string): Artifact | null {
  if (!response || response.length < 20) return null;

  // 1. HTML block: ```html ... ```
  const htmlMatch = response.match(/```html\s*\n([\s\S]*?)```/i);
  if (htmlMatch && htmlMatch[1] && htmlMatch[1].trim().length > 10) {
    return { type: "html", content: htmlMatch[1].trim(), title: "HTML Preview", language: "html" };
  }

  // 2. React/JSX block: ```jsx or ```tsx
  const reactMatch = response.match(/```(?:jsx|tsx)\s*\n([\s\S]*?)```/i);
  if (reactMatch && reactMatch[1] && reactMatch[1].length > 30) {
    return { type: "react", content: reactMatch[1].trim(), title: "React Component", language: "jsx" };
  }

  // 3. SVG tag
  const svgMatch = response.match(/(<svg[\s\S]*?<\/svg>)/i);
  if (svgMatch && svgMatch[1] && svgMatch[1].length > 50) {
    return { type: "svg", content: svgMatch[1].trim(), title: "SVG Diagram" };
  }

  // 4. Mermaid diagram: ```mermaid ... ```
  const mermaidMatch = response.match(/```mermaid\s*\n([\s\S]*?)```/i);
  if (mermaidMatch && mermaidMatch[1] && mermaidMatch[1].trim().length > 10) {
    return { type: "mermaid", content: mermaidMatch[1].trim(), title: "Mermaid Diagram", language: "mermaid" };
  }

  // 5. Code block (python, javascript, etc.) — only if it's the main content
  const codeMatch = response.match(/```(?:python|javascript|typescript|go|rust|java|c\+\+|sql)\s*\n([\s\S]*?)```/i);
  if (codeMatch && codeMatch[1] && codeMatch[1].length > 100 && response.length < codeMatch[1]!.length * 2) {
    const lang = response.match(/```(\w+)/)?.[1] || "code";
    return { type: "code", content: codeMatch[1].trim(), title: `${lang} Code`, language: lang };
  }

  // 5. Research report: has ## headings + ## Sources
  if (response.includes("## Sources") || response.includes("## Sources")) {
    return { type: "research_report", content: response, title: "Research Report" };
  }

  // 6. Long markdown (> 500 chars with ## headings)
  if (response.length > 500 && /##\s/.test(response)) {
    return { type: "markdown", content: response, title: "Document" };
  }

  return null;
}

// ---------- Streaming detection (P0-5) ----------
//
// `detectArtifactStream` runs on a partial (in-progress) LLM response.
// It looks at the LAST ~500 chars (a sliding window) so we don't pay O(n)
// on every token — the chat card calls this throttled to once per 200ms.
//
// Returns a PARTIAL artifact whose `content` is everything between the
// opening marker and the end of the partial text (the closing ``` may
// not have arrived yet). The UI can render this as a live preview; the
// final `detectArtifact` pass on the completed response will produce the
// canonical version.
//
// FALSE-POSITIVE GUARD:
// The streaming detector only fires on UNAMBIGUOUS opening markers:
//   - ```html\n         → html
//   - ```jsx\n / ```tsx\n → react
//   - ```mermaid\n      → mermaid
//   - ```python\n / ```javascript\n / ... → code
//   - <svg ...>         → svg (must be a real SVG tag, not the word "svg")
//
// It deliberately does NOT fire on prose mentions of "html" / "function"
// / "def" / "## Sources" — those need the full-response context that
// `detectArtifact` provides.

const STREAM_WINDOW = 500;

// Map fence-language → artifact type. Order matters: more-specific
// (html, react, mermaid) checked before generic code.
const FENCE_LANGUAGES: Array<{ langs: string[]; type: Artifact["type"]; title: string }> = [
  { langs: ["html"], type: "html", title: "HTML Preview" },
  { langs: ["jsx", "tsx"], type: "react", title: "React Component" },
  { langs: ["mermaid"], type: "mermaid", title: "Mermaid Diagram" },
  {
    langs: ["python", "javascript", "typescript", "go", "rust", "java", "c++", "c", "sql", "bash", "sh"],
    type: "code",
    title: "Code",
  },
];

/**
 * Detect an artifact in a partial (streaming) LLM response.
 *
 * @param partialText The response-so-far. The detector only looks at the
 *                    last `STREAM_WINDOW` (500) characters for performance.
 * @returns A partial `Artifact` whose `content` may be missing the
 *          closing fence, or `null` if no opening marker was found.
 */
export function detectArtifactStream(partialText: string): Artifact | null {
  if (!partialText || partialText.length < 8) return null;

  // Sliding window — the opening marker of the *current* artifact is
  // almost always near the end of the stream (we don't care about
  // completed artifacts earlier in the response; the canonical
  // `detectArtifact` will pick those up on completion).
  const window = partialText.length > STREAM_WINDOW
    ? partialText.slice(partialText.length - STREAM_WINDOW)
    : partialText;

  // 1. Fenced blocks — look for ```lang\n at the start of a fence.
  //    We search the WHOLE partial text (not just the window) for the
  //    fence, because the fence could have opened 600 chars ago and
  //    we're now streaming the body. But we only consider the LATEST
  //    fence (last match) — earlier completed fences are not "in flight".
  for (const spec of FENCE_LANGUAGES) {
    const source = "```(" + spec.langs.join("|") + ")\\s*\\n([\\s\\S]*?)(?:```|$)";
    const re = new RegExp(source, "gi");
    let lastMatch: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    while ((m = re.exec(partialText)) !== null) {
      lastMatch = m;
      if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-width loop
    }
    if (lastMatch && lastMatch[2]) {
      const lang = lastMatch[1]!.toLowerCase();
      const content = lastMatch[2];
      // Skip if the fence is already closed (we'd rather let the final
      // `detectArtifact` handle it cleanly). Detect "is this fence
      // closed?" by checking whether the match consumed a closing ```.
      // Our regex captures `([\s\S]*?)(?:```|$)` — if the closing ```
      // matched, the content does NOT include the closing fence, but the
      // match position is just past it. We treat "closed" as: there's
      // text after the closing fence in the partial (i.e. the fence is
      // not the last thing in the stream).
      const matchEnd = (lastMatch.index ?? 0) + lastMatch[0].length;
      const isClosed = matchEnd < partialText.length;
      if (isClosed) continue; // already complete — let detectArtifact handle it
      return {
        type: spec.type,
        content: content,
        title: spec.title,
        language: spec.type === "code" || spec.type === "html" || spec.type === "react" || spec.type === "mermaid"
          ? lang
          : undefined,
      };
    }
  }

  // 2. Bare SVG tag (no fence) — opening <svg ...> without a closing </svg>
  //    in the last window. Real SVGs are > 50 chars; the streaming
  //    version fires as soon as <svg ...> is followed by enough body to
  //    be plausibly an SVG (not just the word "<svg" in prose).
  const svgOpenIdx = window.lastIndexOf("<svg");
  if (svgOpenIdx !== -1) {
    // Find the end of the partial SVG — everything from <svg to EOT.
    const svgContent = window.slice(svgOpenIdx);
    // Heuristic: must have at least one child element (<circle, <path,
    // <rect, <line, etc.) OR be > 80 chars (a real SVG with attributes).
    const hasChild = /<(circle|path|rect|line|text|g|polyline|polygon|ellipse|defs|use|linearGradient|radialGradient|stop)\b/i.test(svgContent);
    if (hasChild || svgContent.length > 80) {
      // Skip if the SVG is already closed (complete) — let detectArtifact
      // handle it on the final pass.
      if (!/<\/svg>\s*$/i.test(svgContent)) {
        return {
          type: "svg",
          content: svgContent,
          title: "SVG Diagram",
        };
      }
    }
  }

  // 3. Research report / long markdown — these need the full response
  //    to be meaningful, so we DON'T detect them mid-stream. The final
  //    `detectArtifact` pass will pick them up.
  return null;
}
