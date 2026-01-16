import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import type { ParsedDocument } from "../types.js";
import { extractSections, extractTitle, extractMetadata } from "./shared.js";

/**
 * Parse a PDF file and extract policy content
 */
export async function parsePDF(filePath: string): Promise<ParsedDocument> {
  const dataBuffer = await readFile(filePath);

  // Initialize pdf-parse v2 with the buffer
  const parser = new PDFParse({ data: dataBuffer });

  // Extract text from all pages
  const textResult = await parser.getText();
  const content = textResult.text;

  // Extract metadata to get page count and document info
  const infoResult = await parser.getInfo();
  const pageCount = infoResult.total;

  // Extract document properties (author, dates) if available
  const info = infoResult.info || {};

  // Clean up parser
  await parser.destroy();

  const sections = extractSections(content);
  const title = extractTitle(content, filePath);
  const metadata = extractMetadata(content, pageCount);

  // Add PDF-specific metadata (author and dates from PDF properties)
  if (info.Author) {
    metadata.author = info.Author;
  }
  if (info.CreationDate) {
    metadata.createdDate = parsePDFDate(info.CreationDate);
  }
  if (info.ModDate) {
    metadata.modifiedDate = parsePDFDate(info.ModDate);
  }

  return {
    title,
    content,
    sections,
    metadata,
  };
}

/**
 * Parse PDF date format (D:YYYYMMDDHHmmSS) to ISO string
 */
function parsePDFDate(pdfDate: string): string | undefined {
  if (!pdfDate || typeof pdfDate !== "string") return undefined;

  // PDF date format: D:YYYYMMDDHHmmSS+HH'mm'
  const dateRegex = /^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/;
  const match = dateRegex.exec(pdfDate);
  if (!match) return pdfDate; // Return as-is if not in expected format

  const [, year, month, day, hour, minute, second] = match;
  try {
    const date = new Date(
      Number.parseInt(year, 10),
      Number.parseInt(month, 10) - 1,
      Number.parseInt(day, 10),
      Number.parseInt(hour, 10),
      Number.parseInt(minute, 10),
      Number.parseInt(second, 10)
    );
    return date.toISOString();
  } catch {
    return pdfDate; // Return original if parsing fails
  }
}
