import React, { useState } from "react";
import {
  PhoneCall,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Check,
  HeartPulse,
  Activity,
  PhoneForwarded,
} from "lucide-react";
import { helplineRegions } from "../data/helplinesData";

export const EmergencyPage: React.FC = () => {
  const [selectedRegionCode, setSelectedRegionCode] = useState("US");
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  const currentRegion =
    helplineRegions.find((r) => r.code === selectedRegionCode) || helplineRegions[0];

  const handleCopy = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const emergencyRedFlags = [
    {
      title: "Anaphylaxis (Severe Acute Allergic Reaction)",
      symptoms: "Swelling of lips, tongue, or throat; sudden airway constriction, hives, rapid pulse drop, or dizziness.",
      action: "Call Universal Emergency Services (911 / 112 / 999) immediately. Administer auto-injector Epinephrine (EpiPen) if available.",
    },
    {
      title: "Suspected Toxicity or Accidental Overdose",
      symptoms: "Unconsciousness, vomiting, extreme drowsiness, pinpoint pupils, confusion, or convulsions after pill ingestion.",
      action: "Contact Poison Control Center immediately. Do NOT induce vomiting or administer fluids unless explicitly instructed by toxicologists.",
    },
    {
      title: "Acute Crushing Chest Pain or Pressure",
      symptoms: "Substernal chest pressure radiating to left shoulder, jaw, neck, or back accompanied by cold diaphoresis.",
      action: "Call Emergency Dispatch immediately. Keep the patient in a seated resting position and avoid exertion.",
    },
    {
      title: "Severe Respiratory Compromise (Dyspnea)",
      symptoms: "Inability to speak in full sentences, cyanosis (bluish tint on lips or fingernails), intercostal retractions.",
      action: "Call emergency ambulance dispatch immediately. Loosen tight neck clothing and ensure unobstructed airway.",
    },
  ];

  return (
    <div className="space-y-8 p-4 sm:p-8 pb-16 font-sans">
      {/* Alert Banner */}
      <div className="bg-red-50 dark:bg-rose-950/40 border-2 border-red-500 dark:border-rose-500/60 text-red-900 dark:text-rose-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-red-600 dark:bg-rose-600 text-white shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-rose-300">
              Immediate Medical Crisis Triage
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-red-900 dark:text-rose-200">
              Emergency Helplines &amp; First Aid Protocols
            </h1>
          </div>
        </div>

        <p className="text-base text-slate-800 dark:text-slate-300 max-w-3xl leading-relaxed">
          If you or someone around you is experiencing life-threatening symptoms, anaphylaxis, severe respiratory distress, or an acute pharmaceutical overdose, contact emergency response dispatch immediately.
        </p>
      </div>

      {/* Country/Region Switcher & Helplines Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-[#6EE7B7] block mb-0.5">
              Global Regional Dispatch
            </span>
            <h2 className="text-xl font-serif font-semibold text-slate-900 dark:text-slate-100">
              Verified Emergency Contact Directory
            </h2>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {helplineRegions.map((reg) => (
              <button
                key={reg.code}
                onClick={() => setSelectedRegionCode(reg.code)}
                className={`px-4 py-2 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedRegionCode === reg.code
                    ? "bg-[#3B7A57] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white dark:text-slate-100 shadow-2xs"
                    : "bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 hover:border-emerald-300 dark:hover:border-emerald-500/40"
                }`}
              >
                <span>{reg.flag}</span>
                <span>{reg.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Helplines Grid for Selected Region */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentRegion.numbers.map((item, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-between transition-all bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {currentRegion.name} {item.isPrimary ? "• Primary Priority" : "• Support Line"}
                  </span>
                  <PhoneCall className="w-4 h-4 text-emerald-700 dark:text-[#6EE7B7]" />
                </div>

                <h3 className="text-base font-serif font-semibold text-slate-900 dark:text-slate-100">
                  {item.title}
                </h3>

                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed min-h-[36px]">
                  {item.desc}
                </p>

                {/* Prominent High-Visibility Number Badge */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-2">
                  <div className="font-mono text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight select-all">
                    {item.number}
                  </div>
                  {item.isPrimary && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-rose-950/60 text-red-700 dark:text-rose-200 border border-red-200 dark:border-rose-500/40 shrink-0">
                      24/7 Rapid
                    </span>
                  )}
                </div>
              </div>

              {/* Action Bar (Desktop Copy Button + Mobile Click-to-Call) */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-2 mt-4">
                <button
                  onClick={() => handleCopy(item.number)}
                  className="flex-1 py-2.5 px-4 rounded-full bg-slate-50 dark:bg-[#0F172A] hover:bg-emerald-50 dark:hover:bg-[#34D399]/20 text-slate-800 dark:text-slate-300 hover:text-emerald-900 dark:hover:text-[#6EE7B7] font-semibold text-xs transition-all inline-flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700/50 cursor-pointer"
                >
                  {copiedNumber === item.number ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-700 dark:text-[#6EE7B7]" />
                      <span className="text-emerald-800 dark:text-[#6EE7B7] font-bold">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Copy Number</span>
                    </>
                  )}
                </button>

                {/* Mobile-only direct tel: call trigger */}
                <a
                  href={`tel:${item.number.replace(/[^0-9]/g, "")}`}
                  className="sm:hidden p-2.5 rounded-full bg-red-600 dark:bg-rose-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center justify-center shrink-0 shadow-2xs"
                  title="Call Directly"
                >
                  <PhoneCall className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Critical First Aid Triage Protocol */}
      <div className="space-y-4 pt-6 border-t border-slate-200/70 dark:border-slate-700/50">
        <h2 className="text-xl font-serif font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-red-600 dark:text-rose-400" />
          <span>Emergency Red Flag Triage Protocols</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {emergencyRedFlags.map((flag, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#1E293B] shadow-sm dark:shadow-xl border border-red-200 dark:border-rose-500/40 rounded-2xl p-6 space-y-3"
            >
              <h3 className="text-base font-bold text-red-900 dark:text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-rose-400 shrink-0" />
                <span>{flag.title}</span>
              </h3>

              <div className="text-sm space-y-1">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                  Observed Symptoms:
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{flag.symptoms}</p>
              </div>

              <div className="bg-red-600 dark:bg-rose-600 text-white p-4 rounded-xl text-sm space-y-1 font-medium">
                <span className="font-bold block text-xs uppercase tracking-wider text-red-100 dark:text-rose-100">
                  Required Action:
                </span>
                <p className="leading-relaxed">{flag.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
