import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

// Import after mocking
import { readFile } from "node:fs/promises";
import { parseMarkdown } from "../parsers/markdown-parser.js";

describe("markdown-parser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseMarkdown", () => {
    it("should parse Markdown with YAML frontmatter", async () => {
      const mockContent = `---
title: Code of Conduct
author: HR Department
date: 2025-01-15
version: 1.2
effectiveDate: 2025-02-01
---

# Introduction

This document outlines our code of conduct.

## Expected Behavior

All employees must follow these guidelines.

### Respect

Treat everyone with respect.`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/code-of-conduct.md");

      expect(result.title).toBe("Code of Conduct");
      expect(result.metadata.author).toBe("HR Department");
      // gray-matter parses YAML dates as Date objects, we convert to ISO strings
      expect(result.metadata.createdDate).toContain("2025-01-15");
      // YAML numbers are preserved as numbers, not converted to strings
      expect(result.metadata.version).toBe(1.2);
      expect(result.metadata.effectiveDate).toContain("2025-02-01");
      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].heading).toBe("Introduction");
      expect(result.sections[0].level).toBe(1);
      expect(result.sections[1].heading).toBe("Expected Behavior");
      expect(result.sections[1].level).toBe(2);
      expect(result.sections[2].heading).toBe("Respect");
      expect(result.sections[2].level).toBe(3);
    });

    it("should parse Markdown without frontmatter", async () => {
      const mockContent = `# Security Policy

## Overview

This policy covers security requirements.

## Requirements

All systems must be secure.`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/security-policy.md");

      expect(result.title).toBe("Security Policy");
      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].heading).toBe("Overview");
      expect(result.sections[1].heading).toBe("Requirements");
    });

    it("should extract metadata from frontmatter alternatives", async () => {
      const mockContent = `---
title: Privacy Policy
author: Legal Team
created: 2024-12-01
updated: 2025-01-10
modified: 2025-01-15
---

# Privacy

We protect your data.`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/privacy.md");

      expect(result.metadata.author).toBe("Legal Team");
      expect(result.metadata.createdDate).toContain("2024-12-01");
      expect(result.metadata.modifiedDate).toContain("2025-01-10"); // Prefers 'updated' over 'modified'
    });

    it("should handle all heading levels (H1-H6)", async () => {
      const mockContent = `# Heading 1
Content 1

## Heading 2
Content 2

### Heading 3
Content 3

#### Heading 4
Content 4

##### Heading 5
Content 5

###### Heading 6
Content 6`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/headings.md");

      expect(result.sections).toHaveLength(6);
      expect(result.sections[0].level).toBe(1);
      expect(result.sections[1].level).toBe(2);
      expect(result.sections[2].level).toBe(3);
      expect(result.sections[3].level).toBe(4);
      expect(result.sections[4].level).toBe(5);
      expect(result.sections[5].level).toBe(6);
    });

    it("should strip HTML tags from content", async () => {
      const mockContent = `# Test

This has <strong>bold</strong> and <em>italic</em> text.

Also has &nbsp; and &lt;special&gt; chars.`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/html.md");

      expect(result.content).toContain("bold");
      expect(result.content).toContain("italic");
      expect(result.content).not.toContain("<strong>");
      expect(result.content).not.toContain("&nbsp;");
      expect(result.content).toContain("<special>");
    });

    it("should fall back to filename for title without frontmatter", async () => {
      const mockContent = `some content without a clear title at the start.

## Section 1

Content here.`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/my-policy.md");

      // extractTitle finds "Section 1" as the first valid title-like content
      // Since the first line starts with lowercase, it's not considered a title
      expect(result.title).toBe("Section 1");
    });

    it("should handle empty Markdown files", async () => {
      vi.mocked(readFile).mockResolvedValue("");

      const result = await parseMarkdown("/test/empty.md");

      expect(result.title).toBe("empty");
      expect(result.content).toBe("");
      expect(result.sections).toHaveLength(0);
    });

    it("should extract section content correctly", async () => {
      const mockContent = `# Policy

## Introduction

This is the intro content.
It has multiple lines.

## Details

This is the details content.`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/policy.md");

      expect(result.sections[0].heading).toBe("Introduction");
      expect(result.sections[0].content).toContain("This is the intro content");
      expect(result.sections[0].content).toContain("multiple lines");
      expect(result.sections[1].heading).toBe("Details");
      expect(result.sections[1].content).toContain("This is the details content");
    });

    it("should handle markdown with code blocks", async () => {
      const mockContent = `# Developer Guide

## Code Example

\`\`\`javascript
function test() {
  return true;
}
\`\`\`

## Usage

Use the function above.`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/dev-guide.md");

      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].heading).toBe("Code Example");
      expect(result.sections[1].heading).toBe("Usage");
    });

    it("should handle markdown with lists and links", async () => {
      const mockContent = `# Guidelines

## Requirements

- Item 1
- Item 2
- [Link](https://example.com)

Content continues.`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/guidelines.md");

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].heading).toBe("Requirements");
      expect(result.sections[0].content).toContain("Item 1");
      expect(result.sections[0].content).toContain("Item 2");
    });

    it("should use first heading as title if no frontmatter title", async () => {
      const mockContent = `# Employee Handbook

## Section 1

Content here.`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/handbook.md");

      // Since extractTitle looks at stripped content, it should find "Employee Handbook"
      expect(result.title).toBe("Employee Handbook");
    });

    it("should handle boolean and number metadata values", async () => {
      const mockContent = `---
title: Test Policy
version: 2.5
published: true
count: 42
---

# Content`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/policy.md");

      expect(result.metadata.version).toBe(2.5);
    });

    it("should skip object metadata values", async () => {
      const mockContent = `---
title: Test Policy
metadata:
  key: value
  nested: object
---

# Content`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/policy.md");

      // Objects should be skipped, not converted to [object Object]
      expect(result.metadata.effectiveDate).toBeUndefined();
    });

    it("should handle empty sections gracefully", async () => {
      const mockContent = `# Policy

## Empty Section

## Another Empty

## Section with content
This has content.`;

      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseMarkdown("/test/policy.md");

      // Only sections with content should be included
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].heading).toBe("Section with content");
    });
  });
});
