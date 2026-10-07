import React from "react";
import { Link } from "react-router-dom";
import { Medicine } from "../types";
import { Pill, ArrowRight, ShieldCheck, Tag, Clock } from "lucide-react";

interface MedicineCardProps {
  medicine: Medicine;
  explanationMode?: "clinical" | "plain";
}

export const MedicineCard: React.FC<MedicineCardProps> = ({ medicine, explanationMode = "plain" }) => {
  const explanation = explanationMode === "clinical" ? medicine.clinicalExplanation : medicine.simpleExplanation;
  const primaryPrice = medicine.priceEstimates && medicine.priceEstimates.length > 0 ? medicine.priceEstimates[0] : null;

  return (
    <div className="group bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 hover:border-emerald-200 dark:hover:border-emerald-500/30 hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] rounded-xl border border-emerald-100 dark:border-emerald-500/30">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {medicine.category}
              </span>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-800 dark:group-hover:text-[#6EE7B7] transition-colors">
                {medicine.name}
              </h3>
            </div>
          </div>
          {medicine.otcSafetyBadge && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-200 dark:border-emerald-500/30 shrink-0">
              <ShieldCheck className="w-3 h-3 text-emerald-700 dark:text-[#6EE7B7]" />
              {medicine.otcSafetyBadge}
            </span>
          )}
        </div>

        {/* Brand Names */}
        <div className="mb-2.5 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-300">Brands: </span>
          {medicine.brandNames.join(", ")}
        </div>

        {/* Explanation */}
        <p className="text-base text-slate-800 dark:text-slate-300 line-clamp-3 mb-4 leading-relaxed font-sans">
          {explanation}
        </p>

        {/* Safe Duration Badge if available */}
        {medicine.safeUsageDuration && (
          <div className="mb-3.5 flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#0F172A] px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
            <Clock className="w-3.5 h-3.5 text-emerald-700 dark:text-[#6EE7B7] shrink-0" />
            <span className="truncate">{medicine.safeUsageDuration}</span>
          </div>
        )}

        {/* Symptoms Chips */}
        <div className="mb-4">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5 font-sans">
            Relieves:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {medicine.symptomsRelieved.slice(0, 3).map((sym, idx) => (
              <span
                key={idx}
                className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50/70 dark:bg-[#34D399]/20 text-emerald-900 dark:text-[#6EE7B7] border border-emerald-200/60 dark:border-emerald-500/30"
              >
                {sym}
              </span>
            ))}
            {medicine.symptomsRelieved.length > 3 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#0F172A] text-slate-600 dark:text-slate-400">
                +{medicine.symptomsRelieved.length - 3} more
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between mt-2">
        {primaryPrice ? (
          <div className="text-xs">
            <span className="text-slate-500 dark:text-slate-400 block font-sans text-[10px]">Est. Price:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-1">
              <Tag className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              {primaryPrice.priceRange}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">OTC Guide Available</span>
        )}

        <Link
          to={`/medicine/${medicine.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-[#6EE7B7] hover:text-[#3B7A57] dark:hover:text-emerald-300 group/btn transition-colors"
        >
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
};
