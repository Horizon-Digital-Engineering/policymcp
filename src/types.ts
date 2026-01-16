/**
 * Represents a section within a policy document
 */
export interface PolicySection {
  heading: string;
  content: string;
  level: number;
}

/**
 * Represents a complete policy extracted from a PDF
 */
export interface Policy {
  id: string;
  title: string;
  content: string;
  sourceFile: string;
  category?: string;
  effectiveDate?: string;
  version?: string;
  sections: PolicySection[];
  extractedAt: Date;
}

/**
 * Summary view of a policy for listing
 */
export interface PolicySummary {
  id: string;
  title: string;
  sourceFile: string;
  category?: string;
  sectionCount: number;
  extractedAt: Date;
}

/**
 * Search result with relevance context
 */
export interface PolicySearchResult {
  policy: Policy;
  matchedSections: string[];
  relevanceScore: number;
}

/**
 * Result of PDF parsing
 */
export interface ParsedPDF {
  title: string;
  content: string;
  sections: PolicySection[];
  metadata: {
    effectiveDate?: string;
    version?: string;
    pageCount: number;
  };
}
