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
  private readonly policies: Map<string, Policy> = new Map();

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

    const policies = this.filterPoliciesByCategory(category);
    const results = policies
      .map((policy) => this.scorePolicy(policy, queryLower, queryTerms))
      .filter((result) => result.relevanceScore > 0);

    // Sort by relevance
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private filterPoliciesByCategory(category?: string): Policy[] {
    const policies = this.getAllPolicies();
    if (!category) {
      return policies;
    }
    return policies.filter(
      (p) => p.category?.toLowerCase() === category.toLowerCase()
    );
  }

  private scorePolicy(
    policy: Policy,
    queryLower: string,
    queryTerms: string[]
  ): PolicySearchResult {
    let relevanceScore = 0;
    const matchedSections: string[] = [];

    // Check title match (high weight)
    if (policy.title.toLowerCase().includes(queryLower)) {
      relevanceScore += 10;
    }

    // Check section matches
    for (const section of policy.sections) {
      const sectionScore = this.scoreSectionMatch(section, queryTerms);
      if (sectionScore > 0) {
        matchedSections.push(section.heading);
        relevanceScore += sectionScore;
      }
    }

    // Check full content for additional matches
    relevanceScore += this.scoreContentMatches(policy.content, queryLower);

    return {
      policy,
      matchedSections,
      relevanceScore,
    };
  }

  private scoreSectionMatch(
    section: { heading: string; content: string },
    queryTerms: string[]
  ): number {
    const sectionText =
      `${section.heading} ${section.content}`.toLowerCase();
    let matches = 0;
    for (const term of queryTerms) {
      if (sectionText.includes(term)) {
        matches++;
      }
    }
    return matches;
  }

  private scoreContentMatches(content: string, queryLower: string): number {
    const contentLower = content.toLowerCase();
    const queryRegex = new RegExp(queryLower, "g");
    let contentMatches = 0;
    let match = queryRegex.exec(contentLower);
    while (match !== null) {
      contentMatches++;
      match = queryRegex.exec(contentLower);
    }
    return contentMatches * 0.5;
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
