import React from "react";
import { ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";

export interface SeverityChartItem {
  name: string;
  count: number;
  color: string;
  percentage?: number;
}

/**
 * Canonical severity classifier shared across the summary banner calculation,
 * risk distribution bar chart, and interaction checker in all environments.
 */
export function classifyCsvInteractionSeverity(
  description?: string,
  explicitSeverity?: string
): "Severe" | "Moderate" | "Minor" {
  const s = (explicitSeverity || "").toLowerCase();
  const d = (description || "").toLowerCase();

  if (
    s === "severe" ||
    s === "major" ||
    d.includes("adverse effects can be increased") ||
    d.includes("cardiotoxic") ||
    d.includes("severe") ||
    d.includes("toxicity") ||
    d.includes("toxic") ||
    d.includes("hemorrhage") ||
    d.includes("bleeding") ||
    d.includes("arrhythmia") ||
    d.includes("fatal") ||
    d.includes("hyperkalemia") ||
    d.includes("apnea") ||
    d.includes("prolong")
  ) {
    return "Severe";
  }

  if (
    s === "moderate" ||
    d.includes("metabolism") ||
    d.includes("serum concentration") ||
    d.includes("therapeutic") ||
    d.includes("moderate") ||
    d.includes("monitor")
  ) {
    return "Moderate";
  }

  return "Minor";
}

/**
 * Standardize severity levels:
 * - Major / High Risk -> #EF4444 (Red)
 * - Moderate Caution -> #F59E0B (Amber/Yellow)
 * - Minor / Informational -> #10B981 (Green/Teal)
 */
export function aggregateSeverityCounts(
  records: Array<{ description?: string; severity?: string; "Interaction Description"?: string }>
): SeverityChartItem[] {
  let major = 0;
  let moderate = 0;
  let minor = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const desc = r.description || r["Interaction Description"] || "";
    const level = classifyCsvInteractionSeverity(desc, r.severity);

    if (level === "Severe") {
      major++;
    } else if (level === "Moderate") {
      moderate++;
    } else {
      minor++;
    }
  }

  return [
    { name: "Major / High Risk", count: major, color: "#EF4444" },
    { name: "Moderate Caution", count: moderate, color: "#F59E0B" },
    { name: "Minor / Informational", count: minor, color: "#10B981" },
  ];
}

interface SeverityBarChartProps {
  data: SeverityChartItem[];
  totalCount: number;
  activeFilter?: string;
  className?: string;
}

/**
 * Clean, streamlined risk distribution card view.
 * Replaces the heavy Recharts canvas/SVG bar graphic with a responsive,
 * lightweight proportional distribution bar and clinical risk breakdown cards.
 */
export const SeverityBarChart: React.FC<SeverityBarChartProps> = ({
  data,
  totalCount,
  activeFilter,
  className = "",
}) => {
  const majorItem = data.find((d) => d.name.includes("Major")) || { count: 0, color: "#EF4444" };
  const moderateItem = data.find((d) => d.name.includes("Moderate")) || { count: 0, color: "#F59E0B" };
  const minorItem = data.find((d) => d.name.includes("Minor")) || { count: 0, color: "#10B981" };

  const validTotal = totalCount > 0 ? totalCount : majorItem.count + moderateItem.count + minorItem.count;

  const majorPct = validTotal > 0 ? (majorItem.count / validTotal) * 100 : 0;
  const moderatePct = validTotal > 0 ? (moderateItem.count / validTotal) * 100 : 0;
  const minorPct = validTotal > 0 ? (minorItem.count / validTotal) * 100 : 0;

  return (
    <div
      className={`bg-white dark:bg-[#18201C] rounded-2xl border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-sm dark:shadow-md transition-colors ${className}`}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Interaction Risk Distribution
            </span>
            {activeFilter && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 truncate max-w-xs border border-slate-200 dark:border-white/10">
                Filtered: {activeFilter}
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-serif font-semibold text-slate-900 dark:text-white mt-0.5">
            Severity Level Breakdown
          </h3>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Total Analyzed:{" "}
          <span className="font-bold text-slate-900 dark:text-white font-mono">
            {validTotal.toLocaleString()} {validTotal === 1 ? "Pair" : "Pairs"}
          </span>
        </div>
      </div>

      {/* Streamlined Multi-Segment Proportional Progress Bar */}
      <div className="space-y-2">
        <div className="h-2.5 sm:h-3 w-full rounded-full bg-slate-100 dark:bg-white/5 flex overflow-hidden p-0.5 gap-0.5">
          {majorPct > 0 && (
            <div
              style={{ width: `${majorPct}%` }}
              className="h-full bg-red-500 rounded-sm transition-all duration-500 ease-out"
              title={`Major: ${majorItem.count.toLocaleString()} (${majorPct.toFixed(1)}%)`}
            />
          )}
          {moderatePct > 0 && (
            <div
              style={{ width: `${moderatePct}%` }}
              className="h-full bg-amber-500 rounded-sm transition-all duration-500 ease-out"
              title={`Moderate: ${moderateItem.count.toLocaleString()} (${moderatePct.toFixed(1)}%)`}
            />
          )}
          {minorPct > 0 && (
            <div
              style={{ width: `${minorPct}%` }}
              className="h-full bg-emerald-500 rounded-sm transition-all duration-500 ease-out"
              title={`Minor: ${minorItem.count.toLocaleString()} (${minorPct.toFixed(1)}%)`}
            />
          )}
        </div>
      </div>

      {/* 3 Clean, Streamlined Risk Distribution Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 mt-5">
        {/* Major / High Risk Card */}
        <div className="bg-red-50/70 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40 rounded-xl p-4 sm:p-4.5 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 font-semibold text-xs uppercase tracking-wide">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>Major Risk</span>
              </div>
              <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full bg-red-100/90 dark:bg-red-900/50 text-red-800 dark:text-red-300 border border-red-200/60 dark:border-red-800/40">
                {majorPct.toFixed(1)}%
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 dark:text-white mt-1">
              {majorItem.count.toLocaleString()}
            </div>
          </div>
          <p className="text-xs text-red-900/80 dark:text-red-300/80 mt-3 leading-relaxed">
            Severe adverse effects, cardiotoxicity, fatal risks, or critical clinical contraindications.
          </p>
        </div>

        {/* Moderate Caution Card */}
        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-4 sm:p-4.5 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-xs uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Moderate Caution</span>
              </div>
              <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full bg-amber-100/90 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                {moderatePct.toFixed(1)}%
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 dark:text-white mt-1">
              {moderateItem.count.toLocaleString()}
            </div>
          </div>
          <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-3 leading-relaxed">
            Altered serum concentrations, metabolic interference, or required dosage adjustments.
          </p>
        </div>

        {/* Minor / Informational Card */}
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl p-4 sm:p-4.5 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-xs uppercase tracking-wide">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Minor / Info</span>
              </div>
              <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-100/90 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                {minorPct.toFixed(1)}%
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 dark:text-white mt-1">
              {minorItem.count.toLocaleString()}
            </div>
          </div>
          <p className="text-xs text-emerald-900/80 dark:text-emerald-300/80 mt-3 leading-relaxed">
            Mild clinical significance, low adverse potential, or manageable co-administration.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SeverityBarChart;
