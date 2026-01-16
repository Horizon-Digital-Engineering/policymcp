import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("mammoth", () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

vi.mock("jszip", () => ({
  default: {
    loadAsync: vi.fn(),
  },
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

// Import after mocking
import mammoth from "mammoth";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { parseDocx } from "../parsers/docx-parser.js";

describe("docx-parser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseDocx", () => {
    it("should parse a Word document and extract basic information", async () => {
      const mockContent = `Employee Handbook

1. Introduction
Welcome to our company.

2. Code of Conduct
Expected behavior for all employees.`;

      const mockCoreXml = `<?xml version="1.0"?>
<cp:coreProperties xmlns:cp="...">
  <dc:creator>John Doe</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">2025-01-01T10:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2025-01-15T15:30:00Z</dcterms:modified>
</cp:coreProperties>`;

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockContent,
        messages: [],
      });

      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock-buffer"));

      const mockZip = {
        file: vi.fn().mockReturnValue({
          async: vi.fn().mockResolvedValue(mockCoreXml),
        }),
      };
      vi.mocked(JSZip.loadAsync).mockResolvedValue(mockZip as unknown as JSZip);

      const result = await parseDocx("/test/document.docx");

      expect(result.title).toBe("Employee Handbook");
      expect(result.content).toBe(mockContent);
      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].heading).toBe("1. Introduction");
      expect(result.sections[1].heading).toBe("2. Code of Conduct");
      expect(result.metadata.author).toBe("John Doe");
      expect(result.metadata.createdDate).toBe("2025-01-01T10:00:00Z");
      expect(result.metadata.modifiedDate).toBe("2025-01-15T15:30:00Z");
    });

    it("should extract sections with different heading styles", async () => {
      const mockContent = `Policy Document

I. Executive Summary
Overview of the policy

II. Definitions
Key terms explained

A. Technical Terms
Technical definitions`;

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockContent,
        messages: [],
      });

      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock-buffer"));

      const mockZip = {
        file: vi.fn().mockReturnValue({
          async: vi.fn().mockResolvedValue(""),
        }),
      };
      vi.mocked(JSZip.loadAsync).mockResolvedValue(mockZip as unknown as JSZip);

      const result = await parseDocx("/test/policy.docx");

      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].heading).toBe("I. Executive Summary");
      expect(result.sections[1].heading).toBe("II. Definitions");
      expect(result.sections[2].heading).toBe("A. Technical Terms");
    });

    it("should handle Word documents without metadata", async () => {
      const mockContent = `Simple Document

Content here.`;

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockContent,
        messages: [],
      });

      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock-buffer"));

      const mockZip = {
        file: vi.fn().mockReturnValue(null), // No core.xml file
      };
      vi.mocked(JSZip.loadAsync).mockResolvedValue(mockZip as unknown as JSZip);

      const result = await parseDocx("/test/simple.docx");

      expect(result.title).toBe("Simple Document");
      expect(result.content).toBe(mockContent);
      expect(result.metadata.author).toBeUndefined();
      expect(result.metadata.createdDate).toBeUndefined();
    });

    it("should fall back to filename for title if content has no clear title", async () => {
      const mockContent = `page 1
date: 2025-01-15
some content here`;

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockContent,
        messages: [],
      });

      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock-buffer"));

      const mockZip = {
        file: vi.fn().mockReturnValue(null),
      };
      vi.mocked(JSZip.loadAsync).mockResolvedValue(mockZip as unknown as JSZip);

      const result = await parseDocx("/test/my-document.docx");

      expect(result.title).toBe("my-document");
    });

    it("should extract version and effective date from content", async () => {
      const mockContent = `Security Policy

Version: 2.5
Effective Date: 03/15/2025

1. Security Requirements
All systems must be secure.`;

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockContent,
        messages: [],
      });

      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock-buffer"));

      const mockZip = {
        file: vi.fn().mockReturnValue(null),
      };
      vi.mocked(JSZip.loadAsync).mockResolvedValue(mockZip as unknown as JSZip);

      const result = await parseDocx("/test/security.docx");

      expect(result.title).toBe("Security Policy");
      expect(result.metadata.version).toBe("2.5");
      expect(result.metadata.effectiveDate).toBe("03/15/2025");
    });

    it("should handle empty Word documents", async () => {
      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: "",
        messages: [],
      });

      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock-buffer"));

      const mockZip = {
        file: vi.fn().mockReturnValue(null),
      };
      vi.mocked(JSZip.loadAsync).mockResolvedValue(mockZip as unknown as JSZip);

      const result = await parseDocx("/test/empty.docx");

      expect(result.title).toBe("empty");
      expect(result.content).toBe("");
      expect(result.sections).toHaveLength(0);
    });

    it("should handle metadata extraction errors gracefully", async () => {
      const mockContent = `Test Document

Content here.`;

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockContent,
        messages: [],
      });

      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock-buffer"));

      // Simulate JSZip throwing an error
      vi.mocked(JSZip.loadAsync).mockRejectedValue(new Error("Invalid zip"));

      const result = await parseDocx("/test/TestDocument.docx");

      // Should still parse content even if metadata fails
      // Falls back to filename when content extraction doesn't find a valid title
      expect(result.title).toBe("TestDocument");
      expect(result.content).toBe(mockContent);
      // Metadata should be empty when extraction fails
      expect(result.metadata.author).toBeUndefined();
    });
  });
});
