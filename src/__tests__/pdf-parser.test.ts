import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs/promises and pdf-parse
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn(),
}));

// Import after mocking
import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import { parsePDF } from "../pdf-parser.js";

interface MockPDFParser {
  getText: ReturnType<typeof vi.fn>;
  getInfo: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

describe("pdf-parser", () => {
  // Helper function to create mock parser instance
  const createMockParser = (text: string, pageCount: number): MockPDFParser => ({
    getText: vi.fn().mockResolvedValue({ text }),
    getInfo: vi.fn().mockResolvedValue({ total: pageCount }),
    destroy: vi.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parsePDF", () => {
    it("should parse a PDF file and extract basic information", async () => {
      const mockContent = `Simple Company Encryption Standard

Effective Date: 01/15/2025
Version 1.0

1. PURPOSE
This policy defines encryption standards.

2. SCOPE
This applies to all employees.`;

      const mockParser = createMockParser(mockContent, 5);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) {
        return mockParser as MockPDFParser;
      });

      const result = await parsePDF("/test/path.pdf");

      expect(result.title).toBe("Simple Company Encryption Standard");
      expect(result.content).toBe(mockContent);
      expect(result.sections).toHaveLength(2);
      expect(result.metadata.pageCount).toBe(5);
      expect(result.metadata.effectiveDate).toBe("01/15/2025");
      expect(result.metadata.version).toBe("1.0");
    });

    it("should extract numbered sections with multiple levels", async () => {
      const mockContent = `Test Policy

1. First Section
Content of first section

1.1 Subsection One
Content of subsection

1.1.1 Deep Subsection
Deep content

2. Second Section
Content of second section`;

      const mockParser = createMockParser(mockContent, 1);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

      const result = await parsePDF("/test/path.pdf");

      expect(result.sections).toHaveLength(4);
      expect(result.sections[0].heading).toBe("1. First Section");
      expect(result.sections[0].level).toBe(1);
      expect(result.sections[1].heading).toBe("1.1 Subsection One");
      expect(result.sections[1].level).toBe(2);
      expect(result.sections[2].heading).toBe("1.1.1 Deep Subsection");
      expect(result.sections[2].level).toBe(3);
      expect(result.sections[3].heading).toBe("2. Second Section");
      expect(result.sections[3].level).toBe(1);
    });

    it("should extract Roman numeral sections", async () => {
      const mockContent = `Test Policy

I. First Section
Content here

II. Second Section
More content

III. Third Section
Even more content`;

      const mockParser = createMockParser(mockContent, 1);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

      const result = await parsePDF("/test/path.pdf");

      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].heading).toBe("I. First Section");
      expect(result.sections[1].heading).toBe("II. Second Section");
      expect(result.sections[2].heading).toBe("III. Third Section");
    });

