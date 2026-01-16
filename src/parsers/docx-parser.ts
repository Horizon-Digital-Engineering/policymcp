import mammoth from "mammoth";
import { readFile } from "node:fs/promises";
import type { ParsedDocument } from "../types.js";
import { extractSections, extractTitle, extractMetadata } from "./shared.js";

/**
 * Parse a Word (.docx) file and extract policy content
 */
export async function parseDocx(filePath: string): Promise<ParsedDocument> {
  // Extract plain text with mammoth
  const result = await mammoth.extractRawText({ path: filePath });
  const content = result.value;

  // Extract metadata using docx library
  const buffer = await readFile(filePath);
  const metadata = await extractDocxMetadata(buffer);

  // Reuse shared extraction helpers
  const sections = extractSections(content);
  const title = extractTitle(content, filePath);
  const baseMetadata = extractMetadata(content);

  return {
    title,
    content,
    sections,
    metadata: {
      ...baseMetadata,
      ...metadata,
    },
  };
}

/**
 * Extract metadata from Word document
 */
async function extractDocxMetadata(
  buffer: Buffer
): Promise<ParsedDocument["metadata"]> {
  try {
    // Dynamic import to avoid bundling issues
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);

    // Read core.xml which contains document properties
    const coreXml = await zip.file("docProps/core.xml")?.async("text");
    if (!coreXml) return {};

    const metadata: ParsedDocument["metadata"] = {};

    // Extract creator/author
    const creatorRegex = /<dc:creator>([^<]+)<\/dc:creator>/;
    const creatorMatch = creatorRegex.exec(coreXml);
    if (creatorMatch) {
      metadata.author = creatorMatch[1];
    }

    // Extract creation date
    const createdRegex = /<dcterms:created[^>]*>([^<]+)<\/dcterms:created>/;
    const createdMatch = createdRegex.exec(coreXml);
    if (createdMatch) {
      metadata.createdDate = createdMatch[1];
    }

    // Extract modified date
    const modifiedRegex = /<dcterms:modified[^>]*>([^<]+)<\/dcterms:modified>/;
    const modifiedMatch = modifiedRegex.exec(coreXml);
    if (modifiedMatch) {
      metadata.modifiedDate = modifiedMatch[1];
    }

    return metadata;
  } catch (error) {
    // If metadata extraction fails, return empty object
    console.error("Failed to extract Word metadata:", error);
    return {};
  }
}
