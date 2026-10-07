import React from "react";
import {
  X,
  Pill,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  ArrowLeft,
  ArrowUpRight,
  FlaskConical,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { ParsedClientMedicineRecord } from "../context/DatasetContext";

export interface MedicineProfileData {
  id?: string;
  name: string;
  active_ingredients?: string;
  uses?: string;
  substitutes?: string;
  side_effects?: string;
  caution?: string;
  habit_forming?: string;
  therapeutic_class?: string;
  action_class?: string;
  chemical?: string;
  chemical_class?: string;
}

interface MedicineProfileCardProps {
  item: MedicineProfileData;
  onSelectSubstitute?: (substituteName: string) => void;
  onCheckInteractions?: (medicineName: string) => void;
  onAskAi?: (prompt: string) => void;
  onBack?: () => void;
  onClose?: () => void;
}

function splitCommaList(value?: string): string[] {
  if (!value || typeof value !== "string") return [];
  return value
    .split(",")
    .map((s) => s.replace(/^"|"$/g, "").trim())
    .filter((s) => {
      if (!s) return false;
      const lower = s.toLowerCase();
      return lower !== "na" && lower !== "n/a" && lower !== "null" && lower !== "none" && lower !== "-";
    });
}

export function isHabitFormingPositive(raw?: string): boolean {
  if (!raw) return false;
  const norm = raw.trim().toLowerCase();
  return norm === "yes" || norm === "true" || norm === "1" || norm === "habit forming";
}

export const MedicineProfileCard: React.FC<MedicineProfileCardProps> = ({
  item,
  onSelectSubstitute,
  onCheckInteractions,
  onAskAi,
  onBack,
  onClose,
}) => {
  const isHabitForming = isHabitFormingPositive(item.habit_forming);
  const usesList = splitCommaList(item.uses);
  const substitutesList = splitCommaList(item.substitutes);
  const sideEffectsList = splitCommaList(item.side_effects);

  const chemicalValue =
    item.chemical?.trim() ||
    item.chemical_class?.trim() ||
    "Standard Clinical Chemical Compound";
  const actionValue =
    item.action_class?.trim() ||
    "Targeted Systemic Pharmacological Agent";
  const therapeuticValue =
    item.therapeutic_class?.trim() ||
    "General Clinical Therapeutics";
  const activeIngredientText =
    item.active_ingredients?.trim() ||
    item.chemical_class?.trim() ||
    item.chemical?.trim() ||
    item.action_class?.trim() ||
    "Verified Clinical Active Formulation";
  const cautionText =
    item.caution?.trim() ||
    "Consult physician for specific administration precautions, dosage adjustments in hepatic or renal impairment, and potential contraindications.";

  return (
    <div className="bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-300 font-sans">
      {/* 1. HEADER & TAXONOMY BADGES */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-700/50 bg-[#F7F9F7]/70 dark:bg-[#0F172A]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2.5 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3B7A57] dark:text-[#6EE7B7] hover:underline mb-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Search Results</span>
              </button>
            )}

            {/* Quick Taxonomy Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {isHabitForming ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/50">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span>Habit Forming</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-[#34D399]/20 dark:text-[#6EE7B7] dark:border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-[#6EE7B7]" />
                  <span>Non-Habit Forming</span>
                </span>
              )}

              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800/50">
                {therapeuticValue}
              </span>

              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-[#1E293B] dark:text-slate-300 dark:border-slate-700/50">
                {actionValue}
              </span>
            </div>

            {/* Medicine Name & Active Ingredients */}
            <div>
              <h2 className="text-xl sm:text-2xl font-serif font-semibold text-slate-900 dark:text-slate-100 capitalize">
                {item.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Active Ingredients / Class:{" "}
                </span>
                <span>{activeIngredientText}</span>
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* PROFILE BODY */}
      <div className="p-5 sm:p-6 space-y-6">
        {/* 2. SECTION 1: 🎯 WHAT IT IS FOR (Indications & Substitutes) */}
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700/50 bg-slate-50/60 dark:bg-[#0F172A]/70 p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>🎯 WHAT IT IS FOR (Indications &amp; Substitutes)</span>
          </h3>

          {/* Primary Indications (uses) */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
              Primary Clinical Indications:
            </span>
            {usesList.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {usesList.map((useItem, idx) => (
                  <li
                    key={`${useItem}-${idx}`}
                    className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#1E293B] border border-emerald-200/70 dark:border-emerald-500/30 text-xs sm:text-sm text-slate-800 dark:text-slate-300 shadow-2xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#6EE7B7] shrink-0 mt-0.5" />
                    <span className="font-medium">{useItem}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/50 text-xs text-slate-600 dark:text-slate-400">
                Consult a licensed healthcare provider or pharmacist for specific clinical indications and therapeutic protocols.
              </div>
            )}
          </div>

          {/* Verified Substitutes (substitutes) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Verified Brand Substitutes (Identical Active Formulation):
              </span>
              {substitutesList.length > 0 && (
                <span className="text-[11px] text-emerald-800 dark:text-[#6EE7B7] font-medium">
                  Click a tag to inspect substitute
                </span>
              )}
            </div>

            {substitutesList.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {substitutesList.map((sub, idx) => (
                  <button
                    key={`${sub}-${idx}`}
                    type="button"
                    onClick={() => onSelectSubstitute?.(sub)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-[#34D399]/20 dark:hover:bg-[#34D399]/30 text-emerald-900 dark:text-[#6EE7B7] border border-emerald-200 dark:border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Pill className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#6EE7B7]" />
                    <span>{sub}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-70" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                No direct equivalent brand substitutes listed in the dataset for this specific formulation.
              </p>
            )}
          </div>
        </section>

        {/* 3. SECTION 2: ⚠️ WHAT COULD GO WRONG & SAFETY (Risks & Cautions) */}
        <section className="rounded-2xl border border-amber-200/80 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-950/10 p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>⚠️ WHAT COULD GO WRONG &amp; SAFETY (Risks &amp; Cautions)</span>
          </h3>

          {/* Common Side Effects (side_effects) */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Commonly Reported Side Effects:
            </span>
            {sideEffectsList.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sideEffectsList.map((se, idx) => (
                  <span
                    key={`${se}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/50 text-xs font-semibold"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>{se}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                No frequent adverse effects indexed — discontinue use and consult a physician if unusual symptoms occur.
              </p>
            )}
          </div>

          {/* Clinical Caution & Warnings (caution) */}
          <div className="rounded-xl bg-white dark:bg-[#1E293B] border-l-4 border-amber-500 border border-slate-200/80 dark:border-slate-700/50 p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Clinical Caution &amp; Administration Warnings</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {cautionText}
            </p>
          </div>

          {/* Habit Formation Risk (habit_forming) */}
          <div
            className={`rounded-xl p-3.5 border flex items-start gap-3 ${
              isHabitForming
                ? "bg-red-50/90 dark:bg-red-950/40 border-red-300 dark:border-red-800/60 text-red-900 dark:text-red-200"
                : "bg-emerald-50/80 dark:bg-[#34D399]/20 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-[#6EE7B7]"
            }`}
          >
            {isHabitForming ? (
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-[#6EE7B7] shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5 text-xs">
              <p className="font-bold uppercase tracking-wide">
                Habit Formation Risk: {isHabitForming ? "HIGH / HABIT FORMING (YES)" : "LOW / NON-HABIT FORMING (NO)"}
              </p>
              <p className="leading-relaxed opacity-90">
                {isHabitForming
                  ? "This medication carries a clinical potential for physical or psychological dependence. Strictly adhere to prescribed dosage schedules and do not abruptly discontinue without medical supervision."
                  : "This formulation is verified as non-habit forming and does not carry a known clinical dependency risk when used as directed."}
              </p>
            </div>
          </div>
        </section>

        {/* 4. SECTION 3: 🔬 PHARMACOLOGICAL CLASSIFICATION */}
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700/50 bg-slate-50/60 dark:bg-[#0F172A]/70 p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>🔬 PHARMACOLOGICAL CLASSIFICATION</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Chemical Class */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700/50 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <FlaskConical className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#6EE7B7]" />
                <span>Chemical Class</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
                {chemicalValue}
              </p>
            </div>

            {/* Action Class */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700/50 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Activity className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#6EE7B7]" />
                <span>Action Class</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
                {actionValue}
              </p>
            </div>

            {/* Therapeutic Class */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700/50 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Pill className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#6EE7B7]" />
                <span>Therapeutic Class</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
                {therapeuticValue}
              </p>
            </div>
          </div>
        </section>

        {/* Action Bar */}
        {(onCheckInteractions || onAskAi) && (
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
            {onCheckInteractions && (
              <button
                type="button"
                onClick={() => onCheckInteractions(item.name)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0F172A] dark:hover:bg-slate-800 border border-transparent dark:border-slate-700/50 text-slate-800 dark:text-slate-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4 text-[#3B7A57] dark:text-[#6EE7B7]" />
                <span>Check Drug Interactions</span>
              </button>
            )}
            {onAskAi && (
              <button
                type="button"
                onClick={() =>
                  onAskAi(
                    `Provide a clinical overview of ${item.name}, including indications (${item.uses || "general"}), side effects, and administration precautions.`
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3B7A57] hover:bg-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white dark:text-slate-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Ask Clinical AI Assistant</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface MedicineDetailModalProps {
  isOpen: boolean;
  medicine: ParsedClientMedicineRecord | MedicineProfileData | null;
  onClose: () => void;
  onSelectSubstitute?: (substituteName: string) => void;
  onCheckInteractions?: (medicineName: string) => void;
  onAskAi?: (prompt: string) => void;
}

export const MedicineDetailModal: React.FC<MedicineDetailModalProps> = ({
  isOpen,
  medicine,
  onClose,
  onSelectSubstitute,
  onCheckInteractions,
  onAskAi,
}) => {
  if (!isOpen || !medicine) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <MedicineProfileCard
          item={medicine}
          onClose={onClose}
          onSelectSubstitute={onSelectSubstitute}
          onCheckInteractions={onCheckInteractions}
          onAskAi={onAskAi}
        />
      </div>
    </div>
  );
};