    it("should extract ALL CAPS headings", async () => {
      const mockContent = `Test Policy

PURPOSE AND SCOPE
This section defines the purpose.

DEFINITIONS
Terms used in this policy.

RESPONSIBILITIES
Who is responsible.`;

      const mockParser = createMockParser(mockContent, 1);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

      const result = await parsePDF("/test/path.pdf");

      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].heading).toBe("PURPOSE AND SCOPE");
      expect(result.sections[1].heading).toBe("DEFINITIONS");
      expect(result.sections[2].heading).toBe("RESPONSIBILITIES");
    });

    it("should extract letter sections", async () => {
      const mockContent = `Test Policy

A. First Point
Content of first point

B. Second Point
Content of second point

C. Third Point
Content of third point`;

      const mockParser = createMockParser(mockContent, 1);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

      const result = await parsePDF("/test/path.pdf");

      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].heading).toBe("A. First Point");
      expect(result.sections[1].heading).toBe("B. Second Point");
      expect(result.sections[2].heading).toBe("C. Third Point");
    });

    it("should extract title from first non-metadata line", async () => {
      const mockContent = `Company Security Policy
Version 2.0
Effective: 2025-01-01

1. Introduction
Content here`;

      const mockParser = createMockParser(mockContent, 1);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

      const result = await parsePDF("/test/path.pdf");

      expect(result.title).toBe("Company Security Policy");
    });

    it("should fallback to filename when no clear title found", async () => {
      const mockContent = `page 1
date: 2025-01-01

Some content without a clear title`;

      const mockParser = createMockParser(mockContent, 1);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

      const result = await parsePDF("/path/to/my-policy.pdf");

      expect(result.title).toBe("my-policy");
    });

    it("should extract effective date in various formats", async () => {
      const testCases = [
        { content: "Effective Date: 01/15/2025", expected: "01/15/2025" },
        { content: "Effective: 1-15-2025", expected: "1-15-2025" },
        { content: "Dated: 01/15/2025", expected: "01/15/2025" },
        { content: "January 15, 2025", expected: "January 15, 2025" },
      ];

      for (const testCase of testCases) {
        const mockParser = createMockParser(testCase.content, 1);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

        const result = await parsePDF("/test/path.pdf");
        expect(result.metadata.effectiveDate).toBe(testCase.expected);
      }
    });

    it("should extract version numbers in various formats", async () => {
      const testCases = [
        { content: "Version: 1.0", expected: "1.0" },
        { content: "Version 2.5.1", expected: "2.5.1" },
        { content: "Revision: 3", expected: "3" },
        { content: "Rev 4.2", expected: "4.2" },
        { content: "v1.2.3", expected: "1.2.3" },
      ];

      for (const testCase of testCases) {
        const mockParser = createMockParser(testCase.content, 1);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

        const result = await parsePDF("/test/path.pdf");
        expect(result.metadata.version).toBe(testCase.expected);
      }
    });

    it("should handle PDFs with no sections", async () => {
      const mockContent = `Just some plain text content
without any section headings
or structure`;

      const mockParser = createMockParser(mockContent, 1);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

      const result = await parsePDF("/test/path.pdf");

      expect(result.sections).toHaveLength(0);
      expect(result.content).toBe(mockContent);
    });

    it("should handle empty PDF content", async () => {
      const mockParser = createMockParser("", 0);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

      const result = await parsePDF("/test/path.pdf");

      expect(result.content).toBe("");
      expect(result.sections).toHaveLength(0);
      expect(result.metadata.pageCount).toBe(0);
    });

    it("should filter out headings that are too short or too long", async () => {
      const mockContent = `Test Policy

A
This heading is too short (1 char)

AB
This is also too short (2 chars)

ABC Valid Heading
This should be captured

${"A".repeat(250)}
This heading is way too long and should be ignored

Regular content here`;

      const mockParser = createMockParser(mockContent, 1);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

      const result = await parsePDF("/test/path.pdf");

      // Only the valid heading should be captured
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].heading).toContain("ABC Valid Heading");
    });

    it("should handle sections with no content", async () => {
      const mockContent = `Test Policy

1. First Section

2. Second Section

3. Third Section
This one has content`;

      const mockParser = createMockParser(mockContent, 1);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

      const result = await parsePDF("/test/path.pdf");

      // Only sections with content should be included
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].heading).toBe("3. Third Section");
      expect(result.sections[0].content).toBe("This one has content");
    });

    it("should handle file read errors", async () => {
      vi.mocked(readFile).mockRejectedValue(
        new Error("File not found")
      );

      await expect(parsePDF("/nonexistent/path.pdf")).rejects.toThrow(
        "File not found"
      );
    });

    it("should handle PDF parsing errors", async () => {
      const mockParser = {
        getText: vi.fn().mockRejectedValue(new Error("Invalid PDF")),
        getInfo: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(readFile).mockResolvedValue(Buffer.from("mock"));
      vi.mocked(PDFParse).mockImplementation(function(this: unknown) { return mockParser as MockPDFParser; });

      await expect(parsePDF("/test/invalid.pdf")).rejects.toThrow(
        "Invalid PDF"
      );
    });
  });
});
