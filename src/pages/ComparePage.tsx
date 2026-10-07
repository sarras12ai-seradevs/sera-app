import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  GitCompare,
  Pill,
  ShieldCheck,
  Tag,
  AlertTriangle,
  Clock,
  Sparkles,
  ExternalLink,
  Plus,
  X,
  CheckCircle2,
} from "lucide-react";
import { allMedicines } from "../data/medicinesData";
import { Medicine } from "../types";

export const ComparePage: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "paracetamol-500",
    "ibuprofen-200",
    "combiflam",
  ]);

  const selectedMedicines = selectedIds
    .map((id) => allMedicines.find((m) => m.id === id))
    .filter((m): m is Medicine => m !== undefined);

  const handleSelectMedicine = (index: number, id: string) => {
    const updated = [...selectedIds];
    updated[index] = id;
    setSelectedIds(updated);
  };

  const removeSlot = (index: number) => {
    if (selectedIds.length > 2) {
      const updated = selectedIds.filter((_, i) => i !== index);
      setSelectedIds(updated);
    }
  };

  const addSlot = () => {
    if (selectedIds.length < 3) {
      const unused = allMedicines.find((m) => !selectedIds.includes(m.id));
      if (unused) {
        setSelectedIds([...selectedIds, unused.id]);
      }
    }
  };

  return (
    <div className="space-y-8 p-4 sm:p-8 pb-16 font-sans">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block mb-1">
            Side-By-Side Medication Comparison
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            OTC Medicine Comparison
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
            Compare active ingredients, safe dosage limits, side effect profiles, pregnancy safety ratings, and price bands across 2 to 3 OTC medicines.
          </p>
        </div>

        {selectedIds.length < 3 && (
          <button
            onClick={addSlot}
            className="px-5 py-2.5 rounded-full bg-[#3B7A57] dark:bg-emerald-700 hover:bg-emerald-800 dark:hover:bg-emerald-600 text-white dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add 3rd Medicine to Compare</span>
          </button>
        )}
      </div>

      {/* Comparison Matrix Table */}
      <div className="overflow-x-auto bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl transition-colors">
        <table className="w-full border-collapse text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700/50 bg-[#F7F9F7] dark:bg-[#0F172A]">
              <th className="p-4 w-48 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                Clinical Metric
              </th>
              {selectedMedicines.map((med, idx) => (
                <th key={`${med.id}-${idx}`} className="p-4 min-w-[240px] align-top space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-400 uppercase">
                      Medicine {idx + 1}
                    </span>
                    {selectedIds.length > 2 && (
                      <button
                        onClick={() => removeSlot(idx)}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-rose-300 transition-colors p-1 rounded-full hover:bg-red-50 dark:hover:bg-rose-950/50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <select
                    value={med.id}
                    onChange={(e) => handleSelectMedicine(idx, e.target.value)}
                    className="w-full bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 font-semibold text-xs px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/50 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/30 focus:border-[#3B7A57] dark:focus:border-emerald-400"
                  >
                    {allMedicines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {/* Category & Badge */}
            <tr>
              <td className="p-4 font-semibold text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-[#0F172A]/60">
                Category &amp; Safety
              </td>
              {selectedMedicines.map((med, idx) => (
                <td key={`${med.id}-${idx}`} className="p-4 space-y-1.5">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-300 block">
                    {med.category}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-200 dark:border-emerald-800/40">
                    <ShieldCheck className="w-3 h-3 text-emerald-700 dark:text-[#6EE7B7]" />
                    {med.otcSafetyBadge}
                  </span>
                </td>
              ))}
            </tr>

            {/* Active Ingredients */}
            <tr>
              <td className="p-4 font-semibold text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-[#0F172A]/60">
                Active Ingredients
              </td>
              {selectedMedicines.map((med, idx) => (
                <td key={`${med.id}-${idx}`} className="p-4 text-slate-800 dark:text-slate-300 font-medium">
                  {med.activeIngredients.join(", ")}
                </td>
              ))}
            </tr>

            {/* Popular Brand Names */}
            <tr>
              <td className="p-4 font-semibold text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-[#0F172A]/60">
                Popular Brand Names
              </td>
              {selectedMedicines.map((med, idx) => (
                <td key={`${med.id}-${idx}`} className="p-4 text-slate-600 dark:text-slate-400">
                  {med.brandNames.join(", ")}
                </td>
              ))}
            </tr>

            {/* Available Forms */}
            <tr>
              <td className="p-4 font-semibold text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-[#0F172A]/60">
                Formulations
              </td>
              {selectedMedicines.map((med, idx) => (
                <td key={`${med.id}-${idx}`} className="p-4">
                  <div className="flex flex-wrap gap-1.5">
                    {med.forms.map((f, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </td>
              ))}
            </tr>

            {/* Symptoms Relieved */}
            <tr>
              <td className="p-4 font-semibold text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-[#0F172A]/60">
                Symptoms Relieved
              </td>
              {selectedMedicines.map((med, idx) => (
                <td key={`${med.id}-${idx}`} className="p-4">
                  <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                    {med.symptomsRelieved.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>

            {/* Adult Dosage */}
            <tr>
              <td className="p-4 font-semibold text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-[#0F172A]/60">
                Adult Administration
              </td>
              {selectedMedicines.map((med, idx) => (
                <td key={`${med.id}-${idx}`} className="p-4 text-slate-800 dark:text-slate-300">
                  {med.dosage.adult}
                </td>
              ))}
            </tr>

            {/* Max Daily Safe Limit */}
            <tr>
              <td className="p-4 font-semibold text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-[#0F172A]/60">
                Max Daily Limit
              </td>
              {selectedMedicines.map((med, idx) => (
                <td key={`${med.id}-${idx}`} className="p-4 text-red-700 dark:text-rose-300 font-semibold">
                  {med.dosage.maxDailySafeLimit || med.dosage.maxDaily}
                </td>
              ))}
            </tr>

            {/* Max Safe Duration */}
            <tr>
              <td className="p-4 font-semibold text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-[#0F172A]/60">
                Safe Usage Duration
              </td>
              {selectedMedicines.map((med, idx) => (
                <td key={`${med.id}-${idx}`} className="p-4 text-slate-800 dark:text-slate-300">
                  {med.dosage.maxContinuousDuration || "Maximum 3-5 consecutive days."}
                </td>
              ))}
            </tr>

            {/* Pregnancy Safety */}
            <tr>
              <td className="p-4 font-semibold text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-[#0F172A]/60">
                Pregnancy Safety
              </td>
              {selectedMedicines.map((med, idx) => (
                <td key={`${med.id}-${idx}`} className="p-4 text-slate-700 dark:text-slate-300">
                  {med.pregnancySafety}
                </td>
              ))}
            </tr>

            {/* Action Links */}
            <tr>
              <td className="p-4 bg-slate-50/50 dark:bg-[#0F172A]/60"></td>
              {selectedMedicines.map((med, idx) => (
                <td key={`${med.id}-${idx}`} className="p-4">
                  <Link
                    to={`/medicine/${med.id}`}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-[#3B7A57] dark:bg-emerald-700 hover:bg-emerald-800 dark:hover:bg-emerald-600 text-white dark:text-slate-100 font-semibold text-xs transition-colors shadow-2xs"
                  >
                    <span>Full Profile &amp; FAQs</span>
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
