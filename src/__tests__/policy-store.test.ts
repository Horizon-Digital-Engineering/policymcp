import { describe, it, expect, beforeEach } from "vitest";
import { PolicyStore } from "../policy-store.js";
import type { ParsedPDF, PolicySection } from "../types.js";

describe("PolicyStore", () => {
  let store: PolicyStore;

  const createMockParsedPDF = (
    title: string,
    content: string,
    sections: PolicySection[] = []
  ): ParsedPDF => ({
    title,
    content,
    sections,
    metadata: {
      pageCount: 1,
      effectiveDate: "2025-01-01",
      version: "1.0",
    },
  });

  beforeEach(() => {
    store = new PolicyStore();
  });

  describe("addPolicy", () => {
    it("should add a policy and return it with a UUID", () => {
      const parsedPDF = createMockParsedPDF(
        "Test Policy",
        "Test content"
      );

      const policy = store.addPolicy(parsedPDF, "test.pdf");

      expect(policy.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(policy.title).toBe("Test Policy");
      expect(policy.content).toBe("Test content");
      expect(policy.sourceFile).toBe("test.pdf");
      expect(policy.extractedAt).toBeInstanceOf(Date);
    });

    it("should store policy metadata correctly", () => {
      const parsedPDF = createMockParsedPDF(
        "Security Policy",
        "Content here"
      );

      const policy = store.addPolicy(parsedPDF, "security.pdf", "security");

      expect(policy.effectiveDate).toBe("2025-01-01");
      expect(policy.version).toBe("1.0");
      expect(policy.category).toBe("security");
    });

    it("should store policy sections", () => {
      const sections: PolicySection[] = [
        { heading: "1. Introduction", content: "Intro text", level: 1 },
        { heading: "2. Scope", content: "Scope text", level: 1 },
      ];

      const parsedPDF = createMockParsedPDF(
        "Test Policy",
        "Content",
        sections
      );

      const policy = store.addPolicy(parsedPDF, "test.pdf");

      expect(policy.sections).toHaveLength(2);
      expect(policy.sections[0].heading).toBe("1. Introduction");
      expect(policy.sections[1].heading).toBe("2. Scope");
    });

    it("should handle policies without categories", () => {
      const parsedPDF = createMockParsedPDF("Test", "Content");

      const policy = store.addPolicy(parsedPDF, "test.pdf");

      expect(policy.category).toBeUndefined();
    });

    it("should generate unique IDs for each policy", () => {
      const parsedPDF1 = createMockParsedPDF("Policy 1", "Content 1");
      const parsedPDF2 = createMockParsedPDF("Policy 2", "Content 2");

      const policy1 = store.addPolicy(parsedPDF1, "test1.pdf");
      const policy2 = store.addPolicy(parsedPDF2, "test2.pdf");

      expect(policy1.id).not.toBe(policy2.id);
    });
  });

  describe("getPolicy", () => {
    it("should retrieve a policy by ID", () => {
      const parsedPDF = createMockParsedPDF("Test Policy", "Content");
      const added = store.addPolicy(parsedPDF, "test.pdf");

      const retrieved = store.getPolicy(added.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(added.id);
      expect(retrieved?.title).toBe("Test Policy");
    });

    it("should return undefined for non-existent ID", () => {
      const result = store.getPolicy("non-existent-id");

      expect(result).toBeUndefined();
    });
  });

  describe("getAllPolicies", () => {
    it("should return empty array when no policies exist", () => {
      const policies = store.getAllPolicies();

      expect(policies).toEqual([]);
    });

    it("should return all policies", () => {
      store.addPolicy(createMockParsedPDF("Policy 1", "Content 1"), "1.pdf");
      store.addPolicy(createMockParsedPDF("Policy 2", "Content 2"), "2.pdf");
      store.addPolicy(createMockParsedPDF("Policy 3", "Content 3"), "3.pdf");

      const policies = store.getAllPolicies();

      expect(policies).toHaveLength(3);
    });
  });

  describe("listPolicies", () => {
    beforeEach(() => {
      store.addPolicy(
        createMockParsedPDF(
          "Security Policy",
          "Security content",
          [
            { heading: "1. Intro", content: "Text", level: 1 },
            { heading: "2. Scope", content: "Text", level: 1 },
          ]
        ),
        "security.pdf",
        "security"
      );

      store.addPolicy(
        createMockParsedPDF(
          "HR Policy",
          "HR content",
          [{ heading: "1. Overview", content: "Text", level: 1 }]
        ),
        "hr.pdf",
        "hr"
      );

      store.addPolicy(
        createMockParsedPDF("Another Security", "More security"),
        "security2.pdf",
        "security"
      );
    });

    it("should return summaries of all policies", () => {
      const summaries = store.listPolicies();

      expect(summaries).toHaveLength(3);
      expect(summaries[0]).toHaveProperty("id");
      expect(summaries[0]).toHaveProperty("title");
      expect(summaries[0]).toHaveProperty("sourceFile");
      expect(summaries[0]).toHaveProperty("sectionCount");
      expect(summaries[0]).toHaveProperty("extractedAt");
    });

    it("should include correct section counts", () => {
      const summaries = store.listPolicies();

      const securityPolicy = summaries.find(
        (s) => s.title === "Security Policy"
      );
      const hrPolicy = summaries.find((s) => s.title === "HR Policy");

      expect(securityPolicy?.sectionCount).toBe(2);
      expect(hrPolicy?.sectionCount).toBe(1);
    });

    it("should filter by category (case insensitive)", () => {
      const securityPolicies = store.listPolicies("security");

      expect(securityPolicies).toHaveLength(2);
      expect(securityPolicies[0].category).toBe("security");
      expect(securityPolicies[1].category).toBe("security");
    });

    it("should handle category filter with different casing", () => {
      const results = store.listPolicies("SECURITY");

      expect(results).toHaveLength(2);
    });

    it("should return empty array for non-existent category", () => {
      const results = store.listPolicies("nonexistent");

      expect(results).toEqual([]);
    });
  });

  describe("searchPolicies", () => {
    beforeEach(() => {
      store.addPolicy(
        createMockParsedPDF(
          "Encryption Standards",
          "This policy defines encryption requirements for data security.",
          [
            {
              heading: "1. Purpose",
              content: "Define encryption standards for sensitive data",
              level: 1,
            },
            {
              heading: "2. Scope",
              content: "Applies to all systems handling customer data",
              level: 1,
            },
          ]
        ),
        "encryption.pdf",
        "security"
      );

      store.addPolicy(
        createMockParsedPDF(
          "Password Policy",
          "Password requirements and best practices for authentication.",
          [
            {
              heading: "1. Requirements",
              content: "Passwords must be at least 12 characters",
              level: 1,
            },
          ]
        ),
        "password.pdf",
        "security"
      );

      store.addPolicy(
        createMockParsedPDF(
          "Remote Work Guidelines",
          "Guidelines for working remotely and accessing company resources.",
          [
            {
              heading: "1. Overview",
              content: "Remote work security considerations",
              level: 1,
            },
          ]
        ),
        "remote.pdf",
        "hr"
      );
    });

    it("should find policies matching query in title", () => {
      const results = store.searchPolicies("encryption");

      expect(results).toHaveLength(1);
      expect(results[0].policy.title).toBe("Encryption Standards");
      expect(results[0].relevanceScore).toBeGreaterThan(0);
    });

    it("should find policies matching query in content", () => {
      const results = store.searchPolicies("password");

      expect(results).toHaveLength(1);
      expect(results[0].policy.title).toBe("Password Policy");
    });

    it("should find policies matching query in sections", () => {
      const results = store.searchPolicies("customer data");

      expect(results.length).toBeGreaterThan(0);
      const encryptionPolicy = results.find(
        (r) => r.policy.title === "Encryption Standards"
      );
      expect(encryptionPolicy).toBeDefined();
      expect(encryptionPolicy?.matchedSections).toContain("2. Scope");
    });

    it("should return results sorted by relevance", () => {
      const results = store.searchPolicies("security");

      expect(results.length).toBeGreaterThan(1);

      // Verify descending order
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].relevanceScore).toBeGreaterThanOrEqual(
          results[i + 1].relevanceScore
        );
      }
    });

    it("should give higher scores to title matches", () => {
      const results = store.searchPolicies("encryption");

      // Title match should have high relevance
      expect(results[0].relevanceScore).toBeGreaterThanOrEqual(10);
    });

    it("should filter by category during search", () => {
      const results = store.searchPolicies("security", "security");

      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result.policy.category).toBe("security");
      });
    });

    it("should handle case-insensitive category filtering", () => {
      const results = store.searchPolicies("work", "HR");

      expect(results).toHaveLength(1);
      expect(results[0].policy.title).toBe("Remote Work Guidelines");
    });

    it("should return empty array when no matches found", () => {
      const results = store.searchPolicies("nonexistent query");

      expect(results).toEqual([]);
    });

    it("should handle multi-word queries", () => {
      const results = store.searchPolicies("remote work security");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].policy.title).toBe("Remote Work Guidelines");
    });

    it("should ignore short query terms (2 chars or less)", () => {
      const results = store.searchPolicies("a is of encryption");

      // Should only match "encryption", not the short words
      expect(results).toHaveLength(1);
      expect(results[0].policy.title).toBe("Encryption Standards");
    });

    it("should track matched sections", () => {
      const results = store.searchPolicies("data");

      const encryptionResult = results.find(
        (r) => r.policy.title === "Encryption Standards"
      );

      expect(encryptionResult?.matchedSections.length).toBeGreaterThan(0);
    });

    it("should handle empty query string", () => {
      const results = store.searchPolicies("");

      expect(results).toEqual([]);
    });

    it("should handle query with only short terms", () => {
      const results = store.searchPolicies("a b c");

      expect(results).toEqual([]);
    });
  });

  describe("removePolicy", () => {
    it("should remove a policy by ID", () => {
      const parsedPDF = createMockParsedPDF("Test Policy", "Content");
      const policy = store.addPolicy(parsedPDF, "test.pdf");

      const removed = store.removePolicy(policy.id);

      expect(removed).toBe(true);
      expect(store.getPolicy(policy.id)).toBeUndefined();
      expect(store.count).toBe(0);
    });

    it("should return false when removing non-existent policy", () => {
      const removed = store.removePolicy("non-existent-id");

      expect(removed).toBe(false);
    });

    it("should not affect other policies when removing one", () => {
      const policy1 = store.addPolicy(
        createMockParsedPDF("Policy 1", "Content 1"),
        "1.pdf"
      );
      const policy2 = store.addPolicy(
        createMockParsedPDF("Policy 2", "Content 2"),
        "2.pdf"
      );

      store.removePolicy(policy1.id);

      expect(store.getPolicy(policy2.id)).toBeDefined();
      expect(store.count).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all policies", () => {
      store.addPolicy(createMockParsedPDF("Policy 1", "Content 1"), "1.pdf");
      store.addPolicy(createMockParsedPDF("Policy 2", "Content 2"), "2.pdf");
      store.addPolicy(createMockParsedPDF("Policy 3", "Content 3"), "3.pdf");

      store.clear();

      expect(store.count).toBe(0);
      expect(store.getAllPolicies()).toEqual([]);
    });

    it("should work on empty store", () => {
      expect(() => store.clear()).not.toThrow();
      expect(store.count).toBe(0);
    });
  });

  describe("count", () => {
    it("should return 0 for empty store", () => {
      expect(store.count).toBe(0);
    });

    it("should return correct count after adding policies", () => {
      store.addPolicy(createMockParsedPDF("Policy 1", "Content"), "1.pdf");
      expect(store.count).toBe(1);

      store.addPolicy(createMockParsedPDF("Policy 2", "Content"), "2.pdf");
      expect(store.count).toBe(2);
    });

    it("should update count after removing policies", () => {
      const policy1 = store.addPolicy(
        createMockParsedPDF("Policy 1", "Content"),
        "1.pdf"
      );
      const policy2 = store.addPolicy(
        createMockParsedPDF("Policy 2", "Content"),
        "2.pdf"
      );

      expect(store.count).toBe(2);

      store.removePolicy(policy1.id);
      expect(store.count).toBe(1);

      store.removePolicy(policy2.id);
      expect(store.count).toBe(0);
    });
  });
});
