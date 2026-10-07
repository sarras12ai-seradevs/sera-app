import React, { useEffect } from "react";
import { X, Code2, GraduationCap, Sparkles, BookOpen, Layers, ShieldCheck, HeartPulse, ShieldAlert, Activity } from "lucide-react";

interface ProjectCreditsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectCreditsDrawer: React.FC<ProjectCreditsDrawerProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity font-sans">
      <div className="w-full max-w-lg bg-white dark:bg-[#1E293B] border-l border-slate-100 dark:border-slate-700/50 shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-[#F7F9F7] dark:bg-[#0F172A]">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-100 dark:border-emerald-500/30">
              <GraduationCap className="w-5 h-5 text-[#3B7A57] dark:text-[#6EE7B7]" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-semibold text-slate-900 dark:text-slate-100">About SERA</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Safety, Education &amp; Risk Awareness</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-700 dark:text-slate-300 font-sans">
          {/* Section 1: Overview & Full Form */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-[#6EE7B7] font-semibold uppercase tracking-wider text-xs">
              <HeartPulse className="w-4 h-4 text-[#3B7A57] dark:text-[#6EE7B7]" />
              <span>Identity &amp; Purpose</span>
            </div>
            <h3 className="text-2xl font-serif font-semibold text-slate-900 dark:text-slate-100">
              SERA
            </h3>
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-[#34D399]/20 border border-emerald-200/60 dark:border-emerald-500/30 text-xs">
              <span className="font-bold text-emerald-900 dark:text-slate-100 block mb-1 text-sm">
                Full Form: Safety, Education &amp; Risk Awareness
              </span>
              <span className="font-serif italic text-emerald-800 dark:text-[#6EE7B7] font-semibold">
                Tagline: “Know Before You Take.”
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              SERA is an open clinical informatics and educational health platform engineered to bridge the gap between complex pharmaceutical jargon and everyday consumer decisions.
            </p>
          </div>

          {/* Section 2: The Three SERA Pillars */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-[#6EE7B7] font-semibold uppercase tracking-wider text-xs">
              <ShieldCheck className="w-4 h-4 text-[#3B7A57] dark:text-[#6EE7B7]" />
              <span>The Three Core Pillars</span>
            </div>
            <div className="space-y-2.5">
              {/* S Pillar */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-slate-700/50 text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[#3B7A57] dark:bg-emerald-700 text-white dark:text-slate-100 flex items-center justify-center font-bold font-serif text-sm">
                    S
                  </span>
                  <strong className="text-slate-900 dark:text-slate-100 text-sm">Safety</strong>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                  Strict active ingredient dosage limits, maximum daily intake guardrails (e.g., 4,000mg Paracetamol limits), duration caps, and pregnancy/alcohol safety warnings.
                </p>
              </div>

              {/* E Pillar */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-slate-700/50 text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[#3B7A57] dark:bg-emerald-700 text-white dark:text-slate-100 flex items-center justify-center font-bold font-serif text-sm">
                    E
                  </span>
                  <strong className="text-slate-900 dark:text-slate-100 text-sm">Education</strong>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                  Transparent plain English translations paired with clinical pharmacodynamics, symptom exploration, home remedies, and comprehensive FAQ guidance.
                </p>
              </div>

              {/* R Pillar */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-slate-700/50 text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[#3B7A57] dark:bg-emerald-700 text-white dark:text-slate-100 flex items-center justify-center font-bold font-serif text-sm">
                    R
                  </span>
                  <strong className="text-slate-900 dark:text-slate-100 text-sm">Risk Awareness</strong>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                  Multi-medication interaction analysis across 248,000+ medicines, red-flag emergency symptom triage, and instant helpline escalation.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Course & Academic Context */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-slate-700/50 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-[#6EE7B7] font-semibold text-xs">
              <GraduationCap className="w-4 h-4 text-[#3B7A57] dark:text-[#6EE7B7]" />
              <span>Academic Context</span>
            </div>
            <p className="text-xs text-slate-900 dark:text-slate-100 font-semibold">
              Course: Healthcare Informatics &amp; Medical Systems Design
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Objective: Eliminate accidental OTC medication overdose and adverse drug-drug interactions through evidence-based clinical retrieval and intuitive patient-friendly design.
            </p>
          </div>

          {/* Section 4: Technical Architecture */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-xs">
              <Code2 className="w-4 h-4" />
              <span>Platform Capabilities</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-slate-700/50">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block">Frontend SPA</span>
                <span className="text-slate-500 dark:text-slate-400">React 19 + TypeScript</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-slate-700/50">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block">Design System</span>
                <span className="text-slate-500 dark:text-slate-400">Slate &amp; Clinical Sage</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-slate-700/50">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block">Medicine Index</span>
                <span className="text-slate-500 dark:text-slate-400">248,000+ Verified Drugs</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-100 dark:border-slate-700/50">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block">Safety Engine</span>
                <span className="text-slate-500 dark:text-slate-400">Verified DDI Knowledge Base</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F7F9F7] dark:bg-[#0F172A] border-t border-slate-100 dark:border-slate-700/50 text-xs text-center text-slate-500 dark:text-slate-400">
          Shortcut: <kbd className="px-1.5 py-0.5 rounded-sm bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/50 text-[10px]">Cmd+Shift+C</kbd>
        </div>
      </div>
    </div>
  );
};
