import React, { useState, useEffect, useMemo } from "react";
import { InteractionChecker, BasketMedicine } from "../components/InteractionChecker";
import {
  SeverityBarChart,
  aggregateSeverityCounts,
  SeverityChartItem,
} from "../components/SeverityBarChart";
import {
  fetchAndParseDdiDataset,
  getCachedDdiRecords,
  InteractionRecord,
} from "../utils/ddiDatasetLoader";
import { AlertTriangle, Loader2 } from "lucide-react";

export type { BasketMedicine, SeverityChartItem, InteractionRecord };
export { SeverityBarChart, aggregateSeverityCounts };

interface InteractionAnalyzerPageProps {
  onOpenAiAssistant?: (initialPrompt?: string) => void;
}

export const InteractionAnalyzerPage: React.FC<InteractionAnalyzerPageProps> = ({
  onOpenAiAssistant,
}) => {
  const [interactions, setInteractions] = useState<InteractionRecord[]>(() => {
    return getCachedDdiRecords() || [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !getCachedDdiRecords() || getCachedDdiRecords()!.length === 0;
  });
  const [error, setError] = useState<string | null>(null);

  // Compute standardized count summary from ddiRecords grouped by severity level
  const severityCounts = useMemo(() => {
    return aggregateSeverityCounts(interactions);
  }, [interactions]);

  useEffect(() => {
    let isCancelled = false;

    // If records are already cached in memory, immediately populate
    const cached = getCachedDdiRecords();
    if (cached && cached.length > 0) {
      setInteractions(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetchAndParseDdiDataset()
      .then((records) => {
        if (!isCancelled) {
          setInteractions(records);
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (!isCancelled) {
          const errMessage = err?.message || "Failed to load clinical drug interactions dataset";
          console.error("Error loading DDI dataset in InteractionAnalyzerPage:", err);
          setError(errMessage);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="w-full">
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-rose-950/40 border border-red-300 dark:border-rose-500/40 text-red-900 dark:text-rose-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-rose-400 shrink-0" />
          <div className="text-sm">
            <strong className="font-semibold block">Dataset Loading Notice</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {isLoading && interactions.length === 0 && (
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-4 py-2.5 rounded-xl">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-700 dark:text-emerald-400" />
          <span>Loading 11,980 clinical drug interaction records from Db_drug_interactions.csv...</span>
        </div>
      )}

      <InteractionChecker
        onOpenAiAssistant={onOpenAiAssistant}
        initialDdiRecords={interactions}
        useDdiOnly={true}
      />
    </div>
  );
};

export default InteractionAnalyzerPage;
