// Report export — markdown → PDF / DOCX / MD.
//
// All conversion runs server-side. No external API calls.
//
// - PDF: pdfkit renders text with basic markdown formatting (headings,
//   bold, lists). Not a pixel-perfect render — a clean, readable document.
// - DOCX: docx library creates a Word document with paragraphs and
//   headings parsed from the markdown.
// - MD: direct download of the markdown source.
import * as Sentry from "@sentry/nextjs";


import { PDFDocument, StandardFonts, PDFFont, rgb } from "pdf-lib";
import { Document as DocxDocument, Packer, Paragraph, HeadingLevel, TextRun } from "docx";

export type ExportFormat = "pdf" | "docx" | "md";

export interface ExportRequest {
  content: string; // markdown
  format: ExportFormat;
  filename?: string; // optional base filename (without extension)
}

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

const MIME_TYPES: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown",
};

// ---------- Markdown helpers ----------

// Split markdown into lines, then group into blocks (headings, paragraphs,
// list items, code blocks).
interface MdBlock {
  type: "heading" | "paragraph" | "list-item" | "code" | "blank";
  level: number; // heading level (1-6), 0 for non-headings
  text: string;
}

function parseMarkdown(md: string): MdBlock[] {
  const lines = md.split("\n");
  const blocks: MdBlock[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Code fence toggle.
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      blocks.push({ type: "code", level: 0, text: line });
      continue;
    }
    if (inCodeBlock) {
      blocks.push({ type: "code", level: 0, text: line });
      continue;
    }

    // Heading: # Title, ## Subtitle, etc.
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1]!.length,
        text: headingMatch[2]!.trim(),
      });
      continue;
    }

    // List item: - item, * item, 1. item
    const listMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    if (listMatch) {
      blocks.push({ type: "list-item", level: 0, text: listMatch[1]!.trim() });
      continue;
    }
    const numberedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (numberedMatch) {
      blocks.push({ type: "list-item", level: 0, text: numberedMatch[1]!.trim() });
      continue;
    }

    // Blank line.
    if (line.trim() === "") {
      blocks.push({ type: "blank", level: 0, text: "" });
      continue;
    }

    // Regular paragraph.
    blocks.push({ type: "paragraph", level: 0, text: line.trim() });
  }

  return blocks;
}

// Strip markdown inline formatting for plain-text rendering (PDF).
function stripInline(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/__(.+?)__/g, "$1");
}

// ---------- PDF ----------

// pdf-lib is pure JS (no native deps, no font file lookups) and works in
// bundled environments where pdfkit's afm path resolution breaks.

async function exportPdfAsync(
  content: string,
  filename: string
): Promise<ExportResult> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4 width in points
  const pageHeight = 841.89; // A4 height in points
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const blocks = parseMarkdown(content);

  for (const block of blocks) {
    // Determine font + size for this block.
    let activeFont: PDFFont = font;
    let size = 11;
    let isHeading = false;

    if (block.type === "heading") {
      size = Math.max(24 - block.level * 3, 10);
      activeFont = boldFont;
      isHeading = true;
    } else if (block.type === "code") {
      size = 9;
    }

    // Add vertical spacing before the block.
    if (y < margin + size + 10) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    if (isHeading) y -= 8;
    if (block.type === "blank") {
      y -= 6;
      continue;
    }

    // Wrap text to fit within maxWidth.
    const text = stripInline(block.text);
    const displayText =
      block.type === "list-item" ? `  • ${text}` : text;

    const words = displayText.split(" ");
    let line = "";
    const lines: string[] = [];

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      try {
        const w = activeFont.widthOfTextAtSize(testLine, size);
        if (w > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      } catch (err) {
  Sentry.captureException(err);
// Skip unmeasurable characters.
        line = testLine;
      
}
    }
    if (line) lines.push(line);

    // Draw each line.
    for (const ln of lines) {
      if (y < margin + size) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      try {
        page.drawText(ln, {
          x: margin,
          y,
          size,
          font: activeFont,
          color: rgb(0, 0, 0),
        });
      } catch (err) {
  Sentry.captureException(err);
// Skip characters that can't be encoded in Helvetica (e.g. emoji).
      
}
      y -= size + 4;
    }

    if (isHeading) y -= 4;
  }

  const pdfBytes = await doc.save();
  return {
    buffer: Buffer.from(pdfBytes),
    mimeType: MIME_TYPES.pdf,
    filename: `${filename}.pdf`,
  };
}

// ---------- DOCX ----------

async function exportDocx(content: string, filename: string): Promise<ExportResult> {
  const blocks = parseMarkdown(content);
  const children: Paragraph[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
          5: HeadingLevel.HEADING_5,
          6: HeadingLevel.HEADING_6,
        };
        children.push(
          new Paragraph({
            heading: headingMap[block.level] || HeadingLevel.HEADING_2,
            children: [new TextRun({ text: stripInline(block.text), bold: true })],
          })
        );
        break;
      }
      case "list-item":
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: stripInline(block.text) })],
          })
        );
        break;
      case "code":
        children.push(
          new Paragraph({
            children: [new TextRun({ text: block.text, font: "Courier New" })],
          })
        );
        break;
      case "blank":
        children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
        break;
      case "paragraph":
      default:
        children.push(
          new Paragraph({
            children: [new TextRun({ text: stripInline(block.text) })],
          })
        );
        break;
    }
  }

  const doc = new DocxDocument({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return {
    buffer: Buffer.from(buffer),
    mimeType: MIME_TYPES.docx,
    filename: `${filename}.docx`,
  };
}

// ---------- MD ----------

function exportMd(content: string, filename: string): ExportResult {
  return {
    buffer: Buffer.from(content, "utf-8"),
    mimeType: MIME_TYPES.md,
    filename: `${filename}.md`,
  };
}

// ---------- Dispatcher ----------

export async function exportReport(req: ExportRequest): Promise<ExportResult> {
  const filename = (req.filename || "report").replace(/[^\w.-]/g, "_").slice(0, 100);

  switch (req.format) {
    case "pdf":
      return exportPdfAsync(req.content, filename);
    case "docx":
      return exportDocx(req.content, filename);
    case "md":
      return exportMd(req.content, filename);
    default:
      throw new Error(`Unsupported format: ${req.format}`);
  }
}

export function isSupportedFormat(format: string): format is ExportFormat {
  return format === "pdf" || format === "docx" || format === "md";
}
