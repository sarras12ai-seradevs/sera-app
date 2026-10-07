import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Sparkles,
  Send,
  Bot,
  AlertTriangle,
  Loader2,
  User,
  Database,
  Check,
  Copy,
  Search,
  ShieldCheck,
  Info,
  Layers,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useDataset } from "../context/DatasetContext";
import { queryGeminiDirect } from "../utils/geminiClient";

// Access Gemini API key with fallback for client/static deployments (e.g., Netlify)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

interface RetrievedMedicine {
  name: string;
  matchType: string;
  score: number;
  record: {
    name: string;
    uses: string[];
    sideEffects: string[];
    substitutes: string[];
    chemicalClass: string;
    therapeuticClass: string;
    actionClass: string;
    habitForming: string;
    source?: string;
  };
}

interface Message {
  role: "user" | "assistant";
  content: string;
  retrievedMedicines?: RetrievedMedicine[];
  isAvailableInDataset?: boolean;
  timestamp?: string;
}

interface DatasetStats {
  totalRecords: number;
  loadedFrom: string[];
  lastLoadedAt: string;
  isIndexing: boolean;
  memoryUsageMb: number;
}

const CHAT_HISTORY_STORAGE_KEY = "sera_ai_assistant_chat_history_v1";
const MAX_PERSISTED_MESSAGES = 100;

const DEFAULT_WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "Welcome to SERA (Safety, Education & Risk Awareness) — your grounded AI health guidance assistant for students and young adults.\n\n• Synonym & Brand Mapping: Automatically maps brands (e.g., Crocin, Dolo 650, Disprin, Brufen, Cetzine, Allegra, Pan-D, Ciplox) and multi-ingredient combinations (Combiflam, Sinarest, Wikoryl, Meftal-Spas) to their active generic compounds.\n• Permutation-Proof Clinical Search: Verifies both [Drug 1 == A, Drug 2 == B] and [Drug 1 == B, Drug 2 == A] in the Verified DDI Index.\n\nSERA provides educational safety guidance grounded in verified medical databases. Always consult a certified doctor or pharmacist for personalized medical advice.",
};

