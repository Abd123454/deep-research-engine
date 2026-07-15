// File Generator — creates PDF, DOCX, PPTX, XLSX, MD files from content.

import { Buffer } from "buffer";

export type FileType = "pdf" | "docx" | "pptx" | "xlsx" | "md";

export interface FileGenRequest {
  type: FileType;
  title: string;
  content: string;
}

export interface FileGenResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

function safeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 100) || "document";
}

export async function generateFile(req: FileGenRequest): Promise<FileGenResult> {
  switch (req.type) {
    case "pdf": return generatePDF(req);
    case "docx": return generateDOCX(req);
    case "pptx": return generatePPTX(req);
    case "xlsx": return generateXLSX(req);
    case "md": return {
      buffer: Buffer.from(req.content, "utf-8"),
      mimeType: "text/markdown",
      filename: `${safeFilename(req.title)}.md`,
    };
  }
}

async function generatePDF(req: FileGenRequest): Promise<FileGenResult> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(req.title);

  const lines = req.content.split("\n");
  let page = doc.addPage([612, 792]);
  let y = 750;
  const margin = 50;

  for (const line of lines) {
    if (y < margin) { page = doc.addPage([612, 792]); y = 750; }
    if (line.startsWith("### ")) {
      page.drawText(line.slice(4), { x: margin, y, size: 13, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
      y -= 24;
    } else if (line.startsWith("## ")) {
      page.drawText(line.slice(3), { x: margin, y, size: 15, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      y -= 28;
    } else if (line.startsWith("# ")) {
      page.drawText(line.slice(2), { x: margin, y, size: 18, font: boldFont, color: rgb(0, 0, 0) });
      y -= 32;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      page.drawText(`• ${line.slice(2)}`, { x: margin + 10, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
      y -= 16;
    } else if (line.trim()) {
      page.drawText(line.slice(0, 90), { x: margin, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
      y -= 16;
    } else { y -= 8; }
  }

  const buffer = await doc.save();
  return { buffer: Buffer.from(buffer), mimeType: "application/pdf", filename: `${safeFilename(req.title)}.pdf` };
}

async function generateDOCX(req: FileGenRequest): Promise<FileGenResult> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");
  const lines = req.content.split("\n");
  const children: InstanceType<typeof Paragraph>[] = [];

  for (const line of lines) {
    if (line.startsWith("### ")) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: line.slice(4), bold: true })] }));
    } else if (line.startsWith("## ")) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line.slice(3), bold: true })] }));
    } else if (line.startsWith("# ")) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: line.slice(2), bold: true })] }));
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(line.slice(2))] }));
    } else if (line.trim()) {
      children.push(new Paragraph({ children: [new TextRun(line)] }));
    } else {
      children.push(new Paragraph({}));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return { buffer: Buffer.from(buffer), mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename: `${safeFilename(req.title)}.docx` };
}

async function generatePPTX(req: FileGenRequest): Promise<FileGenResult> {
  const pptxgen = (await import("pptxgenjs")).default;
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";

  const lines = req.content.split("\n");
  let currentSlide: any = null;

  for (const line of lines) {
    if (line.startsWith("## ") || line.startsWith("# ")) {
      currentSlide = pptx.addSlide();
      currentSlide.addText(line.replace(/^#+\s*/, ""), { x: 0.5, y: 0.5, w: 9, h: 1, fontSize: 28, bold: true, color: "333333" });
    } else if ((line.startsWith("- ") || line.startsWith("* ")) && currentSlide) {
      currentSlide.addText(line.slice(2), { x: 1, y: 2, w: 8, h: 0.5, fontSize: 18, color: "666666", bullet: true });
    } else if (line.trim() && currentSlide) {
      currentSlide.addText(line, { x: 1, y: 2, w: 8, h: 0.5, fontSize: 18, color: "666666" });
    }
  }

  if (!currentSlide) {
    const slide = pptx.addSlide();
    slide.addText(req.title, { x: 1, y: 1, w: 9, h: 2, fontSize: 28, bold: true, align: "center" });
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return { buffer, mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", filename: `${safeFilename(req.title)}.pptx` };
}

async function generateXLSX(req: FileGenRequest): Promise<FileGenResult> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");

  const lines = req.content.split("\n").filter((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const row = ws.addRow(cells);
    if (i === 0) {
      row.eachCell((cell) => { cell.font = { bold: true }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD3D3D3" } } });
    }
  }

  ws.columns.forEach((col) => { col.width = 20; });
  const buffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: `${safeFilename(req.title)}.xlsx` };
}
