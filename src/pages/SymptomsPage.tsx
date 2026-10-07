import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Activity,
  Search,
  AlertTriangle,
  Pill,
  Droplets,
  BedDouble,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { symptomsData } from "../data/symptomsData";
import { allMedicines } from "../data/medicinesData";
import { Symptom } from "../types";

interface SymptomsPageProps {
  onOpenAiAssistant: (initialPrompt?: string) => void;
}

export const SymptomsPage: React.FC<SymptomsPageProps> = ({ onOpenAiAssistant }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedParam = searchParams.get("selected");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Selected active symptom
  const [activeSymptom, setActiveSymptom] = useState<Symptom>(
    symptomsData.find((s) => s.id === selectedParam) || symptomsData[0]
  );

  useEffect(() => {
    if (selectedParam) {
      const found = symptomsData.find((s) => s.id === selectedParam);
      if (found) setActiveSymptom(found);
    }
  }, [selectedParam]);

  const categories = [
    "All",
    "General & Body",
    "Throat & Chest",
    "Nasal & Cold",
    "Digestive & Stomach",
    "Musculoskeletal",
  ];

  const filteredSymptoms = symptomsData.filter((s) => {
    if (selectedCategory !== "All" && s.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.commonCauses.some((c) => c.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getMedicinesForSymptom = (symptom: Symptom) => {
    return allMedicines.filter((m) => symptom.otcMedicineIds.includes(m.id));
  };

  return (
    <div className="space-y-8 p-4 sm:p-8 pb-16 font-sans">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 sm:p-8 transition-colors">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block mb-1">
          Symptom-To-Medicine Navigator
        </span>
        <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-slate-900 dark:text-slate-100">
          Interactive Symptom Explorer
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
          Browse common symptoms to understand potential root causes, recommended over-the-counter medicines, home care remedies, and when to seek medical attention.
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Symptom Selection List (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Search & Category Filter Bar */}
          <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-5 space-y-3.5 transition-colors">
            <div className="relative">
              <Search className="w-4 h-4 text-emerald-700 dark:text-emerald-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symptoms (e.g., Fever, Acidity, Headache)..."
                className="w-full bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 text-xs sm:text-sm pl-10 pr-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/50 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/30 focus:border-[#3B7A57] dark:focus:border-emerald-400 font-sans"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                    selectedCategory === cat
                      ? "bg-[#3B7A57] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white dark:text-slate-100 shadow-2xs"
                      : "bg-slate-50 dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 hover:border-emerald-300 dark:hover:border-emerald-500/40"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Symptom Cards List */}
          <div className="space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
            {filteredSymptoms.map((sym) => {
              const isSelected = activeSymptom.id === sym.id;
              return (
                <div
                  key={sym.id}
                  onClick={() => {
                    setActiveSymptom(sym);
                    setSearchParams({ selected: sym.id });
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-emerald-50/70 dark:bg-[#34D399]/20 border-emerald-300 dark:border-emerald-500/40 shadow-xs"
                      : "bg-white dark:bg-[#1E293B] border-slate-100 dark:border-slate-700/50 hover:border-emerald-200 dark:hover:border-emerald-500/30 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isSelected ? "bg-[#3B7A57] dark:bg-emerald-700 text-white dark:text-slate-100" : "bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-100 dark:border-emerald-800/40"}`}>
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          {sym.category}
                        </span>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {sym.name}
                        </h3>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isSelected ? "text-[#3B7A57] dark:text-[#6EE7B7]" : "text-slate-400 dark:text-slate-400"}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Active Symptom Detail Panel (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 sm:p-8 space-y-6 transition-colors">
            {/* Symptom Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-700/50 pb-5">
              <div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-200 dark:border-emerald-800/40">
                  {activeSymptom.category}
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif font-semibold text-slate-900 dark:text-slate-100 mt-2">
                  {activeSymptom.name}
                </h2>
                <p className="text-base text-slate-800 dark:text-slate-300 mt-2 leading-relaxed">
                  {activeSymptom.description}
                </p>
              </div>

              <button
                onClick={() => onOpenAiAssistant(`I am experiencing ${activeSymptom.name}. What OTC options or precautions should I know?`)}
                className="px-4 py-2.5 rounded-full bg-[#3B7A57] dark:bg-emerald-700 hover:bg-emerald-800 dark:hover:bg-emerald-600 text-white dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask AI Guide</span>
              </button>
            </div>

            {/* Common Causes */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Common Triggers &amp; Causes:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {activeSymptom.commonCauses.map((cause, i) => (
                  <span
                    key={i}
                    className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50"
                  >
                    {cause}
                  </span>
                ))}
              </div>
            </div>

            {/* Red Flag Warning Box */}
            <div className="bg-red-50 dark:bg-rose-950/40 border-2 border-red-400 dark:border-rose-500/60 rounded-2xl p-5 text-xs space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-red-900 dark:text-rose-200 font-bold text-base">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-rose-300 shrink-0" />
                <span>When to Seek Immediate Medical Care</span>
              </div>
              <p className="text-red-900 dark:text-slate-300 text-sm leading-relaxed font-sans">
                Seek urgent emergency medical evaluation immediately if you observe any of the following:
              </p>
              <ul className="list-disc list-inside space-y-1 text-red-900 dark:text-rose-200 font-medium text-sm">
                {activeSymptom.redFlags.map((flag, i) => (
                  <li key={i}>{flag}</li>
                ))}
              </ul>
            </div>

            {/* Recommended OTC Medicines */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Recommended OTC Medicines:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getMedicinesForSymptom(activeSymptom).map((med) => (
                  <Link
                    key={med.id}
                    to={`/medicine/${med.id}`}
                    className="group bg-slate-50 dark:bg-[#0F172A] p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-emerald-200 dark:hover:border-emerald-500/30 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-white dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-100 dark:border-emerald-800/40">
                        <Pill className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-800 dark:group-hover:text-[#6EE7B7] transition-colors">
                          {med.name}
                        </h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                          Active: {med.activeIngredients[0]}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#3B7A57] dark:group-hover:text-[#6EE7B7] group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Home Remedies & Hydration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-emerald-50/60 dark:bg-[#0F172A] p-4 rounded-2xl border border-emerald-200/60 dark:border-slate-700/50 space-y-2">
                <span className="font-semibold text-emerald-950 dark:text-[#6EE7B7] flex items-center gap-1.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-[#6EE7B7]" />
                  <span>Helpful Home Care</span>
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-800 dark:text-slate-300 leading-relaxed">
                  {activeSymptom.homeRemedies.map((remedy, i) => (
                    <li key={i}>{remedy}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 dark:bg-[#0F172A] p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-3">
                <div className="space-y-1">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>Hydration Advice</span>
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{activeSymptom.hydrationAdvice}</p>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-200/60 dark:border-slate-700/50">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <BedDouble className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>Rest Recommendations</span>
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{activeSymptom.restRecommendations}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
