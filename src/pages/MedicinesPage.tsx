import React, { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Pill,
  Search,
  Filter,
  ShieldCheck,
  Grid,
  List,
  SlidersHorizontal,
  X,
  Check,
  BookOpen,
} from "lucide-react";
import { allMedicines } from "../data/medicinesData";
import { MedicineCategory, Medicine } from "../types";
import { MedicineCard } from "../components/MedicineCard";
import { PlainEnglishToggle } from "../components/PlainEnglishToggle";

export const MedicinesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") || "All";

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForm, setSelectedForm] = useState<string>("All");
  const [selectedBadge, setSelectedBadge] = useState<string>("All");
  const [explanationMode, setExplanationMode] = useState<"plain" | "clinical">("plain");

  const categories: string[] = [
    "All",
    "Pain & Fever",
    "Allergy & Cold",
    "Digestive Care",
    "Skin & Topical",
    "Vitamins & Supplements",
    "Eye & Ear Care",
    "First Aid & Antiseptic",
    "Respiratory Care",
  ];

  const formsList = [
    "All",
    "Tablet",
    "Syrup",
    "Capsule",
    "Cream",
    "Gel",
    "Drops",
    "Inhaler",
    "Ointment",
    "Powder",
  ];

  const badgesList = [
    "All",
    "General OTC",
    "Pharmacist Consult OTC",
    "External Use Only",
    "Short-Term Use",
  ];

  // Filter logic
  const filteredMedicines = useMemo(() => {
    return allMedicines.filter((med) => {
      // Category match
      if (selectedCategory !== "All" && med.category !== selectedCategory) {
        return false;
      }

      // Form match
      if (selectedForm !== "All" && !med.forms.includes(selectedForm as any)) {
        return false;
      }

      // Badge match
      if (selectedBadge !== "All" && med.otcSafetyBadge !== selectedBadge) {
        return false;
      }

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = med.name.toLowerCase().includes(q);
        const genericMatch = med.genericName.toLowerCase().includes(q);
        const brandMatch = med.brandNames.some((b) => b.toLowerCase().includes(q));
        const ingredientMatch = med.activeIngredients.some((i) => i.toLowerCase().includes(q));
        const symptomMatch = med.symptomsRelieved.some((s) => s.toLowerCase().includes(q));
        return nameMatch || genericMatch || brandMatch || ingredientMatch || symptomMatch;
      }

      return true;
    });
  }, [selectedCategory, selectedForm, selectedBadge, searchQuery]);

  const resetFilters = () => {
    setSelectedCategory("All");
    setSelectedForm("All");
    setSelectedBadge("All");
    setSearchQuery("");
    setSearchParams({});
  };

  return (
    <div className="space-y-8 p-4 sm:p-8 pb-16 font-sans">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-[#6EE7B7] block mb-1">
            Verified Clinical &amp; OTC Database
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 flex-wrap">
            <span>OTC Medicine Directory</span>
            <span className="text-xs font-sans px-3 py-1 rounded-full bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] font-semibold border border-emerald-200 dark:border-emerald-500/30">
              {filteredMedicines.length} Medicines
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
            Browse over-the-counter medicines, brand names, active ingredients, safe dosage limits, and patient FAQs.
          </p>
        </div>

        {/* Plain vs Clinical Mode Switch */}
        <div className="flex items-center gap-3">
          <PlainEnglishToggle
            mode={explanationMode}
            onChange={(mode) => setExplanationMode(mode)}
          />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-5 sm:p-6 space-y-4 transition-colors">
        {/* Search Input Row */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-emerald-700 dark:text-[#6EE7B7] absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by brand name (e.g., Crocin, Omez, Volini), active ingredient, or symptom..."
              className="w-full bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 text-sm pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/50 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/30 focus:border-[#3B7A57] dark:focus:border-[#6EE7B7] font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Form & Badge Selectors */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedForm}
              onChange={(e) => setSelectedForm(e.target.value)}
              className="bg-slate-50 dark:bg-[#0F172A] text-slate-800 dark:text-slate-300 text-xs rounded-2xl px-4 py-2.5 border border-slate-200 dark:border-slate-700/50 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/30 focus:border-[#3B7A57] dark:focus:border-[#6EE7B7] font-sans"
            >
              <option value="All">All Formulations</option>
              {formsList.filter((f) => f !== "All").map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <select
              value={selectedBadge}
              onChange={(e) => setSelectedBadge(e.target.value)}
              className="bg-slate-50 dark:bg-[#0F172A] text-slate-800 dark:text-slate-300 text-xs rounded-2xl px-4 py-2.5 border border-slate-200 dark:border-slate-700/50 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/30 focus:border-[#3B7A57] dark:focus:border-[#6EE7B7] font-sans"
            >
              <option value="All">All Safety Badges</option>
              {badgesList.filter((b) => b !== "All").map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {(selectedCategory !== "All" || selectedForm !== "All" || selectedBadge !== "All" || searchQuery) && (
              <button
                onClick={resetFilters}
                className="px-4 py-2.5 rounded-full bg-slate-100 dark:bg-[#0F172A] border border-transparent dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-xs font-semibold shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Category Pills Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setSearchParams(cat === "All" ? {} : { category: cat });
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                selectedCategory === cat
                  ? "bg-[#3B7A57] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white dark:text-slate-100 shadow-2xs"
                  : "bg-slate-50 dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:bg-emerald-50/40 dark:hover:bg-[#34D399]/20"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Medicines Grid View */}
      {filteredMedicines.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-8 space-y-3 font-sans">
          <Pill className="w-10 h-10 text-emerald-700 dark:text-[#6EE7B7] mx-auto" />
          <h3 className="text-lg font-serif font-semibold text-slate-900 dark:text-slate-100">
            No Medicines Found
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            We couldn't find any over-the-counter drugs matching your selected filters or search query.
          </p>
          <button
            onClick={resetFilters}
            className="px-5 py-2.5 rounded-full bg-[#3B7A57] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white dark:text-slate-100 text-xs font-semibold hover:bg-emerald-800 transition-colors"
          >
            Clear All Search Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMedicines.map((med) => (
            <MedicineCard
              key={med.id}
              medicine={med}
              explanationMode={explanationMode}
            />
          ))}
        </div>
      )}
    </div>
  );
};
