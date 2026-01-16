import { randomUUID } from "node:crypto";
import type {
  Policy,
  PolicySummary,
  PolicySearchResult,
  ParsedDocument,
} from "./types.js";

/**
 * In-memory store for policies with search capabilities
 */
export class PolicyStore {
  private policies: Map<string, Policy> = new Map();

  /**
   * Add a new policy from parsed document data
   */
  addPolicy(parsedDoc: ParsedDocument, sourceFile: string, category?: string): Policy {
    const id = randomUUID();

    const policy: Policy = {
      id,
      title: parsedDoc.title,
      content: parsedDoc.content,
      sourceFile,
      category,
      effectiveDate: parsedDoc.metadata.effectiveDate,
      version: parsedDoc.metadata.version,
      sections: parsedDoc.sections,
      extractedAt: new Date(),
    };

    this.policies.set(id, policy);
    return policy;
  }

  /**
   * Get a policy by ID
   */
  getPolicy(id: string): Policy | undefined {
    return this.policies.get(id);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get policy summaries for listing
   */
  listPolicies(category?: string): PolicySummary[] {
    let policies = this.getAllPolicies();

    if (category) {
      policies = policies.filter(
        (p) => p.category?.toLowerCase() === category.toLowerCase()
      );
    }

    return policies.map((p) => ({
      id: p.id,
      title: p.title,
      sourceFile: p.sourceFile,
      category: p.category,
      sectionCount: p.sections.length,
      extractedAt: p.extractedAt,
    }));
  }

  /**
   * Search policies by query string
   */
  searchPolicies(query: string, category?: string): PolicySearchResult[] {
    const queryLower = query.toLowerCase().trim();
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

    // Return empty array if query is empty or has no valid terms
    if (!queryLower || queryTerms.length === 0) {
      return [];
    }

    let policies = this.getAllPolicies();

    if (category) {
      policies = policies.filter(
        (p) => p.category?.toLowerCase() === category.toLowerCase()
      );
    }

    const results: PolicySearchResult[] = [];

    for (const policy of policies) {
      const matchedSections: string[] = [];
      let relevanceScore = 0;

      // Check title match (high weight)
      if (policy.title.toLowerCase().includes(queryLower)) {
        relevanceScore += 10;
      }

      // Check section matches
      for (const section of policy.sections) {
        const sectionText =
          `${section.heading} ${section.content}`.toLowerCase();

        let sectionMatches = 0;
        for (const term of queryTerms) {
          if (sectionText.includes(term)) {
            sectionMatches++;
          }
        }

        if (sectionMatches > 0) {
          matchedSections.push(section.heading);
          relevanceScore += sectionMatches;
        }
      }

      // Check full content for additional matches
      const contentMatches = (
        policy.content.toLowerCase().match(new RegExp(queryLower, "g")) || []
      ).length;
      relevanceScore += contentMatches * 0.5;

      if (relevanceScore > 0) {
        results.push({
          policy,
          matchedSections,
          relevanceScore,
        });
      }
    }

    // Sort by relevance
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Remove a policy by ID
   */
  removePolicy(id: string): boolean {
    return this.policies.delete(id);
  }

  /**
   * Clear all policies
   */
  clear(): void {
    this.policies.clear();
  }

  /**
   * Get count of loaded policies
   */
  get count(): number {
    return this.policies.size;
  }
}
