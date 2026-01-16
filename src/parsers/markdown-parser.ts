import { marked } from "marked";
import matter from "gray-matter";
import { readFile } from "node:fs/promises";
import type { ParsedDocument, PolicySection } from "../types.js";
import { extractTitle, extractMetadata } from "./shared.js";

/**
 * Parse a Markdown (.md) file and extract policy content
 */
export async function parseMarkdown(filePath: string): Promise<ParsedDocument> {
  const fileContent = await readFile(filePath, "utf-8");

  // Extract YAML frontmatter
  const { data: frontmatter, content: markdownContent } = matter(fileContent);

  // Convert markdown to plain text for section extraction
  const plainText = await marked.parse(markdownContent, { async: true });
  const strippedText = stripHtmlTags(plainText);

  // Extract sections from markdown headings
  const sections = extractMarkdownSections(markdownContent);

  // Title from frontmatter or first heading or extracted from content
  const title =
    frontmatter.title || extractTitle(strippedText, filePath);

  const baseMetadata = extractMetadata(strippedText);

  // Metadata from YAML frontmatter
  // Convert Date objects to ISO strings
  const toISOString = (value: unknown): string | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    // For other types, attempt safe conversion
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return undefined; // Skip objects that don't have a meaningful string representation
  };

  const metadata: ParsedDocument["metadata"] = {
    ...baseMetadata,
    effectiveDate:
      toISOString(frontmatter.effectiveDate || frontmatter.date) ||
      baseMetadata.effectiveDate,
    version: frontmatter.version || baseMetadata.version,
    author: frontmatter.author,
    createdDate: toISOString(frontmatter.date || frontmatter.created),
    modifiedDate: toISOString(frontmatter.updated || frontmatter.modified),
  };

  return {
    title,
    content: strippedText,
    sections,
    metadata,
  };
}

/**
 * Save markdown section if it has content
 */
function saveMarkdownSection(
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
 * Extract sections from markdown headings
 */
function extractMarkdownSections(markdown: string): PolicySection[] {
  const sections: PolicySection[] = [];
  const lines = markdown.split("\n");
  // Use lazy quantifier +? instead of + to prevent ReDoS
  const headingRegex = /^(#{1,6})\s+(.+?)$/;

  let currentSection: PolicySection | null = null;
  let contentBuffer: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Match markdown headings: # H1, ## H2, etc.
    const headingMatch = headingRegex.exec(trimmedLine);

    if (headingMatch) {
      // Save previous section
      saveMarkdownSection(currentSection, contentBuffer, sections);

      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim();

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
  saveMarkdownSection(currentSection, contentBuffer, sections);

  return sections;
}

/**
 * Strip HTML tags from text
 */
function stripHtmlTags(html: string): string {
  return html
    .replaceAll(/<[^>]*>/g, "") // Remove HTML tags
    .replaceAll("&nbsp;", " ") // Replace &nbsp; with space
    .replaceAll("&lt;", "<") // Replace &lt; with <
    .replaceAll("&gt;", ">") // Replace &gt; with >
    .replaceAll("&amp;", "&") // Replace &amp; with &
    .replaceAll("&quot;", '"') // Replace &quot; with "
    .replaceAll("&#39;", "'") // Replace &#39; with '
    .replaceAll(/\n\n+/g, "\n\n") // Collapse multiple newlines
    .trim();
}
