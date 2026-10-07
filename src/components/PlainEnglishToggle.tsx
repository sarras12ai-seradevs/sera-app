import React from "react";
import { BookOpen, Sparkles } from "lucide-react";

// Access Gemini API key with fallback for client/static deployments (e.g., Netlify)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;

interface PlainEnglishToggleProps {
  mode: "clinical" | "plain";
  onChange: (mode: "clinical" | "plain") => void;
  className?: string;
}

export const PlainEnglishToggle: React.FC<PlainEnglishToggleProps> = ({ mode, onChange, className = "" }) => {
  return (
    <div className={`inline-flex items-center p-1 bg-slate-100 dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-700/50 rounded-full shadow-2xs ${className}`}>
      <button
        onClick={() => onChange("plain")}
        type="button"
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
          mode === "plain"
            ? "bg-[#3B7A57] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white dark:text-slate-100 shadow-xs"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        }`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Plain English</span>
      </button>
      <button
        onClick={() => onChange("clinical")}
        type="button"
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
          mode === "clinical"
            ? "bg-[#3B7A57] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white dark:text-slate-100 shadow-xs"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        }`}
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span>Clinical Terms</span>
      </button>
    </div>
  );
};
