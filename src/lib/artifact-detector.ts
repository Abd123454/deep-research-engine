// Artifact detector — scans LLM responses for extractable artifacts.
// If a response contains HTML, React/JSX, code, SVG, or a long markdown
// report, it's extracted into an Artifact that renders in the side panel
// instead of cluttering the chat.

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
