import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Heart, GraduationCap } from "lucide-react";
import { SeraLogo } from "./SeraLogo";

interface FooterProps {
  onOpenCredits: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenCredits }) => {
  return (
    <footer className="bg-white dark:bg-[#1E293B] border-t border-slate-100 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 font-sans transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <SeraLogo className="w-9 h-9 group-hover:scale-105 transition-transform" />
              <div>
                <span className="text-xl font-sans font-bold text-slate-900 dark:text-slate-100 flex items-baseline gap-1">
                  SERA
                  <sub className="text-[9px] text-slate-600 dark:text-slate-400 font-sans font-medium tracking-normal bottom-0 translate-y-0.5">
                    1.0 beta
                  </sub>
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 -mt-1 block font-sans">
                  Safety, Education &amp; Risk Awareness
                </span>
              </div>
            </Link>
            <p className="text-xs leading-relaxed max-w-md text-slate-600 dark:text-slate-400">
              <strong className="text-slate-800 dark:text-slate-300">SERA (Safety, Education &amp; Risk Awareness)</strong> is a patient-friendly clinical guidance platform dedicated to empowering everyday people with clear, evidence-based information on over-the-counter (OTC) medicines, active ingredients, dosage limits, and multi-drug interaction safety.
            </p>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700 dark:text-[#6EE7B7]" />
              <span>Referenced against CDSCO (India), US FDA, &amp; WHO Essential Medicines databases.</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100 mb-3 font-sans">
              Care Modules
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/" className="hover:text-emerald-800 dark:hover:text-[#6EE7B7] transition-colors">
                  Home Overview
                </Link>
              </li>
              <li>
                <Link to="/medicines" className="hover:text-emerald-800 dark:hover:text-[#6EE7B7] transition-colors">
                  OTC Medicine Directory
                </Link>
              </li>
              <li>
                <Link to="/symptoms" className="hover:text-emerald-800 dark:hover:text-[#6EE7B7] transition-colors">
                  Interactive Symptom Explorer
                </Link>
              </li>
              <li>
                <Link to="/interactions" className="hover:text-emerald-800 dark:hover:text-[#6EE7B7] transition-colors">
                  Medication Safety Check
                </Link>
              </li>
              <li>
                <Link to="/compare" className="hover:text-emerald-800 dark:hover:text-[#6EE7B7] transition-colors">
                  Side-by-Side Medicine Comparison
                </Link>
              </li>
              <li>
                <Link to="/emergency" className="text-red-600 dark:text-rose-400 hover:underline font-semibold transition-colors">
                  Emergency Helplines (911 / 112 / 999)
                </Link>
              </li>
            </ul>
          </div>

          {/* Academic & Credits */}
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100 mb-3 font-sans">
              Clinical Care &amp; Safety
            </h4>
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Designed for clear, accessible medication safety awareness for students, families, and patients.
              </p>
              <button
                onClick={onOpenCredits}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-50 dark:bg-[#0F172A] text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-all text-xs font-semibold shadow-2xs"
              >
                <GraduationCap className="w-3.5 h-3.5 text-emerald-700 dark:text-[#6EE7B7]" />
                <span>About SERA &amp; Clinical Sources</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Disclaimer Footnote */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-700/50 text-[11px] text-center text-slate-500 dark:text-slate-400 space-y-2">
          <p>
            <strong className="text-slate-700 dark:text-slate-300">Patient Care Notice:</strong> SERA does not sell, distribute, or prescribe medications. Always consult a licensed physician or pharmacist for medical advice or urgent healthcare situations.
          </p>
          <p className="flex items-center justify-center gap-1">
            <span>Crafted with</span>
            <Heart className="w-3.5 h-3.5 text-red-600 dark:text-rose-400 fill-red-600 dark:fill-rose-400 inline" />
            <span>for Patient Safety &amp; Health Literacy</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
