import type { ParsedDocument } from "../types.js";
import { parsePDF } from "./pdf-parser.js";
import { parseDocx } from "./docx-parser.js";
import { parseMarkdown } from "./markdown-parser.js";

/**
 * Supported MIME types for document parsing
 */
export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/markdown",
  "text/x-markdown",
] as const;

/**
 * Parse a document based on its MIME type
 */
export async function parseDocument(
  filePath: string,
  mimeType: string
): Promise<ParsedDocument> {
  switch (mimeType) {
    case "application/pdf":
      return parsePDF(filePath);

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return parseDocx(filePath);

    case "text/markdown":
    case "text/x-markdown":
      return parseMarkdown(filePath);

    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

/**
 * Detect MIME type from file extension
 */
export function getMimeTypeFromExtension(filePath: string): string {
  const ext = filePath.toLowerCase().split(".").pop();

  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "md":
    case "markdown":
      return "text/markdown";
    default:
      throw new Error(`Unsupported file extension: ${ext}`);
  }
}

// Re-export individual parsers for testing
export { parsePDF } from "./pdf-parser.js";
export { parseDocx } from "./docx-parser.js";
export { parseMarkdown } from "./markdown-parser.js";
