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
    return String(value);
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
 * Extract sections from markdown headings
 */
function extractMarkdownSections(markdown: string): PolicySection[] {
  const sections: PolicySection[] = [];
  const lines = markdown.split("\n");

  let currentSection: PolicySection | null = null;
  let contentBuffer: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Match markdown headings: # H1, ## H2, etc.
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentBuffer.join("\n").trim();
        if (currentSection.content) {
          sections.push(currentSection);
        }
      }

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
  if (currentSection) {
    currentSection.content = contentBuffer.join("\n").trim();
    if (currentSection.content) {
      sections.push(currentSection);
    }
  }

  return sections;
}

/**
 * Strip HTML tags from text
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ") // Replace &nbsp; with space
    .replace(/&lt;/g, "<") // Replace &lt; with <
    .replace(/&gt;/g, ">") // Replace &gt; with >
    .replace(/&amp;/g, "&") // Replace &amp; with &
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .replace(/\n\n+/g, "\n\n") // Collapse multiple newlines
    .trim();
}
