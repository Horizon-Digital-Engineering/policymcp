import type { PolicySection, ParsedDocument } from "../types.js";

// Patterns for detecting section headings
// Using bounded quantifiers to prevent ReDoS attacks
const HEADING_PATTERNS = [
  // Numbered sections: "1.", "1.1", "1.1.1", etc.
  /^(\d+(?:\.\d+){0,5}[.:-]?)\s*([^\n\r]{1,200})$/,
  // Roman numerals: "I.", "II.", etc.
  /^([IVXLC]{1,10}[.:-])\s*([^\n\r]{1,200})$/i,
  // Letter sections: "A.", "B.", etc.
  /^([A-Z][.:-])\s*([^\n\r]{1,200})$/,
  // Multi-letter abbreviations: "ABC Something", "DEF Another"
  /^([A-Z]{2,4})\s+([A-Z][^\n\r]{1,200})$/,
  // ALL CAPS headings
  /^([A-Z][A-Z\s]{3,100})$/,
];

interface HeadingMatch {
  heading: string;
  level: number;
}

/**
 * Try to match a line against heading patterns
 */
function tryMatchHeading(line: string): HeadingMatch | null {
  for (const pattern of HEADING_PATTERNS) {
    const match = pattern.exec(line);
    if (match) {
      return extractHeadingInfo(match);
    }
  }
  return null;
}

/**
 * Extract heading and level from regex match
 */
function extractHeadingInfo(match: RegExpMatchArray): HeadingMatch {
  let heading: string;
  let level = 1;

  if (match[2]) {
    heading = `${match[1]} ${match[2]}`.trim();
    // Determine level from numbering depth (count dots between numbers, not trailing punctuation)
    const numberPart = match[1].replace(/[.:-]$/, "");
    const dots = (numberPart.match(/\./g) || []).length;
    level = dots + 1;
  } else {
    heading = match[1].trim();
  }

  return { heading, level };
}

/**
 * Save the current section if it has content
 */
function saveSection(
  section: PolicySection | null,
  contentBuffer: string[],
  sections: PolicySection[]
): void {
  if (!section) return;

  section.content = contentBuffer.join("\n").trim();
  if (section.content) {
    sections.push(section);
  }
}

/**
 * Extract sections from document content using common heading patterns
 */
export function extractSections(content: string): PolicySection[] {
  const sections: PolicySection[] = [];
  const lines = content.split("\n");

  let currentSection: PolicySection | null = null;
  let contentBuffer: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const headingMatch = tryMatchHeading(trimmedLine);

    if (headingMatch && headingMatch.heading.length > 2 && headingMatch.heading.length < 200) {
      // Save previous section
      saveSection(currentSection, contentBuffer, sections);

      currentSection = {
        heading: headingMatch.heading,
        content: "",
        level: headingMatch.level,
      };
      contentBuffer = [];
    } else if (currentSection) {
      contentBuffer.push(trimmedLine);
    }
  }

  // Don't forget the last section
  saveSection(currentSection, contentBuffer, sections);

  return sections;
}

/**
 * Extract title from document content
 */
export function extractTitle(content: string, filePath: string): string {
  const lines = content.split("\n").filter((l) => l.trim());

  // Try to find a title in the first few lines
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();

    // Skip lines that contain page numbers or other metadata
    if (lowerLine.includes("page ") ||
        lowerLine.startsWith("date") ||
        lowerLine.startsWith("version") ||
        lowerLine.startsWith("effective") ||
        lowerLine.startsWith("revision") ||
        lowerLine.startsWith("rev ")) {
      continue;
    }

    // Look for lines that look like titles
    const isValidLength = line.length > 5 && line.length < 150;
    const startsWithCapital = /^[A-Z]/.test(line);
    const hasMultipleWords = line.split(/\s+/).length >= 2;

    if (isValidLength && startsWithCapital && hasMultipleWords) {
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
    /effective\s{0,5}(?:date)?[:\s]{0,5}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /dated?[:\s]{0,5}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /(\w{3,20}\s+\d{1,2},?\s+\d{4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = pattern.exec(content);
    if (match) {
      metadata.effectiveDate = match[1];
      break;
    }
  }

  // Try to find version
  const versionPatterns = [
    /version[:\s]{0,5}(\d+(?:\.\d+){0,5})/i,
    /rev(?:ision)?[:\s]{0,5}(\d+(?:\.\d+){0,5})/i,
    /v(\d+(?:\.\d+){0,5})/i,
  ];

  for (const pattern of versionPatterns) {
    const match = pattern.exec(content);
    if (match) {
      metadata.version = match[1];
      break;
    }
  }

  return metadata;
}
