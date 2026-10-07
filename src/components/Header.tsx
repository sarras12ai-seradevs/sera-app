import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Pill,
  Search,
  Sparkles,
  Sun,
  Moon,
  Menu,
  X,
  PhoneCall,
  GitCompare,
  ShieldAlert,
  Activity,
  Grid,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenAiAssistant: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch, onOpenAiAssistant }) => {
  const { theme, setTheme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { path: "/", label: "Home", icon: Grid },
    { path: "/medicines", label: "Medicines", icon: Pill },
    { path: "/symptoms", label: "Symptom Explorer", icon: Activity },
    { path: "/interactions", label: "Interaction Analyzer", icon: ShieldAlert },
    { path: "/compare", label: "Compare", icon: GitCompare },
    { path: "/emergency", label: "Emergency", icon: PhoneCall },
  ];

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-700/50 shadow-2xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          {/* Custom SERA Logomark: Light Mint Badge (#ecfdf5) + Dark Emerald Heart (#1b5e3a, strokeWidth="2") + Continuous Pastel Green (#34d399) Cursive 'sera' ECG Pulse */}
          <svg
            viewBox="0 0 50 50"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-10 h-10 shrink-0 group-hover:scale-105 transition-transform"
            aria-hidden="true"
          >
            {/* Light Mint Background Badge (#ecfdf5) */}
            <rect
              x="1"
              y="1"
              width="48"
              height="48"
              rx="13"
              fill="#ecfdf5"
              stroke="#a7f3d0"
              strokeWidth="1.2"
              className="dark:fill-[#062414] dark:stroke-emerald-800/80"
            />
            {/* Dark Emerald Heart Outline (#1b5e3a, strokeWidth="2") */}
            <path
              d="M 25 14.5 C 22.8 10 17 6.5 11.5 8.5 C 5.5 10.8 4 17.5 5 23.5 C 6.5 32 17.5 39 25 43 C 32.5 39 43.5 32 45 23.5 C 46 17.5 44.5 10.8 38.5 8.5 C 33 6.5 27.2 10 25 14.5 Z"
              stroke="#1b5e3a"
              className="dark:stroke-[#2ed58a]"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Continuous, Legible Pastel Green (#34d399) ECG Pulse Line spelling 'sera' in Smooth Cursive */}
            <path
              d="M 2 25 L 7 25 L 8.5 26.5 L 10.5 17 L 12.5 28.5 L 14 24.5 L 15 25 C 15.8 24.5 16.8 20.5 17.5 19.5 C 18.2 18.8 19 19.5 18.6 20.8 C 18 22.8 16 24 16.8 25.2 C 17.5 25.8 18.8 25.2 19.8 24.2 C 20.8 23 21.5 20.2 22 19.5 C 22.8 18.8 22 18.8 21.2 20.2 C 20.5 22 21.2 25.2 22.8 25.2 C 23.8 25.2 24.5 24.2 25.2 22.8 C 25.8 21.5 26.2 20 26.8 19.5 C 27.5 19.2 28.5 19.2 29 20 C 28.8 21.5 28.2 24.2 29.2 25.2 C 30 25.8 30.8 24.8 31.8 23 C 32.5 21.5 33 20 33.8 19.5 C 33 19.5 31.5 21 31.5 23 C 31.5 24.8 33 25.5 34.2 24.5 C 34.5 23 34.5 21 34.5 19.5 L 34.5 24.5 C 34.5 25.5 35.5 25.5 36.5 24.5 L 37 25 L 38.5 26.5 L 40.5 17 L 42.5 28.5 L 44 24.5 L 48 25"
              stroke="#34d399"
              className="dark:stroke-[#34d399]"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <span className="text-xl font-sans font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-baseline gap-1">
              SERA
              <sub className="text-[9px] text-slate-600 dark:text-slate-400 font-sans font-medium tracking-normal bottom-0 translate-y-0.5">
                1.0 beta
              </sub>
            </span>
            <span className="text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-400 block -mt-1 font-sans">
              Safety, Education &amp; Risk Awareness
            </span>
          </div>
        </Link>

        {/* Desktop Navigation - Flat text links with active underline indicator */}
        <nav className="hidden lg:flex items-center gap-6 h-16 font-sans text-xs font-medium">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`h-full flex items-center px-1 border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-b-2 border-emerald-700 dark:border-[#6EE7B7] text-emerald-800 dark:text-[#6EE7B7] font-semibold"
                    : "border-b-2 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700/50"
                }`}
              >
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Search Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-50 dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/50 hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-colors text-xs font-sans"
            title="Search medicines or symptoms"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#6EE7B7]" />
            <span className="hidden sm:inline">Search Medicines</span>
          </button>

          {/* Easy Light / Dark Mode Switch (Sun = Light, Moon = Dark) */}
          <div
            onClick={toggleTheme}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleTheme();
              }
            }}
            aria-label="Toggle Light and Dark Theme"
            title={theme === "light" ? "Switch to Soothing Dark Mode" : "Switch to Calm Light Mode"}
            className="inline-flex items-center p-1 rounded-full bg-slate-100 dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-700/50 cursor-pointer select-none transition-colors"
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                setTheme("light");
              }}
              className={`p-1.5 rounded-full transition-all flex items-center justify-center ${
                theme === "light"
                  ? "bg-white text-amber-600 shadow-xs"
                  : "text-slate-400 hover:text-slate-300"
              }`}
              title="Light Mode"
            >
              <Sun className="w-3.5 h-3.5" />
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setTheme("dark");
              }}
              className={`p-1.5 rounded-full transition-all flex items-center justify-center ${
                theme === "dark"
                  ? "bg-[#1E293B] text-[#6EE7B7] shadow-xs border border-slate-700/50"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Dark Mode"
            >
              <Moon className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* AI Assistant Button */}
          <button
            onClick={onOpenAiAssistant}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white dark:text-slate-100 transition-all shadow-xs text-xs font-semibold font-sans cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask Care Guide</span>
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-100 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] px-4 py-3 space-y-1 animate-in slide-in-from-top duration-150 font-sans shadow-md">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2.5 px-2 text-sm font-medium transition-colors border-b-2 ${
                  active
                    ? "border-b-2 border-emerald-700 dark:border-[#6EE7B7] text-emerald-800 dark:text-[#6EE7B7] font-semibold"
                    : "border-b-2 border-transparent text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};
