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
    const creatorMatch = coreXml.match(/<dc:creator>([^<]+)<\/dc:creator>/);
    if (creatorMatch) {
      metadata.author = creatorMatch[1];
    }

    // Extract creation date
    const createdMatch = coreXml.match(
      /<dcterms:created[^>]*>([^<]+)<\/dcterms:created>/
    );
    if (createdMatch) {
      metadata.createdDate = createdMatch[1];
    }

    // Extract modified date
    const modifiedMatch = coreXml.match(
      /<dcterms:modified[^>]*>([^<]+)<\/dcterms:modified>/
    );
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