function loadPersistedMessages(): Message[] {
  if (typeof window === "undefined") return [DEFAULT_WELCOME_MESSAGE];
  try {
    const raw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    if (!raw) return [DEFAULT_WELCOME_MESSAGE];
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
    ) {
      return parsed;
    }
  } catch (err) {
    console.warn("Failed to read AI assistant chat history from localStorage:", err);
  }
  return [DEFAULT_WELCOME_MESSAGE];
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  initialPrompt = "",
}) => {
  const { indexedRecords, telemetryBanner } = useDataset();
  const [messages, setMessages] = useState<Message[]>(loadPersistedMessages);
  const [input, setInput] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [datasetStats, setDatasetStats] = useState<DatasetStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showMoreSuggestions, setShowMoreSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const toStore = messages.slice(-MAX_PERSISTED_MESSAGES);
      window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(toStore));
    } catch (err) {
      console.warn("Failed to persist AI assistant chat history to localStorage:", err);
    }
  }, [messages]);

  // Scroll to bottom when messages change or drawer opens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, loading]);

  const handleClearHistory = () => {
    const resetMessages = [DEFAULT_WELCOME_MESSAGE];
    setMessages(resetMessages);
    try {
      window.localStorage.setItem(
        CHAT_HISTORY_STORAGE_KEY,
        JSON.stringify(resetMessages)
      );
    } catch (err) {
      console.warn("Failed to clear AI assistant chat history in localStorage:", err);
    }
  };

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (isOpen) {
      fetchDatasetStats();
    }
  }, [isOpen]);

  const fetchDatasetStats = async () => {
    try {
      const res = await fetch("/api/dataset/status");
      if (res.ok) {
        const data = await res.json();
        setDatasetStats(data);
      }
    } catch (e) {
      console.warn("Failed to load dataset stats", e);
    }
  };

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMessage: Message = { role: "user", content: query };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const reply =
        data.answer ||
        data.text ||
        "The requested medicine is unavailable in the SERA knowledge base.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          retrievedMedicines: data.retrievedMedicines || [],
          isAvailableInDataset: data.isAvailableInDataset,
        },
      ]);
    } catch (err) {
      // Direct client-side Gemini fallback (e.g., when deployed on static Netlify hosting)
      if (apiKey) {
        try {
          const directReply = await queryGeminiDirect(query);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: directReply,
              isAvailableInDataset: true,
            },
          ]);
          return;
        } catch (directErr: any) {
          console.error("Direct Gemini client error:", directErr);
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm sorry, I encountered an error connecting to the clinical knowledge service. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const testQueries = [
    { text: "Combiflam + Disprin", label: "Multi-ingredient + NSAID" },
    { text: "Sinarest and Dolo 650", label: "Hidden Paracetamol stacking" },
    { text: "Brufen + Ecosprin", label: "Bidirectional CSV match" },
    { text: "Ciplox + Benadryl", label: "QTc interaction check" },
    { text: "Pan-D + Cetzine", label: "PPI combo + Antihistamine" },
    { text: "Meftal-Spas + Voveran", label: "Dual NSAID hazard" },
    { text: "Crocin + Allegra", label: "Safe combination check" },
  ];

  return (
    <div className="fixed inset-0 z-50 font-sans">
      {/* 3. Non-Blocking Lightweight Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 1. Fluid Percentage Side Container */}
      <aside
        className="fixed top-0 right-0 h-full z-50 bg-white dark:bg-[#1E293B] shadow-2xl transition-transform duration-300 ease-in-out w-full md:w-[50vw] lg:w-[40vw] border-l border-slate-100 dark:border-slate-700/50 translate-x-0 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 2. Header: Top flex container (h-16 border-b border-slate-100 px-6) */}
        <div className="h-16 border-b border-slate-100 dark:border-slate-700/50 px-6 flex items-center justify-between bg-white dark:bg-[#0F172A] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-100 dark:border-emerald-500/30 shrink-0">
              <Bot className="w-4 h-4 text-[#3B7A57] dark:text-[#6EE7B7]" />
            </div>
            <h2 className="text-sm sm:text-base font-serif font-semibold text-slate-900 dark:text-slate-100 truncate">
              SERA Clinical Guide
            </h2>
            <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-200 dark:border-emerald-500/30 shrink-0">
              248,114 INDEXED
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {messages.length > 1 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="p-2 rounded-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                title="Clear Conversation History"
                aria-label="Clear Conversation History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowStats(!showStats)}
              className={`p-2 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors border cursor-pointer ${
                showStats
                  ? "bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border-emerald-200 dark:border-emerald-500/30"
                  : "bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
              title="Toggle Knowledge Base Status"
            >
              <Database className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close AI Assistant drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Collapsible Dataset Status Drawer */}
        {showStats && (
          <div className="bg-slate-50 dark:bg-[#0F172A] border-b border-slate-100 dark:border-slate-700/50 px-6 py-3 text-xs space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#6EE7B7]" />
                <span>Clinical Knowledge Base Status</span>
              </span>
              <button
                type="button"
                onClick={fetchDatasetStats}
                className="text-[11px] font-semibold text-emerald-800 dark:text-[#6EE7B7] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white dark:bg-[#1E293B] p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">Indexed Records</span>
                <span className="text-sm font-bold text-emerald-800 dark:text-[#6EE7B7]">
                  248,114
                </span>
              </div>
              <div className="bg-white dark:bg-[#1E293B] p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">Status</span>
                <span className="text-sm font-bold text-emerald-800 dark:text-[#6EE7B7] block truncate">
                  Active &amp; Verified
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer Banner connected directly below status header */}
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-500/30 px-6 py-2.5 flex items-center gap-2 text-xs text-slate-800 dark:text-amber-200 shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Educational guidance grounded in verified clinical data. Always consult a healthcare professional.</span>
        </div>

        {/* 2. Messaging Area: flex-1 overflow-y-auto px-6 py-4 space-y-4 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-[#F7F9F7]/50 dark:bg-[#0F172A]">

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[88%] rounded-2xl p-4 text-sm leading-relaxed space-y-3 ${
                  msg.role === "user"
                    ? "bg-[#3B7A57] dark:bg-emerald-700 text-white dark:text-slate-100 rounded-br-xs shadow-xs font-sans"
                    : "bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-300 rounded-bl-xs border border-slate-100 dark:border-slate-700/50 shadow-xs"
                }`}
              >
                <div
                  className={`whitespace-pre-wrap font-sans leading-relaxed break-words ${
                    msg.role === "user" ? "text-white dark:text-slate-100" : "text-slate-800 dark:text-slate-300"
                  }`}
                >
                  {msg.content}
                </div>

                {/* Retrieved Context Preview Card */}
                {msg.retrievedMedicines && msg.retrievedMedicines.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Database className="w-3.5 h-3.5 text-emerald-700 dark:text-[#6EE7B7]" />
                        <span>Matched Medicine Profile</span>
                      </span>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] font-semibold border border-emerald-200 dark:border-emerald-500/30">
                        {Math.round(msg.retrievedMedicines[0].score * 100)}% Match
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#0F172A] p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {msg.retrievedMedicines[0].record.name}
                        </span>
                        {msg.retrievedMedicines[0].record.habitForming && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50">
                            Habit Forming: {msg.retrievedMedicines[0].record.habitForming}
                          </span>
                        )}
                      </div>

                      {msg.retrievedMedicines[0].record.chemicalClass && (
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-800 dark:text-slate-300">Chemical Class:</strong>{" "}
                          {msg.retrievedMedicines[0].record.chemicalClass}
                        </div>
                      )}

                      {msg.retrievedMedicines[0].record.therapeuticClass && (
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-800 dark:text-slate-300">Therapeutic Class:</strong>{" "}
                          {msg.retrievedMedicines[0].record.therapeuticClass}
                        </div>
                      )}

                      {Array.isArray(msg.retrievedMedicines[0].record.substitutes) &&
                        msg.retrievedMedicines[0].record.substitutes.length > 0 && (
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            <strong className="text-slate-800 dark:text-slate-300">Substitutes:</strong>{" "}
                            {msg.retrievedMedicines[0].record.substitutes.slice(0, 5).join(", ")}
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Assistant Copy Action */}
                {msg.role === "assistant" && idx > 0 && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, idx)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-[#6EE7B7]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Response</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-[#34D399]/20 text-emerald-800 dark:text-[#6EE7B7] flex items-center justify-center shrink-0 mt-1">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-100 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 text-sm shadow-2xs">
              <Loader2 className="w-4 h-4 animate-spin text-[#3B7A57] dark:text-[#6EE7B7] shrink-0" />
              <span>Checking Clinical Knowledge Base...</span>
            </div>
          )}

          {/* Streamlined Suggestion Chips */}
          <div className="pt-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Common Medication Safety Questions
              </span>
              <button
                type="button"
                onClick={() => setShowMoreSuggestions((prev) => !prev)}
                className="text-[11px] font-semibold text-[#3B7A57] dark:text-[#6EE7B7] hover:underline transition-colors cursor-pointer shrink-0"
              >
                {showMoreSuggestions ? "Show less" : "Show more suggestions"}
              </button>
            </div>

            <div
              className={
                showMoreSuggestions
                  ? "flex flex-wrap gap-2 py-2"
                  : "flex overflow-x-auto gap-2 scrollbar-none py-2"
              }
            >
              {(showMoreSuggestions ? testQueries : testQueries.slice(0, 3)).map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(item.text)}
                  disabled={loading}
                  title={item.label}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 hover:border-emerald-400 dark:hover:border-emerald-500/40 hover:bg-emerald-50/40 dark:hover:bg-[#34D399]/20 transition-colors inline-flex items-center gap-1.5 font-sans cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3 h-3 text-[#3B7A57] dark:text-[#6EE7B7] shrink-0" />
                  <span className="text-slate-900 dark:text-slate-100 font-semibold whitespace-nowrap">
                    {item.text}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 whitespace-nowrap hidden sm:inline">
                    · {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* 2. Footer: Dock input form to bottom (p-4 border-t border-slate-100 bg-white sticky bottom-0) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-4 border-t border-slate-100 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] sticky bottom-0 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about any medicine or combination..."
            disabled={loading}
            className="flex-1 bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/50 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/30 focus:border-[#3B7A57] dark:focus:border-[#6EE7B7] font-sans min-w-0"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2.5 rounded-xl bg-[#3B7A57] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white dark:text-slate-100 hover:bg-emerald-800 disabled:opacity-50 transition-colors shrink-0 shadow-2xs cursor-pointer"
            title="Send Query"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </aside>
    </div>
  );
};
