import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Pill,
  Search,
  Activity,
  ShieldAlert,
  GitCompare,
  ArrowRight,
  AlertTriangle,
  PhoneCall,
  FlaskConical,
  X,
  Check,
  Copy,
  CornerDownLeft,
  Clock,
  Trash2,
} from "lucide-react";
import { allMedicines } from "../data/medicinesData";
import { symptomsData } from "../data/symptomsData";
import { MedicineCard } from "../components/MedicineCard";
import { PlainEnglishToggle } from "../components/PlainEnglishToggle";
import { useDataset, ParsedClientMedicineRecord } from "../context/DatasetContext";
import { MedicineDetailModal } from "../components/MedicineDetailModal";
import { getRecentSearches, saveRecentSearch, clearRecentSearches } from "../components/GlobalSearchModal";

interface HomePageProps {
  onOpenSearch: () => void;
  onOpenAiAssistant: (prompt?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onOpenSearch, onOpenAiAssistant }) => {
  const navigate = useNavigate();
  const { dataset, indexedRecords, telemetryBanner, searchClientDataset } = useDataset();
  const [explanationMode, setExplanationMode] = useState<"plain" | "clinical">("plain");
  const [showIngredientTable, setShowIngredientTable] = useState(false);
  const [selectedDetailMedicine, setSelectedDetailMedicine] = useState<ParsedClientMedicineRecord | null>(null);

  // Inline Search Bar State
  const [inlineQuery, setInlineQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches);
  const [copiedHelpline, setCopiedHelpline] = useState<string | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const ingredientSectionRef = useRef<HTMLDivElement>(null);

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

  // Close autocomplete dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered inline search suggestions (local catalogue + client-side IndexedDB 248,114 dataset)
  const cleanQuery = inlineQuery.trim().toLowerCase();
  const inlineMatches = cleanQuery
    ? allMedicines
        .filter((med) => {
          return (
            med.name.toLowerCase().includes(cleanQuery) ||
            med.genericName.toLowerCase().includes(cleanQuery) ||
            med.brandNames.some((b) => b.toLowerCase().includes(cleanQuery)) ||
            med.activeIngredients.some((i) => i.toLowerCase().includes(cleanQuery)) ||
            med.symptomsRelieved.some((s) => s.toLowerCase().includes(cleanQuery))
          );
        })
        .slice(0, 4)
    : [];

  const clientDatasetMatches = cleanQuery ? searchClientDataset(cleanQuery, 5) : [];

  const handleInlineSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inlineQuery.trim().length >= 2) {
      setRecentSearches(saveRecentSearch(inlineQuery.trim()));
    }
    if (inlineMatches.length > 0) {
      navigate(`/medicine/${inlineMatches[0].id}`);
    } else if (inlineQuery.trim()) {
      navigate(`/medicines?search=${encodeURIComponent(inlineQuery.trim())}`);
    } else {
      onOpenSearch();
    }
  };

  const handleViewActiveIngredients = () => {
    setShowIngredientTable((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          ingredientSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
      }
      return next;
    });
  };

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedHelpline(num);
    setTimeout(() => setCopiedHelpline(null), 2000);
  };

  // Selected popular medicines
  const popularMedicines = allMedicines.filter((m) => m.isPopular).slice(0, 6);

  // Featured categories with counts
  const categories = [
    {
      name: "Pain & Fever",
      count: allMedicines.filter((m) => m.category === "Pain & Fever").length,
      desc: "Paracetamol, Ibuprofen, Naproxen, Diclofenac & topical analgesics",
    },
    {
      name: "Allergy & Cold",
      count: allMedicines.filter((m) => m.category === "Allergy & Cold").length,
      desc: "Cetirizine, Fexofenadine, Loratadine & nasal decongestants",
    },
    {
      name: "Digestive Care",
      count: allMedicines.filter((m) => m.category === "Digestive Care").length,
      desc: "Omeprazole, Pantoprazole, Antacids, ORS & anti-emetics",
    },
    {
      name: "Skin & Topical",
      count: allMedicines.filter((m) => m.category === "Skin & Topical").length,
      desc: "Clotrimazole, Hydrocortisone, Calamine & topical antiseptics",
    },
    {
      name: "Vitamins & Supplements",
      count: allMedicines.filter((m) => m.category === "Vitamins & Supplements").length,
      desc: "Cholecalciferol (D3), Methylcobalamin (B12), Zinc & Calcium",
    },
    {
      name: "Eye & Ear Care",
      count: allMedicines.filter((m) => m.category === "Eye & Ear Care").length,
      desc: "Carboxymethylcellulose lubricating drops & cerumenolytics",
    },
    {
      name: "First Aid & Antiseptic",
      count: allMedicines.filter((m) => m.category === "First Aid & Antiseptic").length,
      desc: "Povidone-Iodine, Silver Sulfadiazine & wound care solutions",
    },
    {
      name: "Respiratory Care",
      count: allMedicines.filter((m) => m.category === "Respiratory Care").length,
      desc: "Dextromethorphan, Ambroxol, Guaifenesin & steam inhalants",
    },
  ];

  // Instant Safety Test Presets
  const instantSafetyTests = [
    {
      label: "Paracetamol + Ibuprofen Risk",
      subtext: "Dolo 650 + Combiflam (Duplicate Paracetamol Overdose Alert)",
      severity: "Severe" as const,
      url: "/interactions?drug1=paracetamol-500&drug2=combiflam",
    },
    {
      label: "Ibuprofen + Aspirin Risk",
      subtext: "Brufen 400 + Ecosprin 75 (Antiplatelet Interference & GI Bleeding)",
      severity: "Severe" as const,
      url: "/interactions?drug1=ibuprofen-200&drug2=aspirin-75",
    },
    {
      label: "Cetirizine + Diphenhydramine Risk",
      subtext: "Cetzine + Benadryl (Additive Central Nervous System Sedation)",
      severity: "Moderate" as const,
      url: "/interactions?drug1=cetirizine-10&drug2=benadryl-syrup",
    },
  ];

  // Quick Interaction Custom Selector State
  const [quickDrug1, setQuickDrug1] = useState("paracetamol-500");
  const [quickDrug2, setQuickDrug2] = useState("combiflam");

  const handleQuickCheck = () => {
    navigate(`/interactions?drug1=${quickDrug1}&drug2=${quickDrug2}`);
  };

  return (
    <div className="space-y-12 py-6 sm:py-8 pb-16 font-sans">
      {/* Asymmetrical 2-Column Functional Clinical Utility Dashboard (Flush Canvas) */}
      <section className="pb-10 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex flex-col lg:flex-row items-stretch gap-8">
          {/* LEFT COLUMN (60% Width): Search Header + Search Bar + Quick Action Buttons */}
          <div className="w-full lg:w-[60%] flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              {/* Left-Aligned Clinical Header */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span className="text-emerald-800 dark:text-emerald-400 font-semibold">
                    {telemetryBanner}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{indexedRecords.toLocaleString()} Indexed Formulations</span>
                  <span aria-hidden="true">·</span>
                  <span>Verified DDI Index</span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-sans font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
                  Medication Safety &amp; Interaction Search
                </h1>

                <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl">
                  Look up over-the-counter brand formulations, verify active generic ingredients, check maximum daily dosage limits, and screen multi-drug combinations for clinical contraindications.
                </p>
              </div>

              {/* Functional Search Bar with Live Autocomplete */}
              <div className="relative" ref={searchBoxRef}>
                <form onSubmit={handleInlineSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-5 h-5 text-emerald-700 dark:text-emerald-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={inlineQuery}
                      onChange={(e) => {
                        setInlineQuery(e.target.value);
                        setDropdownOpen(true);
                      }}
                      onFocus={() => setDropdownOpen(true)}
                      placeholder="Search by medicine name (e.g., Paracetamol, Combiflam, Omez), active ingredient, or symptom..."
                      className="w-full pl-11 pr-20 py-3.5 rounded-2xl bg-white dark:bg-[#121815] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-white/10 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/30 focus:border-emerald-700 dark:focus:border-emerald-400 text-sm transition-all shadow-2xs"
                    />
                    {inlineQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInlineQuery("");
                          setDropdownOpen(false);
                        }}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenSearch}
                        className="hidden sm:inline-flex items-center gap-1 absolute right-3.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded-lg bg-slate-100 dark:bg-[#18201C] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 font-mono hover:border-emerald-400 transition-colors cursor-pointer"
                        title="Open global search modal"
                      >
                        ⌘K
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-3.5 rounded-2xl bg-[#3B7A57] hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-semibold text-sm transition-colors shadow-2xs shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    Search Database
                  </button>
                </form>

                {/* Recent Searches Row above search results */}
                {recentSearches.length > 0 && (
                  <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Recent Searches:</span>
                      </span>
                      {recentSearches.map((recentItem) => (
                        <button
                          key={recentItem}
                          type="button"
                          onClick={() => {
                            setInlineQuery(recentItem);
                            setDropdownOpen(true);
                            setRecentSearches(saveRecentSearch(recentItem));
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-[#18201C] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 hover:border-emerald-400 dark:hover:border-emerald-500/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                        >
                          <span aria-hidden="true">🕒</span>
                          <span>{recentItem}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearRecentSearches();
                        setRecentSearches([]);
                      }}
                      className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                      title="Clear Recent Search History"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear History</span>
                    </button>
                  </div>
                )}

                {/* Live Autocomplete Dropdown */}
                {dropdownOpen && cleanQuery.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-white dark:bg-[#18201C] border border-slate-200 dark:border-white/10 rounded-2xl shadow-lg overflow-hidden divide-y divide-slate-100 dark:divide-white/5 max-h-96 overflow-y-auto">
                    {inlineMatches.length > 0 || clientDatasetMatches.length > 0 ? (
                      <>
                        {inlineMatches.map((med) => (
                          <Link
                            key={med.id}
                            to={`/medicine/${med.id}`}
                            onClick={() => {
                              setRecentSearches(saveRecentSearch(med.name));
                              setDropdownOpen(false);
                            }}
                            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#121815] transition-colors"
                          >
                            <div className="min-w-0 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {med.name}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  · {med.category}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                                Active Ingredient: <strong className="text-emerald-800 dark:text-emerald-400">{med.activeIngredients.join(" + ")}</strong> · Brands: {med.brandNames.join(", ")}
                              </p>
                            </div>
                            <CornerDownLeft className="w-4 h-4 text-slate-400 shrink-0" />
                          </Link>
                        ))}
                        {clientDatasetMatches.map((rec) => (
                          <button
                            key={`idb-${rec.id}-${rec.name}`}
                            type="button"
                            onClick={() => {
                              if (rec.name) {
                                setRecentSearches(saveRecentSearch(rec.name));
                              }
                              setDropdownOpen(false);
                              setSelectedDetailMedicine(rec);
                            }}
                            className="w-full text-left flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#121815] transition-colors cursor-pointer"
                          >
                            <div className="min-w-0 pr-3 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {rec.name}
                                </span>
                                {rec.therapeutic_class && (
                                  <span className="text-xs text-emerald-800 dark:text-emerald-400 font-medium">
                                    · {rec.therapeutic_class}
                                  </span>
                                )}
                                {rec.habit_forming && (
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    · Habit Forming: {rec.habit_forming}
                                  </span>
                                )}
                              </div>
                              {rec.uses && (
                                <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                  Uses: {rec.uses}
                                </p>
                              )}
                              {rec.substitutes && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  Substitutes: {rec.substitutes}
                                </p>
                              )}
                            </div>
                            <CornerDownLeft className="w-4 h-4 text-slate-400 shrink-0" />
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            onOpenSearch();
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-emerald-800 dark:text-emerald-400 bg-slate-50/70 dark:bg-[#121815] hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <span>Search {indexedRecords.toLocaleString()} indexed dataset records for "{inlineQuery}"</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="p-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>No local summary match for "{inlineQuery}". Query full {indexedRecords.toLocaleString()} index:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            onOpenSearch();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#3B7A57] dark:bg-emerald-500 text-white dark:text-slate-950 font-semibold cursor-pointer"
                        >
                          Open Deep Search
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Action Buttons ("Check Interaction", "View Active Ingredients") */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => navigate("/interactions")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B7A57] hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-sm font-semibold transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Check Interaction</span>
                </button>

                <button
                  type="button"
                  onClick={handleViewActiveIngredients}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    showIngredientTable
                      ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 dark:border-emerald-400 text-emerald-900 dark:text-emerald-300"
                      : "bg-white dark:bg-[#18201C] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-white/10"
                  }`}
                >
                  <FlaskConical className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>View Active Ingredients</span>
                </button>

                <Link
                  to="/compare"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#18201C] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <GitCompare className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Compare Formulations</span>
                </Link>
              </div>
            </div>

            {/* Bottom Row of Left Column: Plain English vs Clinical Mode Bar */}
            <div className="pt-4 border-t border-slate-200/70 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                  Display Mode: {explanationMode === "plain" ? "Patient-Friendly Plain English" : "Clinical Pharmacology"}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Controls terminology depth across all medication profiles below.
                </span>
              </div>
              <PlainEnglishToggle
                mode={explanationMode}
                onChange={(newMode) => setExplanationMode(newMode)}
              />
            </div>
          </div>

          {/* RIGHT COLUMN (40% Width): "Quick Safety Check" Card + Instant Test Buttons + Emergency Helpline Shortcuts */}
          <div className="w-full lg:w-[40%]">
            <div className="h-full bg-white dark:bg-[#18201C] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                {/* Card Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      <span>Quick Safety Check</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Instant clinical interaction screening &amp; high-risk combinations
                    </p>
                  </div>
                  <Link
                    to="/interactions"
                    className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:underline whitespace-nowrap"
                  >
                    Full Analyzer →
                  </Link>
                </div>

                {/* Instant Test Buttons */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                    Instant Interaction Test Presets:
                  </span>
                  <div className="space-y-2">
                    {instantSafetyTests.map((test, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => navigate(test.url)}
                        className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-[#121815] hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 border border-slate-200/70 dark:border-white/5 hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-all flex items-center justify-between gap-3 group cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 flex items-center gap-1.5">
                            <AlertTriangle
                              className={`w-3.5 h-3.5 shrink-0 ${
                                test.severity === "Severe"
                                  ? "text-red-600 dark:text-rose-400"
                                  : "text-amber-600 dark:text-amber-400"
                              }`}
                            />
                            <span className="truncate">{test.label}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                            {test.subtext}
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom 2-Medicine Selector */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                    Custom Pair Screening:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={quickDrug1}
                      onChange={(e) => setQuickDrug1(e.target.value)}
                      aria-label="First Medicine"
                      className="w-full bg-slate-50 dark:bg-[#121815] text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-white/10 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {allMedicines.slice(0, 15).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.activeIngredients[0]})
                        </option>
                      ))}
                    </select>
                    <select
                      value={quickDrug2}
                      onChange={(e) => setQuickDrug2(e.target.value)}
                      aria-label="Second Medicine"
                      className="w-full bg-slate-50 dark:bg-[#121815] text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs border border-slate-200 dark:border-white/10 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {allMedicines.slice(0, 15).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.activeIngredients[0]})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickCheck}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Screen Selected Pair</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Emergency Helpline Shortcuts */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-700 dark:text-rose-300 flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Emergency Helpline Shortcuts</span>
                  </span>
                  <Link
                    to="/emergency"
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-red-700 dark:hover:text-rose-300 transition-colors"
                  >
                    All Regions →
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyNumber("112")}
                    className="p-2.5 rounded-xl bg-red-50/80 dark:bg-rose-950/40 hover:bg-red-100/80 dark:hover:bg-rose-950/60 border border-red-200/80 dark:border-rose-500/30 text-left transition-colors flex items-center justify-between cursor-pointer"
                    title="Click to copy emergency number 112"
                  >
                    <div>
                      <span className="text-[11px] font-medium text-red-800 dark:text-rose-300 block">
                        Emergency Dispatch
                      </span>
                      <span className="text-sm font-mono font-bold text-red-950 dark:text-rose-100 tabular-nums">
                        112 / 911
                      </span>
                    </div>
                    {copiedHelpline === "112" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-red-600 dark:text-rose-400 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyNumber("1800-425-1213")}
                    className="p-2.5 rounded-xl bg-red-50/80 dark:bg-rose-950/40 hover:bg-red-100/80 dark:hover:bg-rose-950/60 border border-red-200/80 dark:border-rose-500/30 text-left transition-colors flex items-center justify-between cursor-pointer"
                    title="Click to copy Poison Control Helpline"
                  >
                    <div className="min-w-0 pr-1">
                      <span className="text-[11px] font-medium text-red-800 dark:text-rose-300 block truncate">
                        Poison Control
                      </span>
                      <span className="text-xs font-mono font-bold text-red-950 dark:text-rose-100 tabular-nums truncate block">
                        1800-425-1213
                      </span>
                    </div>
                    {copiedHelpline === "1800-425-1213" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-red-600 dark:text-rose-400 shrink-0" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Active Ingredient Quick-Reference Table (Toggled by "View Active Ingredients" Button) */}
        {showIngredientTable && (
          <div
            ref={ingredientSectionRef}
            className="mt-6 bg-white dark:bg-[#18201C] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                  Active Ingredient &amp; Brand Mapping Reference
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verify active pharmaceutical compounds inside common OTC brand names to prevent accidental double-dosing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIngredientTable(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                title="Close Active Ingredient Table"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">OTC Medicine</th>
                    <th className="py-2.5 px-3">Active Generic Compound(s)</th>
                    <th className="py-2.5 px-3">Common Brand Names</th>
                    <th className="py-2.5 px-3">Max Safe Daily Limit</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {allMedicines.slice(0, 10).map((med) => (
                    <tr key={med.id} className="hover:bg-slate-50 dark:hover:bg-[#121815]">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {med.name}
                      </td>
                      <td className="py-2.5 px-3 text-emerald-800 dark:text-emerald-400 font-semibold">
                        {med.activeIngredients.join(" + ")}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {med.brandNames.join(", ")}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-mono tabular-nums">
                        {med.dosage.maxDailySafeLimit || med.dosage.maxDaily}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          to={`/medicine/${med.id}`}
                          className="text-emerald-800 dark:text-emerald-400 font-semibold hover:underline"
                        >
                          Profile →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Categories Grid */}
      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 block mb-1">
              Therapeutic Classification
            </span>
            <h2 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 dark:text-slate-50">
              OTC Medicine Categories
            </h2>
          </div>
          <Link
            to="/medicines"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:text-[#3B7A57] dark:hover:text-emerald-300 transition-colors"
          >
            <span>View Full Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat, idx) => (
            <Link
              key={idx}
              to={`/medicines?category=${encodeURIComponent(cat.name)}`}
              className="group bg-white dark:bg-[#18201C] border border-slate-200/80 dark:border-white/5 rounded-2xl p-5 hover:border-emerald-500/40 dark:hover:border-emerald-500/30 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors">
                    {cat.name}
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {cat.count} drugs
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {cat.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                <span>View Formulations</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Popular OTC Medicines */}
      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 block mb-1">
              Standard Formulations
            </span>
            <h2 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 dark:text-slate-50">
              Frequently Searched OTC Medicines
            </h2>
          </div>
          <Link
            to="/medicines"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:text-[#3B7A57] dark:hover:text-emerald-300 transition-colors"
          >
            <span>Browse All Medicines</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {popularMedicines.map((med) => (
            <MedicineCard
              key={med.id}
              medicine={med}
              explanationMode={explanationMode}
            />
          ))}
        </div>
      </section>

      {/* Symptom Explorer Directory */}
      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 block mb-1">
              Clinical Triage &amp; Self-Care
            </span>
            <h2 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 dark:text-slate-50">
              Symptom-to-Medicine Directory
            </h2>
          </div>
          <Link
            to="/symptoms"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:text-[#3B7A57] dark:hover:text-emerald-300 transition-colors"
          >
            <span>Explore All Symptoms</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {symptomsData.slice(0, 6).map((symptom) => (
            <Link
              key={symptom.id}
              to={`/symptoms?selected=${symptom.id}`}
              className="group bg-white dark:bg-[#18201C] border border-slate-200/80 dark:border-white/5 rounded-2xl p-5 hover:border-emerald-500/40 dark:hover:border-emerald-500/30 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors">
                    {symptom.name}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {symptom.category}
                  </span>
                </div>

                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 mb-3 leading-relaxed">
                  {symptom.description}
                </p>

                {symptom.redFlags.length > 0 && (
                  <div className="text-xs text-red-700 dark:text-rose-300 flex items-center gap-1.5 font-medium mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Red Flag: {symptom.redFlags[0]}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                <span>View OTC Options &amp; Red Flags</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <MedicineDetailModal
        isOpen={Boolean(selectedDetailMedicine)}
        medicine={selectedDetailMedicine}
        onClose={() => setSelectedDetailMedicine(null)}
        onSelectSubstitute={(subName) => {
          const clean = subName.trim().toLowerCase();
          const match =
            dataset.find((m) => m.name?.toLowerCase() === clean) ||
            dataset.find((m) => m.name?.toLowerCase().includes(clean)) ||
            searchClientDataset(subName, 1)[0];
          if (match) {
            setSelectedDetailMedicine(match);
          } else {
            setSelectedDetailMedicine(null);
            setInlineQuery(subName);
            setDropdownOpen(true);
          }
        }}
        onCheckInteractions={(medName) => {
          setSelectedDetailMedicine(null);
          navigate(`/interactions?q=${encodeURIComponent(medName)}`);
        }}
        onAskAi={(prompt) => {
          setSelectedDetailMedicine(null);
          onOpenAiAssistant(prompt);
        }}
      />
    </div>
  );
};
