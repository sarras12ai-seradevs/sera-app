import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  Pill,
  Activity,
  ArrowRight,
  CornerDownLeft,
  Database,
  Sparkles,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Trash2,
} from "lucide-react";
import { allMedicines } from "../data/medicinesData";
import { symptomsData } from "../data/symptomsData";
import { useDataset, ParsedClientMedicineRecord } from "../context/DatasetContext";
import { MedicineProfileCard, MedicineProfileData, isHabitFormingPositive } from "./MedicineDetailModal";

export const RECENT_SEARCHES_KEY = "sera_recent_searches";
const MAX_RECENT_SEARCHES = 5;
const DEFAULT_INITIAL_SEARCHES = ["Dolo 650", "Augmentin", "Combiflam", "Cetirizine", "Pan-D"];

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return DEFAULT_INITIAL_SEARCHES;
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (raw === null) {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(DEFAULT_INITIAL_SEARCHES));
      return DEFAULT_INITIAL_SEARCHES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, MAX_RECENT_SEARCHES);
    }
  } catch (err) {
    console.warn("Failed to read recent searches from localStorage:", err);
  }
  return [];
}

export function saveRecentSearch(term: string): string[] {
  const cleaned = term.trim();
  if (!cleaned || cleaned.length < 2 || typeof window === "undefined") {
    return getRecentSearches();
  }
  try {
    const current = getRecentSearches();
    const deduplicated = [
      cleaned,
      ...current.filter((item) => item.toLowerCase() !== cleaned.toLowerCase()),
    ].slice(0, MAX_RECENT_SEARCHES);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(deduplicated));
    window.dispatchEvent(new Event("sera_recent_searches_updated"));
    return deduplicated;
  } catch (err) {
    console.warn("Failed to save recent search to localStorage:", err);
    return getRecentSearches();
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([]));
    window.dispatchEvent(new Event("sera_recent_searches_updated"));
  } catch (err) {
    console.warn("Failed to clear recent searches in localStorage:", err);
  }
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAiAssistant?: (prompt: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onOpenAiAssistant,
}) => {
  const { dataset, isLoading, isBooting, telemetryBanner } = useDataset();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [datasetReadyVersion, setDatasetReadyVersion] = useState(0);
  const [activeProfileRecord, setActiveProfileRecord] = useState<MedicineProfileData | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const syncRecent = () => {
      setRecentSearches(getRecentSearches());
    };
    window.addEventListener("sera_recent_searches_updated", syncRecent);
    window.addEventListener("storage", syncRecent);
    return () => {
      window.removeEventListener("sera_recent_searches_updated", syncRecent);
      window.removeEventListener("storage", syncRecent);
    };
  }, []);

  // Debounce saving typed queries to recent searches
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) return;
    const timer = setTimeout(() => {
      setRecentSearches(saveRecentSearch(trimmed));
    }, 900);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleDatasetReady = () => {
      setDatasetReadyVersion((v) => v + 1);
    };
    window.addEventListener("sera_dataset_ready", handleDatasetReady);
    return () => window.removeEventListener("sera_dataset_ready", handleDatasetReady);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
      setActiveProfileRecord(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const searchTerm = query.toLowerCase().trim();
  const activeDataset: ParsedClientMedicineRecord[] =
    dataset.length > 0 ? dataset : Array.isArray((window as any).seraDataset) ? (window as any).seraDataset : [];

  // Multi-field case-insensitive search across the full 248,114 dataset from useDataset()
  const datasetResults: ParsedClientMedicineRecord[] = useMemo(() => {
    if (!searchTerm) return [];

    const results = activeDataset
      .filter((med) => {
        const nameMatch = med.name?.toLowerCase().includes(searchTerm);
        const subMatch = med.substitutes?.toLowerCase().includes(searchTerm);
        const useMatch = med.uses?.toLowerCase().includes(searchTerm);
        return nameMatch || subMatch || useMatch;
      })
      .slice(0, 50); // limit preview results for rendering speed

    return results;
  }, [activeDataset, searchTerm, datasetReadyVersion]);

  if (!isOpen) return null;

  const isContextLoading = (isLoading || isBooting) && activeDataset.length === 0;

  // Match medicines from static catalogue
  const matchedMedicines = searchTerm
    ? allMedicines
        .filter((med) => {
          const nameMatch = med.name.toLowerCase().includes(searchTerm);
          const genericMatch = med.genericName.toLowerCase().includes(searchTerm);
          const brandMatch = med.brandNames.some((b) => b.toLowerCase().includes(searchTerm));
          const ingredientMatch = med.activeIngredients.some((i) => i.toLowerCase().includes(searchTerm));
          const symptomMatch = med.symptomsRelieved.some((s) => s.toLowerCase().includes(searchTerm));
          return nameMatch || genericMatch || brandMatch || ingredientMatch || symptomMatch;
        })
        .slice(0, 4)
    : allMedicines.slice(0, 3);

  // Match symptoms
  const matchedSymptoms = searchTerm
    ? symptomsData
        .filter((sym) => {
          return (
            sym.name.toLowerCase().includes(searchTerm) ||
            sym.description.toLowerCase().includes(searchTerm) ||
            sym.commonCauses.some((c) => c.toLowerCase().includes(searchTerm))
          );
        })
        .slice(0, 3)
    : symptomsData.slice(0, 2);

  const combinedResults: Array<
    | { type: "dataset"; data: ParsedClientMedicineRecord }
    | { type: "medicine"; data: (typeof allMedicines)[0] }
    | { type: "symptom"; data: (typeof symptomsData)[0] }
  > = [
    ...datasetResults.map((d) => ({ type: "dataset" as const, data: d })),
    ...matchedMedicines
      .filter((m) => !datasetResults.some((d) => d.name?.toLowerCase() === m.name.toLowerCase()))
      .map((m) => ({ type: "medicine" as const, data: m })),
    ...matchedSymptoms.map((s) => ({ type: "symptom" as const, data: s })),
  ];

  const handleSelect = (item: (typeof combinedResults)[0]) => {
    if (query.trim().length >= 2) {
      setRecentSearches(saveRecentSearch(query.trim()));
    }
    if (item.type === "dataset") {
      if (item.data.name) {
        setRecentSearches(saveRecentSearch(item.data.name));
      }
      setActiveProfileRecord(item.data);
      return;
    }
    if (item.type === "medicine") {
      const med = item.data;
      setRecentSearches(saveRecentSearch(med.name));
      setActiveProfileRecord({
        id: med.id,
        name: med.name,
        active_ingredients: med.activeIngredients.join(", "),
        uses: med.symptomsRelieved.join(", "),
        substitutes: med.brandNames.join(", "),
        side_effects: med.sideEffects.common.join(", "),
        caution: Array.isArray(med.warnings) ? med.warnings.join("; ") : "",
        habit_forming: "No",
        therapeutic_class: med.category,
        action_class: med.genericName,
        chemical: med.activeIngredients.join(", "),
        chemical_class: med.activeIngredients.join(", "),
      });
      return;
    }
    if (item.type === "symptom") {
      onClose();
      navigate(`/symptoms?selected=${item.data.id}`);
    }
  };

  const handleSelectSubstitute = (substituteName: string) => {
    const cleanSub = substituteName.trim().toLowerCase();
    if (!cleanSub) return;

    const exactOrPartial =
      activeDataset.find((m) => m.name?.toLowerCase() === cleanSub) ||
      activeDataset.find((m) => m.name?.toLowerCase().includes(cleanSub));

    if (exactOrPartial) {
      setActiveProfileRecord(exactOrPartial);
      setQuery(exactOrPartial.name);
    } else {
      setActiveProfileRecord(null);
      setQuery(substituteName);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  const handleKeyDownModal = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (activeProfileRecord) {
        setActiveProfileRecord(null);
      } else {
        onClose();
      }
    } else if (!activeProfileRecord && e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < combinedResults.length - 1 ? prev + 1 : 0));
    } else if (!activeProfileRecord && e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : combinedResults.length - 1));
    } else if (!activeProfileRecord && e.key === "Enter" && combinedResults[selectedIndex]) {
      e.preventDefault();
      if (query.trim().length >= 2) {
        setRecentSearches(saveRecentSearch(query.trim()));
      }
      handleSelect(combinedResults[selectedIndex]);
    }
  };

  const handleClearRecentHistory = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-16 px-4 bg-black/50 backdrop-blur-xs transition-opacity font-sans">
      <div
        className="w-full max-w-3xl bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDownModal}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-5 py-4 border-b border-slate-100 dark:border-slate-700/50 gap-3 bg-white dark:bg-[#0F172A]">
          <Search className="w-5 h-5 text-[#3B7A57] dark:text-[#6EE7B7] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
              if (activeProfileRecord) {
                setActiveProfileRecord(null);
              }
            }}
            placeholder="Search 248,114 medicines (e.g., Augmentin 625 Duo Tablet, Acivir 400 Tablet, Almox 500 Capsule)..."
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 text-sm focus:outline-hidden font-sans"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setActiveProfileRecord(null);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1E293B] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Recent Searches Row above search results */}
        {!activeProfileRecord && recentSearches.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-50/80 dark:bg-[#0F172A]/80 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none min-w-0 py-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 shrink-0 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Recent Searches:</span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {recentSearches.map((recentItem) => (
                  <button
                    key={recentItem}
                    type="button"
                    onClick={() => {
                      setQuery(recentItem);
                      setSelectedIndex(0);
                      setActiveProfileRecord(null);
                      setRecentSearches(saveRecentSearch(recentItem));
                      setTimeout(() => inputRef.current?.focus(), 20);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 hover:border-emerald-400 dark:hover:border-emerald-500/40 hover:bg-emerald-50/50 dark:hover:bg-[#34D399]/20 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                  >
                    <span aria-hidden="true">🕒</span>
                    <span>{recentItem}</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearRecentHistory}
              className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
              title="Clear Recent Search History"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear History</span>
            </button>
          </div>
        )}

        {/* Detailed Clinical Profile View OR Search Results List */}
        <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
          {activeProfileRecord ? (
            <MedicineProfileCard
              item={activeProfileRecord}
              onBack={() => setActiveProfileRecord(null)}
              onSelectSubstitute={handleSelectSubstitute}
              onCheckInteractions={(medName) => {
                onClose();
                navigate(`/interactions?q=${encodeURIComponent(medName)}`);
              }}
              onAskAi={
                onOpenAiAssistant
                  ? (prompt) => {
                      onClose();
                      onOpenAiAssistant(prompt);
                    }
                  : undefined
              }
            />
          ) : isContextLoading ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center gap-3 text-center text-slate-500 dark:text-slate-400 font-sans">
              <Loader2 className="w-6 h-6 animate-spin text-[#3B7A57] dark:text-[#6EE7B7]" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Loading 248,114 Clinical Medicine Records...
                </p>
                <p className="text-xs mt-1 text-slate-400">
                  Streaming and indexing dataset in browser memory
                </p>
              </div>
            </div>
          ) : searchTerm && combinedResults.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-500 dark:text-slate-400 font-sans">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No medicines or symptoms matching "{query}"
              </p>
              <p className="text-xs mt-1 text-slate-400">
                Supports brand name, substitute, and clinical use searches across 248,114 records.
              </p>
            </div>
          ) : (
            <div className="p-3">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 py-2 flex items-center justify-between">
                <span>
                  {searchTerm
                    ? `Search Results (${datasetResults.length} dataset matches — click any medicine for full clinical profile)`
                    : "Popular OTC Suggestions"}
                </span>
                {searchTerm && (
                  <span className="text-[10px] text-emerald-800 dark:text-[#6EE7B7] font-semibold">
                    {activeDataset.length > 0 ? `${activeDataset.length.toLocaleString()} Indexed` : "Clinical Database"}
                  </span>
                )}
              </div>

              {combinedResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;

                if (item.type === "medicine") {
                  const med = item.data;
                  return (
                    <div
                      key={`med-${med.id}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-emerald-50/70 dark:bg-[#34D399]/20 text-slate-900 dark:text-slate-100 border border-emerald-200/80 dark:border-emerald-500/40 shadow-2xs"
                          : "hover:bg-slate-50 dark:hover:bg-[#0F172A] text-slate-800 dark:text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-100 dark:border-emerald-500/30 shrink-0">
                          <Pill className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{med.name}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] font-semibold border border-emerald-200 dark:border-emerald-500/30">
                              <ShieldCheck className="w-3 h-3" />
                              Non-Habit Forming
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 font-sans border border-slate-200 dark:border-slate-700/50">
                              {med.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            Brands: {med.brandNames.join(", ")} | Active: {med.activeIngredients.join(", ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-semibold text-[#3B7A57] dark:text-[#6EE7B7] hidden sm:inline">
                          View Profile
                        </span>
                        {isSelected && <CornerDownLeft className="w-4 h-4 text-[#3B7A57] dark:text-[#6EE7B7]" />}
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  );
                } else if (item.type === "dataset") {
                  const dataRec = item.data;
                  const habitPositive = isHabitFormingPositive(dataRec.habit_forming);
                  return (
                    <div
                      key={`ds-${dataRec.id}-${dataRec.name}-${idx}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-emerald-50/70 dark:bg-[#34D399]/20 text-slate-900 dark:text-slate-100 border border-emerald-200/80 dark:border-emerald-500/40 shadow-2xs"
                          : "hover:bg-slate-50 dark:hover:bg-[#0F172A] text-slate-800 dark:text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-100 dark:border-emerald-500/30 shrink-0">
                          <Database className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                              {dataRec.name}
                            </span>
                            {habitPositive ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/50 font-semibold">
                                <ShieldAlert className="w-3 h-3" />
                                Habit Forming
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-[#34D399]/20 dark:text-[#6EE7B7] dark:border-emerald-500/30 font-semibold">
                                <ShieldCheck className="w-3 h-3" />
                                Non-Habit Forming
                              </span>
                            )}
                            {dataRec.therapeutic_class && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-sans font-semibold border border-teal-200 dark:border-teal-800/40">
                                {dataRec.therapeutic_class}
                              </span>
                            )}
                            {dataRec.action_class && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#0F172A] text-slate-600 dark:text-slate-400 line-clamp-1">
                                {dataRec.action_class}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            Uses: {dataRec.uses || "Consult physician"} | Substitutes: {dataRec.substitutes || "None listed"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-emerald-800 dark:text-[#6EE7B7] font-semibold hidden sm:inline-flex items-center gap-1">
                          <span>Full Profile</span>
                        </span>
                        {isSelected && <CornerDownLeft className="w-4 h-4 text-[#3B7A57] dark:text-[#6EE7B7]" />}
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  );
                } else {
                  const sym = item.data;
                  return (
                    <div
                      key={`sym-${sym.id}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-emerald-50/70 dark:bg-[#34D399]/20 text-slate-900 dark:text-slate-100 border border-emerald-200/80 dark:border-emerald-500/40 shadow-2xs"
                          : "hover:bg-slate-50 dark:hover:bg-[#0F172A] text-slate-800 dark:text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-100 dark:border-emerald-500/30">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{sym.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 font-sans border border-slate-200 dark:border-slate-700/50">
                              Symptom
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {sym.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && <CornerDownLeft className="w-4 h-4 text-[#3B7A57] dark:text-[#6EE7B7]" />}
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-4 py-2.5 bg-[#F7F9F7] dark:bg-[#0F172A] border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-sans">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded-sm bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/50 text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded-sm bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/50 text-[10px]">↓</kbd> to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded-sm bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/50 text-[10px]">↵</kbd> to view profile
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-emerald-800 dark:text-[#6EE7B7] font-semibold">
            <Database className="w-3 h-3 text-[#3B7A57] dark:text-[#6EE7B7]" />
            <span>{telemetryBanner}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
