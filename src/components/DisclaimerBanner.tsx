import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useDataset } from "../context/DatasetContext";

export const DisclaimerBanner: React.FC = () => {
  const { telemetryBanner } = useDataset();

  return (
    <div className="bg-emerald-50/70 dark:bg-[#1E293B] border-b border-emerald-200/60 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 text-xs py-2 px-4 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 font-medium">
        <div className="flex items-center gap-1.5 text-emerald-800 dark:text-[#6EE7B7] font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-[#6EE7B7] shrink-0" />
          <span>{telemetryBanner}</span>
        </div>
        <div className="flex items-center gap-1.5 text-center sm:text-right">
          <AlertTriangle className="w-3.5 h-3.5 text-emerald-700 dark:text-[#6EE7B7] shrink-0" />
          <span>
            <strong className="text-emerald-800 dark:text-[#6EE7B7]">Patient Safety Guidance:</strong> Educational reference only; not a substitute for physician care.
          </span>
        </div>
      </div>
    </div>
  );
};
