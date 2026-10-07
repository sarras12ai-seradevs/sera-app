export interface MedicineRecord {
  id: string;
  name: string;
  normalizedName: string;
  uses: string[];
  sideEffects: string[];
  substitutes: string[];
  chemicalClass: string;
  therapeuticClass: string;
  actionClass: string;
  habitForming: string;
  composition?: string[];
  source?: string;
}

export interface RetrievalResult {
  record: MedicineRecord;
  matchType: "exact" | "partial" | "fuzzy" | "token";
  score: number; // 0 to 1, higher is better
}

export interface SearchOptions {
  limit?: number;
  threshold?: number; // minimum fuzzy score (e.g. 0.6)
  includeSubstitutes?: boolean;
}

export interface DatasetStats {
  totalRecords: number;
  loadedFrom: string[];
  sourcesCount: Record<string, number>;
  lastLoadedAt: string;
  isIndexing: boolean;
  memoryUsageMb: number;
}

/**
 * Modular interface for adding future datasets
 * (e.g., drug interactions, contraindications, clinical guidelines)
 */
export interface KnowledgeSource {
  id: string;
  name: string;
  isReady: () => boolean;
  search: (query: string, options?: SearchOptions) => Promise<RetrievalResult[]>;
  getByName: (name: string) => Promise<MedicineRecord | null>;
  getStats: () => DatasetStats;
}
