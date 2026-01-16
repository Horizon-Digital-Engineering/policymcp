import { describe, it, expect, vi } from "vitest";

// Mock all parser modules
vi.mock("../parsers/pdf-parser.js", () => ({
  parsePDF: vi.fn(),
}));

vi.mock("../parsers/docx-parser.js", () => ({
  parseDocx: vi.fn(),
}));

vi.mock("../parsers/markdown-parser.js", () => ({
  parseMarkdown: vi.fn(),
}));

// Import after mocking
import { parseDocument, getMimeTypeFromExtension } from "../parsers/index.js";
import { parsePDF } from "../parsers/pdf-parser.js";
import { parseDocx } from "../parsers/docx-parser.js";
import { parseMarkdown } from "../parsers/markdown-parser.js";

describe("parser-router", () => {
  describe("getMimeTypeFromExtension", () => {
    it("should detect PDF files", () => {
      expect(getMimeTypeFromExtension("/path/to/file.pdf")).toBe(
        "application/pdf"
      );
      expect(getMimeTypeFromExtension("/path/to/FILE.PDF")).toBe(
        "application/pdf"
      );
    });

    it("should detect Word (.docx) files", () => {
      expect(getMimeTypeFromExtension("/path/to/file.docx")).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      expect(getMimeTypeFromExtension("/path/to/FILE.DOCX")).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    });

    it("should detect Markdown files", () => {
      expect(getMimeTypeFromExtension("/path/to/file.md")).toBe(
        "text/markdown"
      );
      expect(getMimeTypeFromExtension("/path/to/file.markdown")).toBe(
        "text/markdown"
      );
      expect(getMimeTypeFromExtension("/path/to/FILE.MD")).toBe(
        "text/markdown"
      );
    });

    it("should throw error for unsupported extensions", () => {
      expect(() => getMimeTypeFromExtension("/path/to/file.txt")).toThrow(
        "Unsupported file extension: txt"
      );
      expect(() => getMimeTypeFromExtension("/path/to/file.doc")).toThrow(
        "Unsupported file extension: doc"
      );
      expect(() => getMimeTypeFromExtension("/path/to/file.html")).toThrow(
        "Unsupported file extension: html"
      );
    });

    it("should handle files without extensions", () => {
      expect(() => getMimeTypeFromExtension("/path/to/file")).toThrow(
        /Unsupported file extension/
      );
    });
  });

  describe("parseDocument", () => {
    it("should route PDF files to parsePDF", async () => {
      const mockResult = {
        title: "Test PDF",
        content: "Content",
        sections: [],
        metadata: { pageCount: 1 },
      };

      vi.mocked(parsePDF).mockResolvedValue(mockResult);

      const result = await parseDocument("/test.pdf", "application/pdf");

      expect(parsePDF).toHaveBeenCalledWith("/test.pdf");
      expect(result).toBe(mockResult);
    });

    it("should route Word files to parseDocx", async () => {
      const mockResult = {
        title: "Test Word",
        content: "Content",
        sections: [],
        metadata: {},
      };

      vi.mocked(parseDocx).mockResolvedValue(mockResult);

      const result = await parseDocument(
        "/test.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );

      expect(parseDocx).toHaveBeenCalledWith("/test.docx");
      expect(result).toBe(mockResult);
    });

    it("should route Markdown files to parseMarkdown", async () => {
      const mockResult = {
        title: "Test Markdown",
        content: "Content",
        sections: [],
        metadata: {},
      };

      vi.mocked(parseMarkdown).mockResolvedValue(mockResult);

      const result1 = await parseDocument("/test.md", "text/markdown");
      const result2 = await parseDocument(
        "/test.markdown",
        "text/x-markdown"
      );

      expect(parseMarkdown).toHaveBeenCalledWith("/test.md");
      expect(parseMarkdown).toHaveBeenCalledWith("/test.markdown");
      expect(result1).toBe(mockResult);
      expect(result2).toBe(mockResult);
    });

    it("should throw error for unsupported MIME types", async () => {
      await expect(
        parseDocument("/test.txt", "text/plain")
      ).rejects.toThrow("Unsupported file type: text/plain");

      await expect(
        parseDocument("/test.html", "text/html")
      ).rejects.toThrow("Unsupported file type: text/html");

      await expect(
        parseDocument("/test.json", "application/json")
      ).rejects.toThrow("Unsupported file type: application/json");
    });

    it("should propagate errors from underlying parsers", async () => {
      const testError = new Error("PDF parsing failed");
      vi.mocked(parsePDF).mockRejectedValue(testError);

      await expect(
        parseDocument("/test.pdf", "application/pdf")
      ).rejects.toThrow("PDF parsing failed");
    });
  });

  describe("integration", () => {
    it("should work with getMimeTypeFromExtension and parseDocument together", async () => {
      const mockResult = {
        title: "Integration Test",
        content: "Content",
        sections: [],
        metadata: {},
      };

      vi.mocked(parsePDF).mockResolvedValue(mockResult);

      const filePath = "/documents/policy.pdf";
      const mimeType = getMimeTypeFromExtension(filePath);
      const result = await parseDocument(filePath, mimeType);

      expect(mimeType).toBe("application/pdf");
      expect(parsePDF).toHaveBeenCalledWith(filePath);
      expect(result).toBe(mockResult);
    });
  });
});
