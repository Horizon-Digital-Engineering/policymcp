import type { PolicySection, ParsedDocument } from "../types.js";

/**
 * Extract sections from document content using common heading patterns
 */
export function extractSections(content: string): PolicySection[] {
  const sections: PolicySection[] = [];
  const lines = content.split("\n");

  // Patterns for detecting section headings
  const headingPatterns = [
    // Numbered sections: "1.", "1.1", "1.1.1", etc.
    /^(\d+(?:\.\d+){0,5}[.:-]?)\s*([^\n]+)$/,
    // Roman numerals: "I.", "II.", etc.
    /^([IVXLC]{1,10}[.:-])\s*([^\n]+)$/i,
    // Letter sections: "A.", "B.", etc.
    /^([A-Z][.:-])\s*([^\n]+)$/,
    // Multi-letter abbreviations: "ABC Something", "DEF Another"
    /^([A-Z]{2,4})\s+([A-Z][^\n]+)$/,
    // ALL CAPS headings
    /^([A-Z][A-Z\s]{3,100})$/,
  ];

  let currentSection: PolicySection | null = null;
  let contentBuffer: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    let isHeading = false;
    let heading = "";
    let level = 1;

    for (const pattern of headingPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        isHeading = true;
        if (match[2]) {
          heading = `${match[1]} ${match[2]}`.trim();
          // Determine level from numbering depth (count dots between numbers, not trailing punctuation)
          const numberPart = match[1].replace(/[.:-]$/, ""); // Remove trailing punctuation
          const dots = (numberPart.match(/\./g) || []).length;
          level = dots + 1;
        } else {
          heading = match[1].trim();
        }
        break;
      }
    }

    if (isHeading && heading.length > 2 && heading.length < 200) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentBuffer.join("\n").trim();
        if (currentSection.content) {
          sections.push(currentSection);
        }
      }

      currentSection = {
        heading,
        content: "",
        level,
      };
      contentBuffer = [];
    } else if (currentSection) {
      contentBuffer.push(trimmedLine);
    }
  }

  // Don't forget the last section
  if (currentSection) {
    currentSection.content = contentBuffer.join("\n").trim();
    if (currentSection.content) {
      sections.push(currentSection);
    }
  }

  return sections;
}

/**
 * Extract title from document content
 */
export function extractTitle(content: string, filePath: string): string {
  const lines = content.split("\n").filter((l) => l.trim());

  // Try to find a title in the first few lines
  const metadataPattern =
    /^(page|date|version|effective|revision|rev|dated|some|test|content)/i;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    // Look for lines that look like titles (not metadata, should start with capital, not too generic)
    if (
      line.length > 5 &&
      line.length < 150 &&
      !metadataPattern.exec(line) &&
      line[0] === line[0].toUpperCase()
    ) {
      return line;
    }
  }

  // Fallback to filename
  const fileName = filePath.split("/").pop() || filePath;
  return fileName.replace(/\.(pdf|docx|md)$/i, "");
}

/**
 * Extract metadata from document content
 */
export function extractMetadata(
  content: string,
  pageCount?: number
): ParsedDocument["metadata"] {
  const metadata: ParsedDocument["metadata"] = {};

  if (pageCount !== undefined) {
    metadata.pageCount = pageCount;
  }

  // Try to find effective date
  const datePatterns = [
    /effective\s*(?:date)?[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /dated?[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /(\w+\s+\d{1,2},?\s+\d{4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match) {
      metadata.effectiveDate = match[1];
      break;
    }
  }

  // Try to find version
  const versionPatterns = [
    /version[:\s]*(\d+(?:\.\d+)*)/i,
    /rev(?:ision)?[:\s]*(\d+(?:\.\d+)*)/i,
    /v(\d+(?:\.\d+)*)/i,
  ];

  for (const pattern of versionPatterns) {
    const match = content.match(pattern);
    if (match) {
      metadata.version = match[1];
      break;
    }
  }

  return metadata;
}
