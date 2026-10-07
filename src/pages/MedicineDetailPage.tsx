import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Pill,
  ArrowLeft,
  ShieldCheck,
  Tag,
  AlertTriangle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Info,
  HelpCircle,
  CheckCircle2,
  Share2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Flame,
  ShieldX,
} from "lucide-react";
import { allMedicines } from "../data/medicinesData";
import { PlainEnglishToggle } from "../components/PlainEnglishToggle";
import { MedicineCard } from "../components/MedicineCard";
import { FAQItem } from "../types";

interface MedicineDetailPageProps {
  onOpenAiAssistant: (initialPrompt?: string) => void;
}

export const MedicineDetailPage: React.FC<MedicineDetailPageProps> = ({ onOpenAiAssistant }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [explanationMode, setExplanationMode] = useState<"plain" | "clinical">("plain");
  const [copied, setCopied] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const medicine = allMedicines.find((m) => m.id === id);

  if (!medicine) {
    return (
      <div className="py-20 text-center space-y-4 font-sans">
        <Pill className="w-12 h-12 text-emerald-700 dark:text-emerald-400 mx-auto" />
        <h2 className="text-2xl font-serif font-semibold text-slate-900 dark:text-slate-100">
          Medicine Not Found
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          The requested medicine does not exist in our directory.
        </p>
        <Link
          to="/medicines"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#3B7A57] dark:bg-emerald-700 text-white dark:text-slate-100 text-xs font-semibold hover:bg-emerald-800 dark:hover:bg-emerald-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </Link>
      </div>
    );
  }

  const relatedMedicines = allMedicines
    .filter((m) => m.category === medicine.category && m.id !== medicine.id)
    .slice(0, 3);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex((prev) => (prev === idx ? null : idx));
  };

  // Filter verified pharmacy links (No Netmeds, valid non-empty URLs only)
  const validPharmacies = (medicine.priceEstimates || []).filter(
    (p) => p.platform && p.platform.toLowerCase() !== "netmeds" && p.platformUrl && p.platformUrl.trim().length > 0
  );

  return (
    <div className="space-y-8 p-4 sm:p-8 pb-16 font-sans">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/" className="hover:text-emerald-800 dark:hover:text-[#6EE7B7] transition-colors">
          Home
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-400 dark:text-slate-400" />
        <Link to="/medicines" className="hover:text-emerald-800 dark:hover:text-[#6EE7B7] transition-colors">
          Medicines
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-400 dark:text-slate-400" />
        <span className="text-slate-900 dark:text-slate-100 font-semibold truncate">
          {medicine.name}
        </span>
      </nav>

      {/* Main Medicine Banner */}
      <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 sm:p-8 space-y-6 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700/50">
                {medicine.category}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] text-xs font-medium border border-emerald-200 dark:border-emerald-800/40">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-[#6EE7B7]" />
                {medicine.otcSafetyBadge}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-serif font-semibold text-slate-900 dark:text-slate-100">
              {medicine.name}
            </h1>

            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <p>
                <strong className="text-slate-800 dark:text-slate-300">Generic Name: </strong>
                {medicine.genericName}
              </p>
              <p>
                <strong className="text-slate-800 dark:text-slate-300">Brand Names: </strong>
                {medicine.brandNames.join(", ")}
              </p>
              <p>
                <strong className="text-slate-800 dark:text-slate-300">Active Ingredients: </strong>
                {medicine.activeIngredients.join(", ")}
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end gap-3 shrink-0">
            <PlainEnglishToggle
              mode={explanationMode}
              onChange={(m) => setExplanationMode(m)}
            />

            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="px-4 py-2 rounded-full bg-slate-100 dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700/50"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>{copied ? "Link Copied!" : "Share Link"}</span>
              </button>

              <button
                onClick={() => onOpenAiAssistant(`Tell me more about ${medicine.name} (${medicine.genericName}) usage, dosage limits, and precautions.`)}
                className="px-4 py-2 rounded-full bg-[#3B7A57] dark:bg-emerald-700 hover:bg-emerald-800 dark:hover:bg-emerald-600 text-white dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask AI Guide</span>
              </button>
            </div>
          </div>
        </div>

        {/* Form Badges & Symptoms Relieved */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-semibold mb-1.5 text-[10px]">
              Available Formulations:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {medicine.forms.map((f, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-slate-100 dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50">
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-semibold mb-1.5 text-[10px]">
              Primary Indications:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {medicine.symptomsRelieved.map((s, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-emerald-50/70 dark:bg-[#34D399]/20 text-emerald-900 dark:text-[#6EE7B7] border border-emerald-200/60 dark:border-emerald-800/40">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* STRICT SAFE DOSAGE & DURATION LIMITS */}
      <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 sm:p-8 space-y-4 transition-colors">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/50 pb-3">
          <Clock className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          <h2 className="text-lg font-serif font-semibold text-slate-900 dark:text-slate-100">
            Safe Dosage Limits &amp; Duration Rules
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Minimum Safe Dose */}
          <div className="bg-slate-50 dark:bg-[#0F172A] p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Recommended Min Safe Dose
            </span>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {medicine.dosage.recommendedMinimumSafeDose || medicine.dosage.adult}
            </p>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
              Initial therapeutic starting dose.
            </span>
          </div>

          {/* Maximum Daily Safe Limit */}
          <div className="bg-red-50/60 dark:bg-rose-950/40 p-4 rounded-2xl border border-red-200/70 dark:border-rose-500/50 space-y-1.5">
            <span className="text-[11px] font-bold text-red-700 dark:text-rose-300 uppercase tracking-wider block flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Max Daily Safe Limit
            </span>
            <p className="text-sm font-semibold text-red-900 dark:text-rose-200">
              {medicine.dosage.maxDailySafeLimit || medicine.dosage.maxDaily}
            </p>
            <span className="text-[10px] text-red-700/80 dark:text-rose-300/80 block">
              Do not exceed this threshold within any 24-hour window.
            </span>
          </div>

          {/* Maximum Continuous Duration */}
          <div className="bg-slate-50 dark:bg-[#0F172A] p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Max Continuous Safe Duration
            </span>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {medicine.dosage.maxContinuousDuration || medicine.safeUsageDuration || "Maximum 3-5 consecutive days."}
            </p>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
              Discontinue self-care if symptoms persist beyond this timeframe.
            </span>
          </div>
        </div>

        {/* Doctor Escalation Red-Flag Protocol */}
        <div className="bg-amber-50/60 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200/50 dark:border-amber-500/40 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="text-slate-900 dark:text-amber-200 block font-semibold">
              When to Consult a Doctor:
            </strong>
            <p className="text-slate-800 dark:text-slate-300 leading-relaxed text-sm">
              {medicine.dosage.doctorEscalationRules ||
                "If pain, fever, or distress worsens, fails to improve after 3 days, or is accompanied by high fever (>102°F), difficulty breathing, or severe abdominal pain, stop usage and consult a physician immediately."}
            </p>
          </div>
        </div>
      </div>

      {/* Main Detail Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* How It Works Explanation Box */}
          <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 space-y-3 transition-colors">
            <h3 className="text-base font-serif font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <span>What You Should Know &amp; How It Works</span>
              <span className="text-xs font-sans px-3 py-0.5 rounded-full bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-200 dark:border-emerald-800/40">
                {explanationMode === "plain" ? "Plain English View" : "Clinical Pharmacology"}
              </span>
            </h3>
            <p className="text-base text-slate-800 dark:text-slate-300 leading-relaxed">
              {explanationMode === "plain" ? medicine.simpleExplanation : medicine.clinicalExplanation}
            </p>
            <div className="text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700/50">
              <strong className="text-slate-800 dark:text-slate-300">Clinical Usage Note: </strong>{medicine.usage}
            </div>
          </div>

          {/* Dosage Guidance */}
          <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 space-y-4 transition-colors">
            <h3 className="text-base font-serif font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              <span>Administration Guidelines</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 dark:bg-[#0F172A] p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-1">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block">Adult Administration:</span>
                <p className="text-slate-700 dark:text-slate-300">{medicine.dosage.adult}</p>
              </div>

              <div className="bg-slate-50 dark:bg-[#0F172A] p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-1">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block">Child / Pediatric Protocol:</span>
                <p className="text-slate-700 dark:text-slate-300">{medicine.dosage.child}</p>
              </div>
            </div>

            <div className="bg-emerald-50/50 dark:bg-[#0F172A] p-4 rounded-xl border border-emerald-200/60 dark:border-slate-700/50 text-xs space-y-1">
              <span className="font-semibold text-emerald-900 dark:text-[#6EE7B7] block">Patient Instructions:</span>
              <p className="text-slate-800 dark:text-slate-300 text-sm leading-relaxed">{medicine.dosage.instructions}</p>
            </div>
          </div>

          {/* Side Effects & Safety Precautions */}
          <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 space-y-4 transition-colors">
            <h3 className="text-base font-serif font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>Side Effects &amp; Safety Precautions</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <span className="font-semibold text-slate-800 dark:text-slate-300 block uppercase tracking-wider text-[10px]">
                  Common Expected Effects:
                </span>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                  {medicine.sideEffects.common.map((se, i) => (
                    <li key={i}>{se}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-slate-800 dark:text-slate-300 block uppercase tracking-wider text-[10px]">
                  Rare / Emergency Red Flags:
                </span>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                  {medicine.sideEffects.rare.map((se, i) => (
                    <li key={i}>{se}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Warnings Box */}
            <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-500/40 rounded-xl p-4 text-xs space-y-2 text-slate-800 dark:text-amber-200">
              <span className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Important Clinical Warnings:
              </span>
              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                {medicine.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Comprehensive 5+ Categorized FAQs Accordion */}
          <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <span>Frequently Asked Questions ({medicine.categoryFAQs.length} FAQs)</span>
              </h3>
              <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-400">
                Patient Care Guide
              </span>
            </div>

            <div className="space-y-3">
              {medicine.categoryFAQs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="border border-slate-100 dark:border-slate-700/50 rounded-xl overflow-hidden transition-all bg-slate-50/70 dark:bg-[#0F172A]"
                  >
                    <button
                      onClick={() => toggleFaq(idx)}
                      className="w-full p-4 text-left flex items-start justify-between gap-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="space-y-1">
                        <span className="inline-block px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-200 dark:border-emerald-800/40">
                          {faq.category}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {faq.question}
                        </h4>
                      </div>
                      <div className="p-1 rounded-lg text-slate-500 dark:text-slate-400 mt-1">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-2 text-base text-slate-800 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-700/50 font-sans bg-white dark:bg-[#1E293B]">
                        <p>{faq.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sanitized E-Pharmacy Price Comparison */}
          {validPharmacies.length > 0 && (
            <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-serif font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <span>Verified Pharmacy Pricing &amp; Direct Search</span>
                </h3>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Live External Search</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {validPharmacies.map((price, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 dark:bg-[#0F172A] p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block text-xs">
                        {price.platform}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs mt-0.5 block">
                        {price.priceRange}
                      </span>
                    </div>

                    <a
                      href={price.platformUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/50 text-slate-800 dark:text-slate-300 hover:bg-[#3B7A57] dark:hover:bg-emerald-700 hover:text-white dark:hover:text-slate-100 hover:border-[#3B7A57] dark:hover:border-emerald-600 transition-colors font-semibold text-xs"
                    >
                      <span>Check on {price.platform}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-6">
          {/* Pregnancy & Alcohol Safety Card */}
          <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 space-y-4 text-xs transition-colors">
            <h4 className="font-serif font-semibold text-slate-900 dark:text-slate-100 text-base">
              Safety Profile &amp; Interactions
            </h4>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-100 dark:border-slate-700/50">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
                  Pregnancy &amp; Lactation:
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{medicine.pregnancySafety}</p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-100 dark:border-slate-700/50">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
                  Alcohol Interaction:
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{medicine.alcoholInteraction}</p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-100 dark:border-slate-700/50">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
                  Known Drug Interactions:
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{medicine.interactions.join(", ")}</p>
              </div>
            </div>

            <Link
              to={`/interactions?drug1=${medicine.id}`}
              className="w-full py-3 rounded-full bg-[#3B7A57] dark:bg-emerald-700 hover:bg-emerald-800 dark:hover:bg-emerald-600 text-white dark:text-slate-100 transition-colors font-semibold text-center block shadow-2xs"
            >
              Check Medication Safety
            </Link>
          </div>

          {/* Storage Information */}
          <div className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 space-y-3 text-xs transition-colors">
            <h4 className="font-serif font-semibold text-slate-900 dark:text-slate-100 text-base">
              Storage Conditions
            </h4>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{medicine.storage}</p>
          </div>
        </div>
      </div>

      {/* Related OTC Medicines */}
      {relatedMedicines.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-slate-200/70 dark:border-slate-700/50">
          <h3 className="text-xl font-serif font-semibold text-slate-900 dark:text-slate-100">
            Similar Medicines in {medicine.category}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedMedicines.map((m) => (
              <MedicineCard key={m.id} medicine={m} explanationMode={explanationMode} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
